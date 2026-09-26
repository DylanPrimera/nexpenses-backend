import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { isApiSuccessEnvelope } from './api-response.js';
import { defaultSuccessMessage } from './default-messages.js';
import { RESPONSE_MESSAGE_KEY } from './response-message.decorator.js';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator.js';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const customMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<{ method?: string }>();
    const method = request.method ?? 'GET';
    const message = customMessage ?? defaultSuccessMessage(method);

    return next.handle().pipe(
      map((payload) => {
        if (isApiSuccessEnvelope(payload)) {
          return payload;
        }
        return {
          success: true as const,
          data: payload === undefined ? null : payload,
          message,
        };
      }),
    );
  }
}
