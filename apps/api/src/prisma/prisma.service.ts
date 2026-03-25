import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { ContextService } from '../context/context.service';

const RLS_BYPASS_TOKEN = '__rls_bypass__';

interface ExplicitContext {
  workspaceId?: string;
  bypass?: boolean;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;
  private isInitializing = true;
  private readonly explicitContext = new AsyncLocalStorage<ExplicitContext>();
  private readonly rlsContext = new AsyncLocalStorage<{ active: boolean }>();
  private _rlsClient: any;
  private _originalTransaction: (...args: any[]) => Promise<any>;

  constructor(
    @Inject(forwardRef(() => ContextService))
    private readonly contextService: ContextService,
  ) {
    super();

    this._originalTransaction = PrismaClient.prototype.$transaction.bind(this);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this._rlsClient = (this as PrismaClient).$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }: { args: any; query: any }) {
            if (self.rlsContext.getStore()?.active) {
              return query(args);
            }

            const workspaceId = self.resolveRlsWorkspaceId();

            return self.rlsContext.run({ active: true }, async () => {
              // set_config with is_local=true scopes the variable to the
              // transaction — it auto-resets when the transaction ends,
              // so pooled connections are never returned with stale state.
              const [, result] = await self._originalTransaction([
                (self as PrismaClient)
                  .$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, TRUE)`,
                query(args),
              ]) as [any, any];
              return result;
            });
          },
        },
      },
    });

    // Redirect model delegate access to the RLS-extended client so that
    // existing code like `this.prisma.agent.findMany(...)` goes through
    // the extension transparently.
    const modelNames = Object.values(Prisma.ModelName);
    for (const modelName of modelNames) {
      const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
      Object.defineProperty(this, delegateName, {
        get: () => this._rlsClient[delegateName],
        configurable: true,
      });
    }
  }

  /**
   * Override $transaction to inject RLS context on the correct connection.
   *
   * Batch transactions (array form) are blocked at runtime because the
   * RLS $extends hook converts PrismaPromise (lazy) into regular Promise
   * (eager), breaking atomicity. Use interactive transactions instead.
   */
  override $transaction<R>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<R>;
  /** @deprecated Batch transactions are blocked at runtime — use interactive form */
  override $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
  override async $transaction(argsOrFn: any, options?: any): Promise<any> {
    if (Array.isArray(argsOrFn)) {
      // Batch $transaction is incompatible with the RLS $extends hook.
      // The async $allOperations wrapper converts PrismaPromise (lazy) into
      // regular Promise (eager), so array elements execute and commit
      // independently before $transaction even receives them.
      // Use interactive transactions instead:
      //   prisma.$transaction(async (tx) => { await tx.model.op(); ... })
      throw new Error(
        'Batch $transaction([...]) is not supported with RLS. ' +
        'Use interactive $transaction(async (tx) => { ... }) instead.',
      );
    }

    const workspaceId = this.resolveRlsWorkspaceId();

    return this.rlsContext.run({ active: true }, async () => {
      if (typeof argsOrFn === 'function') {
        return this._originalTransaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, TRUE)`;
          return argsOrFn(tx);
        }, options);
      }

      return this._originalTransaction(argsOrFn, options);
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
    this.isInitializing = false;
  }

  /**
   * Resolve the RLS workspace ID for the current request context.
   * ALWAYS returns a value — never leaves the session variable unset.
   * Empty string means "no context" which will be denied by RLS policies.
   */
  resolveRlsWorkspaceId(): string {
    if (this.isInitializing) {
      return RLS_BYPASS_TOKEN;
    }

    const explicit = this.explicitContext.getStore();
    if (explicit) {
      if (explicit.bypass) {
        return RLS_BYPASS_TOKEN;
      }
      if (explicit.workspaceId) {
        return explicit.workspaceId.replace(/[^a-zA-Z0-9-]/g, '');
      }
    }

    const isAdmin = this.contextService?.isAdmin();
    if (isAdmin) {
      return RLS_BYPASS_TOKEN;
    }

    const workspaceId = this.contextService?.getWorkspaceId();
    if (workspaceId) {
      return workspaceId.replace(/[^a-zA-Z0-9-]/g, '');
    }

    return '';
  }

  private async connectWithRetry(maxRetries = 5, delayMs = 3000): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.connected = true;
        this.logger.log('Successfully connected to database');
        return;
      } catch (error: any) {
        this.logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed: ${error?.message || error}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    this.logger.error('Failed to connect to database after all retries. App will continue but DB operations will fail.');
  }

  async ensureConnection(): Promise<boolean> {
    if (this.connected) return true;
    try {
      await this.$connect();
      this.connected = true;
      return true;
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Execute a callback with a specific workspace context.
   * Useful for background jobs, webhooks, or unauthenticated endpoints
   * that need explicit context.
   */
  async withWorkspace<T>(workspaceId: string, callback: () => Promise<T>): Promise<T> {
    return this.explicitContext.run({ workspaceId }, callback);
  }

  /**
   * Execute a callback bypassing RLS (for admin/system operations).
   * Use with caution — this bypasses tenant isolation.
   */
  async withoutRls<T>(callback: () => Promise<T>): Promise<T> {
    return this.explicitContext.run({ bypass: true }, callback);
  }
}
