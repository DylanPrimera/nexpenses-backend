import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  getBusinessSupplement,
  parseLocalDateOrInstant,
} from '../common/utils/index.js';
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

function withoutPassword<T extends {
  password?: string | null;
  emailAppToken?: string | null;
}>(user: T) {
  const { password: _password, emailAppToken: _emailAppToken, ...rest } = user;
  return rest;
}

function normalizeOptionalToken(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const withBusiness = {
  business: { select: { id: true, name: true } },
} satisfies Prisma.UserInclude;

type UserWithBusiness = Prisma.UserGetPayload<{ include: typeof withBusiness }>;

function cycleStartData(value: string | undefined): { cycleStartedAt?: Date } {
  return value === undefined
    ? {}
    : { cycleStartedAt: parseLocalDateOrInstant(value) };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const email = normalizeOptionalEmail(dto.email);
    const emailAppToken = normalizeOptionalToken(dto.emailAppToken);

    try {
      return withoutPassword(await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          budget: dto.budget,
          email:
            email ?? `legacy+${crypto.randomUUID()}@users.nexpenses.invalid`,
          ...(emailAppToken !== undefined ? { emailAppToken } : {}),
          ...cycleStartData(dto.cycleStartedAt),
        },
      }));
    } catch (error) {
      this.rethrowUniqueEmail(error);
      throw error;
    }
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: withBusiness,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toPublicUser(user);
  }

  private async toPublicUser(user: UserWithBusiness) {
    const businessBudgetSupplement = await getBusinessSupplement(
      this.prisma,
      user,
    );
    return { ...withoutPassword(user), businessBudgetSupplement };
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
    if (email === null) {
      throw new BadRequestException('Email cannot be cleared');
    }

    try {
      return await this.toPublicUser(await this.prisma.user.update({
        where: { id: userId },
        include: withBusiness,
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.budget !== undefined ? { budget: dto.budget } : {}),
          ...(typeof email === 'string' ? { email } : {}),
          ...(emailAppToken !== undefined ? { emailAppToken } : {}),
          ...cycleStartData(dto.cycleStartedAt),
        },
      }));
    } catch (error) {
      this.rethrowUniqueEmail(error);
      throw error;
    }
  }

  async wipeMe(userId: string) {
    await this.findMe(userId);

    return this.prisma.$transaction(async (tx) => {
      const expenses = await tx.expense.deleteMany({ where: { userId } });
      const recurringExpenses = await tx.recurringExpense.deleteMany({
        where: { userId },
      });
      const credits = await tx.credit.deleteMany({ where: { userId } });
      const categories = await tx.category.deleteMany({ where: { userId } });
      const inbound = await tx.processedInboundEmail.deleteMany({
        where: { userId },
      });
      const businessIncomes = await tx.businessIncome.deleteMany({
        where: { business: { userId } },
      });
      await tx.business.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });

      return {
        deleted: true,
        userId,
        counts: {
          expenses: expenses.count,
          recurringExpenses: recurringExpenses.count,
          credits: credits.count,
          categories: categories.count,
          processedInboundEmails: inbound.count,
          businessIncomes: businessIncomes.count,
        },
      };
    });
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
