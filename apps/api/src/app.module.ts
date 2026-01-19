import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AgentsModule } from './agents/agents.module';
import { ServicesModule } from './services/services.module';
import { TunnelModule } from './tunnel/tunnel.module';
import { TunnelsModule } from './tunnels/tunnels.module';
import { AuditModule } from './audit/audit.module';
import { WidgetsModule } from './widgets/widgets.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SharesModule } from './shares/shares.module';
import { EnvSharesModule } from './env-shares/env-shares.module';
import { StatusModule } from './status/status.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),
    PrismaModule,
    AuthModule,
    AdminModule,
    WorkspaceModule,
    ApiKeysModule,
    AgentsModule,
    ServicesModule,
    TunnelModule,
    TunnelsModule,
    AuditModule,
    WidgetsModule,
    WebhooksModule,
    RealtimeModule,
    SharesModule,
    EnvSharesModule,
    StatusModule,
    EventsModule,
  ],
})
export class AppModule {}
