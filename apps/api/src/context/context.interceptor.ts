import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ContextService } from './context.service';

/**
 * Interceptor that captures workspaceId from the request and stores it
 * in AsyncLocalStorage for use by PrismaService (RLS context)
 */
@Injectable()
export class ContextInterceptor implements NestInterceptor {
  constructor(private readonly contextService: ContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Extract workspace info from request (set by AuthGuard or ApiKeyGuard)
    const workspaceId = request.workspaceId || request.workspace?.id;
    const isAdmin = request.user?.isAdmin ?? false;

    // Run the handler within the context
    return new Observable((subscriber) => {
      this.contextService.run({ workspaceId, isAdmin }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
