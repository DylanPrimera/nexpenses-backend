import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BusinessPaymentMethod, Prisma } from '@prisma/client';
import type { Business, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type Db = PrismaService | Prisma.TransactionClient;

export function businessNotFound(): NotFoundException {
  return new NotFoundException({
    message: 'Aún no tienes un negocio',
    code: 'BUSINESS_NOT_FOUND',
  });
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return value.length === 0 ? null : value;
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export async function requireBusiness(
  db: Db,
  userId: string,
): Promise<Business> {
  const business = await db.business.findUnique({ where: { userId } });
  if (!business) throw businessNotFound();
  return business;
}

export async function requireUser(db: Db, userId: string): Promise<User> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException('User not found');
  return user;
}

export function resolveBankName(
  method: BusinessPaymentMethod,
  requested: string | null | undefined,
  current: string | null = null,
): string | null {
  const value = requested === undefined ? current : emptyToNull(requested);
  if (method !== BusinessPaymentMethod.transfer) {
    if (requested !== undefined && value !== null) {
      throw new BadRequestException({
        message: 'El banco solo aplica a transferencias',
        code: 'BANK_REQUIRES_TRANSFER',
      });
    }
    return null;
  }
  return value;
}
