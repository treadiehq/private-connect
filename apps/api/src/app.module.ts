import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ContextModule } from './context/context.module';
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
import { DebugModule } from './debug/debug.module';
import { AIModule } from './ai/ai.module';
import { AskModule } from './ask/ask.module';
import { GrantsModule } from './grants/grants.module';
import { GroupsModule } from './groups/groups.module';
import { ResourceSessionsModule } from './resource-sessions/resource-sessions.module';

@Module({
  imports: [
    // Context module must be first for RLS to work
    ContextModule,
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
    ScheduleModule.forRoot(),
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
    DebugModule,
    AIModule,
    AskModule,
    GrantsModule,
    GroupsModule,
    ResourceSessionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
