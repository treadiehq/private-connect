import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  workspaceId?: string;
  isAdmin?: boolean;
}

@Injectable()
export class ContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  /**
   * Run a function within a context
   */
  run<T>(context: RequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * Get the current context
   */
  getContext(): RequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the current workspace ID
   */
  getWorkspaceId(): string | undefined {
    return this.storage.getStore()?.workspaceId;
  }

  /**
   * Check if current context is admin (bypasses RLS)
   */
  isAdmin(): boolean {
    return this.storage.getStore()?.isAdmin ?? false;
  }
}
