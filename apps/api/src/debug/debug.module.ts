import { Module, forwardRef } from '@nestjs/common';
import { DebugService } from './debug.service';
import { DebugController } from './debug.controller';
import { DebugGateway } from './debug.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { TunnelModule } from '../tunnel/tunnel.module';
import { AIModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitGuard } from '../common/rate-limit.guard';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => TunnelModule),
    forwardRef(() => AIModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [DebugController],
  providers: [DebugService, DebugGateway, RateLimitGuard],
  exports: [DebugService],
})
export class DebugModule {}
