import { Module, forwardRef } from '@nestjs/common';
import { TunnelGateway } from './tunnel.gateway';
import { TunnelService } from './tunnel.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [forwardRef(() => AgentsModule)],
  providers: [TunnelGateway, TunnelService],
  exports: [TunnelService],
})
export class TunnelModule {}
