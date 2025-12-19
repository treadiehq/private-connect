import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

interface SendMagicLinkOptions {
  to: string;
  token: string;
  type: 'LOGIN' | 'REGISTER';
  workspaceName?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  constructor() {
    this.initResend();
  }

  private initResend() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email service initialized');
    }
  }

  async sendMagicLink(options: SendMagicLinkOptions): Promise<void> {
    const { to, token, type, workspaceName } = options;
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/verify?token=${token}`;

    const subject = type === 'REGISTER' 
      ? `Complete your Private Connect signup`
      : `Sign in to Private Connect`;

    const text = type === 'REGISTER'
      ? `Welcome to Private Connect!\n\nClick the link below to verify your email and access your workspace "${workspaceName}":\n\n${magicLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`
      : `Click the link below to sign in to Private Connect:\n\n${magicLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`;

    // In development or if Resend is not configured, log to console
    if (!this.resend) {
      this.logger.log('');
      this.logger.log('═══════════════════════════════════════════════════════════');
      this.logger.log('  📧 MAGIC LINK EMAIL (Development Mode)');
      this.logger.log('═══════════════════════════════════════════════════════════');
      this.logger.log(`  To: ${to}`);
      this.logger.log(`  Subject: ${subject}`);
      this.logger.log('');
      this.logger.log(`  🔗 Click to ${type === 'REGISTER' ? 'verify' : 'login'}:`);
      this.logger.log(`  ${magicLink}`);
      this.logger.log('');
      this.logger.log('═══════════════════════════════════════════════════════════');
      this.logger.log('');
      return;
    }

    // Production: send via Resend
    try {
      await this.resend.emails.send({
        from: process.env.EMAIL_FROM || 'Private Connect <noreply@privateconnect.dev>',
        to,
        subject,
        text,
        html: this.generateHtmlEmail(type, magicLink, workspaceName),
      });
      this.logger.log(`Magic link email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new Error('Failed to send magic link email');
    }
  }

  private generateHtmlEmail(type: 'LOGIN' | 'REGISTER', magicLink: string, workspaceName?: string): string {
    const title = type === 'REGISTER' ? 'Complete Your Signup' : 'Sign In';
    const greeting = type === 'REGISTER' 
      ? `Welcome to Private Connect!` 
      : `Sign in to your account`;
    const message = type === 'REGISTER'
      ? `Click the button below to verify your email and access your workspace "${workspaceName}".`
      : `Click the button below to sign in to Private Connect.`;
    const buttonText = type === 'REGISTER' ? 'Verify Email' : 'Sign In';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; padding: 40px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <h1 style="color: #14b8a6; margin: 0; font-size: 24px;">⚡ Private Connect</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 16px;">
              <h2 style="color: #f8fafc; margin: 0; font-size: 20px;">${greeting}</h2>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <p style="color: #94a3b8; margin: 0; font-size: 16px; line-height: 24px;">${message}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <a href="${magicLink}" style="display: inline-block; background-color: #14b8a6; color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">${buttonText}</a>
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="color: #64748b; margin: 0; font-size: 14px;">This link expires in 15 minutes.</p>
              <p style="color: #475569; margin: 16px 0 0 0; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}

