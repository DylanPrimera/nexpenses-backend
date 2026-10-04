import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { SKIP_USER_ID_KEY } from '../decorators/skip-user-id.decorator.js';

@Injectable()
export class BearerAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_USER_ID_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;
    return super.canActivate(context);
  }
}
