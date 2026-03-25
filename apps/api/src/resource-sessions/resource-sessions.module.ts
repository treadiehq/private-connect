import { Module } from '@nestjs/common';
import { ResourceSessionsController } from './resource-sessions.controller';
import { ResourceSessionsService } from './resource-sessions.service';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AgentsModule, AuthModule],
  controllers: [ResourceSessionsController],
  providers: [ResourceSessionsService],
  exports: [ResourceSessionsService],
})
export class ResourceSessionsModule {}
