import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { isAdminEmail } from '../common/admin';

/**
 * Guard that validates admin access
 * Requires valid session AND user email in ADMIN_EMAIL env var
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.session;

    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    const session = await this.authService.validateSession(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Check if user email is in ADMIN_EMAIL
    if (!isAdminEmail(session.user.email)) {
      throw new ForbiddenException('Admin access required');
    }

    // Attach user and workspace to request
    request.user = session.user;
    request.workspace = session.workspace;

    return true;
  }
}
