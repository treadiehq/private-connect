import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ContextService } from './context.service';
import { ContextInterceptor } from './context.interceptor';

@Global()
@Module({
  providers: [
    ContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ContextInterceptor,
    },
  ],
  exports: [ContextService],
})
export class ContextModule {}
