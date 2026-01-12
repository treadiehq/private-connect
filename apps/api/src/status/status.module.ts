import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { TunnelModule } from '../tunnel/tunnel.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [TunnelModule, PrismaModule],
  controllers: [StatusController],
})
export class StatusModule {}
