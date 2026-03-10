import { Module, forwardRef } from '@nestjs/common';
import { TunnelGateway } from './tunnel.gateway';
import { ShellGateway } from './shell.gateway';
import { TunnelService } from './tunnel.service';
import { ProxyController } from './proxy.controller';
import { TemporaryTunnelController } from './temporary-tunnel.controller';
import { TemporaryTunnelService } from './temporary-tunnel.service';
import { TemporaryTunnelGateway } from './temporary-tunnel.gateway';
import { AgentsModule } from '../agents/agents.module';
import { ServicesModule } from '../services/services.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DebugModule } from '../debug/debug.module';
import { EnvSharesModule } from '../env-shares/env-shares.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AgentsModule),
    forwardRef(() => ServicesModule),
    forwardRef(() => DebugModule),
    forwardRef(() => EnvSharesModule),
  ],
  controllers: [ProxyController, TemporaryTunnelController],
  providers: [TunnelGateway, ShellGateway, TunnelService, TemporaryTunnelService, TemporaryTunnelGateway],
  exports: [TunnelService, TemporaryTunnelService],
})
export class TunnelModule {}
