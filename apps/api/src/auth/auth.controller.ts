import { Controller, Post, Get, Body, Query, Req, Res, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { authRateLimiter } from '../common/rate-limiter';

interface RegisterDto {
  email: string;
  workspaceName: string;
}

interface LoginDto {
  email: string;
}

@Controller('v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto, @Req() req: Request) {
    // Rate limit by IP
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';
    if (!authRateLimiter.isAllowed(`register:${clientIp}`)) {
      throw new HttpException(
        { error: 'Too many requests', message: 'Please wait before trying again.', retryAfter: authRateLimiter.getResetTime(`register:${clientIp}`) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!body.email || !body.workspaceName) {
      throw new UnauthorizedException('Email and workspace name are required');
    }
    return this.authService.register(body.email, body.workspaceName);
  }

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request) {
    // Rate limit by IP
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';
    if (!authRateLimiter.isAllowed(`login:${clientIp}`)) {
      throw new HttpException(
        { error: 'Too many requests', message: 'Please wait before trying again.', retryAfter: authRateLimiter.getResetTime(`login:${clientIp}`) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!body.email) {
      throw new UnauthorizedException('Email is required');
    }
    return this.authService.login(body.email);
  }

  @Get('verify')
  async verify(
    @Query('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();

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
  async me(@Req() req: Request) {
    const token = req.cookies?.session;
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.getCurrentUser(token);
  }
}

