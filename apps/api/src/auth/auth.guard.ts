import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
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

    // Attach user and workspace to request
    request.user = session.user;
    request.workspace = session.workspace;

    return true;
  }
}

