import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { ServicesModule } from './services/services.module';
import { TunnelModule } from './tunnel/tunnel.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SharesModule } from './shares/shares.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    ApiKeysModule,
    AgentsModule,
    ServicesModule,
    TunnelModule,
    RealtimeModule,
    SharesModule,
  ],
})
export class AppModule {}
