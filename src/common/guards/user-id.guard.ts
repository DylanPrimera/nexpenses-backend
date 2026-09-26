import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate as isUuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SKIP_USER_ID_KEY } from '../decorators/skip-user-id.decorator.js';

@Injectable()
export class UserIdGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_USER_ID_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: unknown;
    }>();

    const raw =
      request.headers['x-user-id'] ?? request.headers['X-User-Id'];

    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      throw new BadRequestException('X-User-Id header is required');
    }

    const userId = raw.trim();
    if (!isUuid(userId)) {
      throw new BadRequestException('X-User-Id must be a valid UUID');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    request.user = user;
    return true;
  }
}
