import { Module, forwardRef } from '@nestjs/common';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ServicesModule } from '../services/services.module';
import { AuthModule } from '../auth/auth.module';
import { TunnelModule } from '../tunnel/tunnel.module';

@Module({
  imports: [PrismaModule, ServicesModule, AuthModule, forwardRef(() => TunnelModule)],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}

