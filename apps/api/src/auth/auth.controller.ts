import { Controller, Post, Get, Body, Query, Req, Res, UnauthorizedException, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { authRateLimiter, authEmailRateLimiter } from '../common/rate-limiter';

interface RegisterDto {
  email: string;
  workspaceName: string;
}

interface LoginDto {
  email: string;
}

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @ApiOperation({ 
    summary: 'Register new user', 
    description: 'Creates a new user account and workspace. Sends a magic link email for verification.' 
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'workspaceName'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        workspaceName: { type: 'string', example: 'my-workspace' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Registration email sent' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async register(@Body() body: RegisterDto, @Req() req: Request) {
    // Rate limit by IP
    const clientIp = this.getClientIp(req);
    if (!authRateLimiter.isAllowed(`register:${clientIp}`)) {
      throw new HttpException(
        { error: 'Too many requests', message: 'Please wait before trying again.', retryAfter: authRateLimiter.getResetTime(`register:${clientIp}`) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!body.email || !body.workspaceName) {
      throw new UnauthorizedException('Email and workspace name are required');
    }

    // Rate limit by email address to prevent magic-link spam to a target inbox
    const normalizedEmail = body.email.toLowerCase().trim();
    if (!authEmailRateLimiter.isAllowed(`register-email:${normalizedEmail}`)) {
      throw new HttpException(
        { error: 'Too many requests', message: 'Please wait before trying again.', retryAfter: authEmailRateLimiter.getResetTime(`register-email:${normalizedEmail}`) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.authService.register(body.email, body.workspaceName);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ 
    summary: 'Login', 
    description: 'Sends a magic link email to the user for passwordless authentication.' 
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Login email sent' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(@Body() body: LoginDto, @Req() req: Request) {
    // Rate limit by IP
    const clientIp = this.getClientIp(req);
    if (!authRateLimiter.isAllowed(`login:${clientIp}`)) {
      throw new HttpException(
        { error: 'Too many requests', message: 'Please wait before trying again.', retryAfter: authRateLimiter.getResetTime(`login:${clientIp}`) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!body.email) {
      throw new UnauthorizedException('Email is required');
    }

    // Rate limit by email address to prevent magic-link spam to a target inbox
    const normalizedEmail = body.email.toLowerCase().trim();
    if (!authEmailRateLimiter.isAllowed(`login-email:${normalizedEmail}`)) {
      throw new HttpException(
        { error: 'Too many requests', message: 'Please wait before trying again.', retryAfter: authEmailRateLimiter.getResetTime(`login-email:${normalizedEmail}`) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.authService.login(body.email);
  }

  @Get('verify')
  @ApiOperation({ 
    summary: 'Verify magic link', 
    description: 'Verifies a magic link token and creates a session. Sets a session cookie.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Authentication successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        user: { type: 'object' },
        workspace: { type: 'object' },
        isNewUser: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async verify(
    @Query('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = this.getClientIp(req);

    const result = await this.authService.verifyMagicLink(token, userAgent, ipAddress);

    // Set session cookie
    res.cookie('session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    return {
      success: true,
      user: result.user,
      workspace: result.workspace,
      isNewUser: result.isNewUser,
    };
  }

  @Post('logout')
  @ApiOperation({ 
    summary: 'Logout', 
    description: 'Invalidates the current session and clears the session cookie.' 
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.session;
    if (token) {
      await this.authService.logout(token);
    }

    res.clearCookie('session', { path: '/' });
    return { success: true };
  }

  @Get('me')
  @ApiOperation({ 
    summary: 'Get current user', 
    description: 'Returns the currently authenticated user and their workspace.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Current user info',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        workspace: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async me(@Req() req: Request) {
    const token = req.cookies?.session;
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.getCurrentUser(token);
  }

  /** Use req.ip (set by Express when trust proxy is enabled) so rate limiting cannot be bypassed via spoofed X-Forwarded-For. */
  private getClientIp(req: Request): string {
    return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  }
}
