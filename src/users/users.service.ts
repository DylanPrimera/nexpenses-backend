import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto } from '../common/dtos/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

function normalizeOptionalEmail(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.toLowerCase();
}

function normalizeOptionalToken(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const email = normalizeOptionalEmail(dto.email);
    const emailAppToken = normalizeOptionalToken(dto.emailAppToken);

    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          budget: dto.budget,
          ...(email !== undefined ? { email } : {}),
          ...(emailAppToken !== undefined ? { emailAppToken } : {}),
        },
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
      throw error;
    }
  }


  async findAll(pagination: PaginationDto) {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          budget: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);
    return { items: data, total, limit, offset };
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findOne(id: string, requesterId: string) {
    if (id !== requesterId) {
      throw new ForbiddenException('You can only access your own user profile');
    }
    return this.findMe(id);
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    await this.findMe(userId);

    const email = normalizeOptionalEmail(dto.email);
    const emailAppToken = normalizeOptionalToken(dto.emailAppToken);

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.budget !== undefined ? { budget: dto.budget } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(emailAppToken !== undefined ? { emailAppToken } : {}),
        },
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
      throw error;
    }
  }

  private rethrowUniqueEmail(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : [target];
      if (fields.includes('email')) {
        throw new ConflictException('Email is already in use');
      }
    }
  }
}
