import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit() {
    // Try to connect with retries, but don't crash the app if DB is temporarily unavailable
    await this.connectWithRetry();
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
}

