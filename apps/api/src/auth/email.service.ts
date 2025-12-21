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
      ? 'Complete your Private Connect signup'
      : 'Sign in to Private Connect';

    const text = type === 'REGISTER'
      ? `Welcome to Private Connect!

Click the link below to verify your email and access your workspace "${workspaceName}":

${magicLink}

This link expires in 15 minutes.

If you didn't request this, you can safely ignore this email.`
      : `Welcome back to Private Connect!

Click the link below to sign in:

${magicLink}

This link expires in 15 minutes.

If you didn't request this, you can safely ignore this email.`;

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

    // Production: send via Resend (plain text only)
    try {
      await this.resend.emails.send({
        from: process.env.EMAIL_FROM || 'Private Connect <noreply@privateconnect.dev>',
        to,
        subject,
        text,
      });
      this.logger.log(`Magic link email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new Error('Failed to send magic link email');
    }
  }
}

