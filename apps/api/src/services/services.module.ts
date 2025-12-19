import { Module, forwardRef } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { DiagnosticsController } from './diagnostics.controller';
import { ServicesService } from './services.service';
import { DiagnosticsService } from './diagnostics.service';
import { SessionsService } from './sessions.service';
import { TunnelModule } from '../tunnel/tunnel.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    forwardRef(() => TunnelModule),
    forwardRef(() => RealtimeModule),
    forwardRef(() => WorkspaceModule),
    forwardRef(() => AgentsModule),
  ],
  controllers: [ServicesController, DiagnosticsController],
  providers: [ServicesService, DiagnosticsService, SessionsService],
  exports: [ServicesService, SessionsService],
})
export class ServicesModule {}
