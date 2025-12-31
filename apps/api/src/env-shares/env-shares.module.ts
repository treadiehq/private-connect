import { Module } from '@nestjs/common';
import { EnvSharesController } from './env-shares.controller';
import { EnvSharesService } from './env-shares.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ServicesModule } from '../services/services.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [PrismaModule, ServicesModule, AgentsModule],
  controllers: [EnvSharesController],
  providers: [EnvSharesService],
  exports: [EnvSharesService],
})
export class EnvSharesModule {}

