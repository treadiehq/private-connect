import { Module, forwardRef } from '@nestjs/common';
import { TunnelGateway } from './tunnel.gateway';
import { TunnelService } from './tunnel.service';
import { ProxyController } from './proxy.controller';
import { TemporaryTunnelController } from './temporary-tunnel.controller';
import { TemporaryTunnelService } from './temporary-tunnel.service';
import { TemporaryTunnelGateway } from './temporary-tunnel.gateway';
import { AgentsModule } from '../agents/agents.module';
import { ServicesModule } from '../services/services.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AgentsModule),
    forwardRef(() => ServicesModule),
  ],
  controllers: [ProxyController, TemporaryTunnelController],
  providers: [TunnelGateway, TunnelService, TemporaryTunnelService, TemporaryTunnelGateway],
  exports: [TunnelService, TemporaryTunnelService],
})
export class TunnelModule {}
