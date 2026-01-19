import { Module, forwardRef } from '@nestjs/common';
import { TunnelsController } from './tunnels.controller';
import { TunnelsService } from './tunnels.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ServicesModule } from '../services/services.module';
import { SharesModule } from '../shares/shares.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => ServicesModule),
    forwardRef(() => SharesModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [TunnelsController],
  providers: [TunnelsService],
  exports: [TunnelsService],
})
export class TunnelsModule {}
