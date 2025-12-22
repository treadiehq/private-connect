import { Module, forwardRef } from '@nestjs/common';
import { TunnelGateway } from './tunnel.gateway';
import { TunnelService } from './tunnel.service';
import { ProxyController } from './proxy.controller';
import { AgentsModule } from '../agents/agents.module';
import { ServicesModule } from '../services/services.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AgentsModule),
    forwardRef(() => ServicesModule),
  ],
  controllers: [ProxyController],
  providers: [TunnelGateway, TunnelService],
  exports: [TunnelService],
})
export class TunnelModule {}
