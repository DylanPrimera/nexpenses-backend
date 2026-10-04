import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BearerAuthGuard } from './guards/user-id.guard.js';
import { HttpExceptionFilter } from './http/http-exception.filter.js';
import { TransformInterceptor } from './http/transform.interceptor.js';

@Global()
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: BearerAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class CommonModule {}
