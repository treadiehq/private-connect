import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { ContextService } from '../context/context.service';

// Special token that bypasses RLS for admin/system operations
const RLS_BYPASS_TOKEN = '__rls_bypass__';

// Explicit context override (for withWorkspace/withoutRls)
interface ExplicitContext {
  workspaceId?: string;
  bypass?: boolean;
}

// Context for preventing recursive middleware calls
interface MiddlewareContext {
  settingRls?: boolean;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;
  private isInitializing = true; // Flag for startup operations
  private readonly explicitContext = new AsyncLocalStorage<ExplicitContext>();
  private readonly middlewareContext = new AsyncLocalStorage<MiddlewareContext>();

  constructor(
    @Inject(forwardRef(() => ContextService))
    private readonly contextService: ContextService,
  ) {
    super();

    // Add middleware to set RLS context before each query.
    // We SET the session variable before the query and RESET it after,
    // so that pooled connections never carry stale tenant context.
    this.$use(async (params, next) => {
      // Prevent infinite recursion: don't run RLS context for the SET command itself
      const ctx = this.middlewareContext.getStore();
      if (ctx?.settingRls) {
        return next(params);
      }

      await this.setRlsContext();
      try {
        return await next(params);
      } finally {
        // Always reset after query to prevent stale context leaking
        // to the next request that reuses this pooled connection.
        await this.resetRlsContext();
      }
    });
  }

  async onModuleInit() {
    // Try to connect with retries, but don't crash the app if DB is temporarily unavailable
    await this.connectWithRetry();
    // Mark initialization complete
    this.isInitializing = false;
  }

  /**
   * Resolve the RLS workspace ID for the current request context.
   * ALWAYS returns a value — never leaves the session variable unset.
   * Empty string means "no context" which will be denied by RLS policies.
   */
  private resolveRlsWorkspaceId(): string {
    // During initialization (startup), bypass RLS for setup operations
    if (this.isInitializing) {
      return RLS_BYPASS_TOKEN;
    }

    // Check for explicit context override (from withWorkspace/withoutRls)
    const explicit = this.explicitContext.getStore();
    if (explicit) {
      if (explicit.bypass) {
        return RLS_BYPASS_TOKEN;
      }
      if (explicit.workspaceId) {
        return explicit.workspaceId.replace(/[^a-zA-Z0-9-]/g, '');
      }
    }

    // Fall back to request context (from ContextService/interceptor)
    const isAdmin = this.contextService?.isAdmin();
    if (isAdmin) {
      return RLS_BYPASS_TOKEN;
    }

    const workspaceId = this.contextService?.getWorkspaceId();
    if (workspaceId) {
      return workspaceId.replace(/[^a-zA-Z0-9-]/g, '');
    }

    // No context — return empty string so RLS denies access (deny-by-default).
    // This prevents stale session variables from leaking across pooled connections.
    return '';
  }

  /**
   * Set the PostgreSQL session variable for RLS before a query.
   * ALWAYS sets a value — empty string when no context, which RLS will deny.
   * This prevents stale workspace IDs from leaking across pooled connections.
   */
  private async setRlsContext(): Promise<void> {
    return this.middlewareContext.run({ settingRls: true }, async () => {
      const rlsId = this.resolveRlsWorkspaceId();
      try {
        await this.$executeRawUnsafe(`SET app.current_workspace_id TO '${rlsId}'`);
      } catch {
        // Ignore errors during initial connection
      }
    });
  }

  /**
   * Reset the RLS session variable after a query completes.
   * Ensures pooled connections are returned in a clean state.
   */
  private async resetRlsContext(): Promise<void> {
    return this.middlewareContext.run({ settingRls: true }, async () => {
      try {
        await this.$executeRawUnsafe(`RESET app.current_workspace_id`);
      } catch {
        // Ignore errors — best-effort cleanup
      }
    });
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
   * Execute a callback with a specific workspace context
   * Useful for background jobs, webhooks, or unauthenticated endpoints that need explicit context
   */
  async withWorkspace<T>(workspaceId: string, callback: () => Promise<T>): Promise<T> {
    return this.explicitContext.run({ workspaceId }, callback);
  }

  /**
   * Execute a callback bypassing RLS (for admin/system operations)
   * Use with caution - this bypasses tenant isolation
   */
  async withoutRls<T>(callback: () => Promise<T>): Promise<T> {
    return this.explicitContext.run({ bypass: true }, callback);
  }
}

