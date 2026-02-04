import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { AuthGuard } from './auth.guard';
import { ApiKeyGuard } from './api-key.guard';
import { AdminGuard } from './admin.guard';
import { CombinedAuthGuard } from './combined-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, DeviceController],
  providers: [AuthService, EmailService, DeviceService, AuthGuard, ApiKeyGuard, AdminGuard, CombinedAuthGuard],
  exports: [AuthService, DeviceService, AuthGuard, ApiKeyGuard, AdminGuard, CombinedAuthGuard],
})
export class AuthModule {}

