import { Module, forwardRef } from '@nestjs/common';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SharesModule } from '../shares/shares.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => SharesModule),
  ],
  controllers: [WidgetsController],
  providers: [WidgetsService],
  exports: [WidgetsService],
})
export class WidgetsModule {}
