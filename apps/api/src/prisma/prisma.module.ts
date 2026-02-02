import { Global, Module, forwardRef } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ContextModule } from '../context/context.module';

@Global()
@Module({
  imports: [forwardRef(() => ContextModule)],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

