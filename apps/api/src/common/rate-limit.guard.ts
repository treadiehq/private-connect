import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiter, debugPublicRateLimiter, debugAIRateLimiter } from './rate-limiter';

// Decorator to specify rate limit type
export const RATE_LIMIT_KEY = 'rateLimit';
export type RateLimitType = 'debug' | 'debug-ai' | 'custom';

export const RateLimit = (type: RateLimitType, options?: { limiter?: RateLimiter }) =>
  SetMetadata(RATE_LIMIT_KEY, { type, ...options });

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiters: Record<string, RateLimiter> = {
    debug: debugPublicRateLimiter,
    'debug-ai': debugAIRateLimiter,
  };

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rateLimitConfig = this.reflector.getAllAndOverride<{
      type: RateLimitType;
      limiter?: RateLimiter;
    }>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    if (!rateLimitConfig) {
      // No rate limit configured, allow
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip = this.getClientIp(request);
    
    // Get the appropriate limiter
    const limiter =
      rateLimitConfig.limiter || this.limiters[rateLimitConfig.type];

    if (!limiter) {
      return true;
    }

    if (!limiter.isAllowed(ip)) {
      const resetTime = limiter.getResetTime(ip);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    const remaining = limiter.getRemaining(ip);
    const resetTime = limiter.getResetTime(ip);
    
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    response.setHeader('X-RateLimit-Reset', resetTime.toString());

    return true;
  }

  private getClientIp(request: any): string {
    const xff = request.headers['x-forwarded-for'];
    if (xff) {
      const raw = Array.isArray(xff) ? xff[0] : xff;
      const ips = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (ips.length > 0) return ips[ips.length - 1];
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return (
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}
