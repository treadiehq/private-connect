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

    // Add middleware to set RLS context before each query
    this.$use(async (params, next) => {
      // Prevent infinite recursion: don't run RLS context for the SET command itself
      const ctx = this.middlewareContext.getStore();
      if (ctx?.settingRls) {
        return next(params);
      }
      
      await this.setRlsContext();
      return next(params);
    });
  }

  async onModuleInit() {
    // Try to connect with retries, but don't crash the app if DB is temporarily unavailable
    await this.connectWithRetry();
    // Mark initialization complete
    this.isInitializing = false;
  }

  /**
   * Set the PostgreSQL session variable for RLS
   * This must be called before each query to ensure proper tenant isolation
   */
  private async setRlsContext(): Promise<void> {
    // Wrap in context to prevent recursion
    return this.middlewareContext.run({ settingRls: true }, async () => {
      // During initialization (startup), bypass RLS for setup operations
      if (this.isInitializing) {
        try {
          await this.$executeRawUnsafe(`SET app.current_workspace_id TO '${RLS_BYPASS_TOKEN}'`);
        } catch {
          // Ignore errors during initial connection
        }
        return;
      }

      // Check for explicit context override (from withWorkspace/withoutRls)
      const explicit = this.explicitContext.getStore();
      if (explicit) {
        if (explicit.bypass) {
          try {
            await this.$executeRawUnsafe(`SET app.current_workspace_id TO '${RLS_BYPASS_TOKEN}'`);
          } catch {
            // Ignore errors
          }
          return;
        }
        if (explicit.workspaceId) {
          const sanitizedId = explicit.workspaceId.replace(/[^a-zA-Z0-9-]/g, '');
          try {
            await this.$executeRawUnsafe(`SET app.current_workspace_id TO '${sanitizedId}'`);
          } catch {
            // Ignore errors
          }
          return;
        }
      }

      // Fall back to request context (from ContextService/interceptor)
      const workspaceId = this.contextService?.getWorkspaceId();
      const isAdmin = this.contextService?.isAdmin();

      if (isAdmin) {
        // Admin users bypass RLS
        try {
          await this.$executeRawUnsafe(`SET app.current_workspace_id TO '${RLS_BYPASS_TOKEN}'`);
        } catch {
          // Ignore errors
        }
        return;
      }

      if (workspaceId) {
        try {
          // Use SET (session-level) so it persists across auto-committed queries
          // Sanitize workspaceId to prevent SQL injection (UUIDs only contain safe chars)
          const sanitizedId = workspaceId.replace(/[^a-zA-Z0-9-]/g, '');
          await this.$executeRawUnsafe(`SET app.current_workspace_id TO '${sanitizedId}'`);
        } catch {
          // Ignore errors during initial connection
        }
      }
      // If no workspaceId and not admin, the session variable is not set
      // RLS will deny access (deny-by-default policy)
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

