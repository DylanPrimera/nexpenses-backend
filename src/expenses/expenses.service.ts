import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentType, Prisma } from '@prisma/client';
import {
  getLocalNowParts,
  getUtcDateRange,
} from '../common/utils/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { FilterExpensesDto } from './dto/filter-expenses.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCategoryOwned(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      throw new NotFoundException('Category not found for this user');
    }
    return category;
  }

  async create(userId: string, dto: CreateExpenseDto) {
    await this.assertCategoryOwned(userId, dto.categoryId);

    const expense = await this.prisma.expense.create({
      data: {
        amount: dto.amount,
        categoryId: dto.categoryId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        paymentType: dto.paymentType ?? PaymentType.debit_card,
        date: dto.date ? new Date(dto.date) : new Date(),
        userId,
      },
      include: { category: true },
    });

    await this.prisma.category.update({
      where: { id: dto.categoryId },
      data: { usageCount: { increment: 1 } },
    });

    return expense;
  }

  async findAll(userId: string, filters: FilterExpensesDto) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const where: Prisma.ExpenseWhereInput = { userId };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.paymentType) where.paymentType = filters.paymentType;
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (filters.year != null || filters.month != null) {
      const { year: currentYear } = getLocalNowParts();
      const year = filters.year ?? currentYear;
      const { start, end } = getUtcDateRange(year, filters.month);
      where.date = { gte: start, lt: end };
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: { category: true },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { items: data, total, limit, offset };
  }

  async findOne(userId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    await this.findOne(userId, id);
    if (dto.categoryId) {
      await this.assertCategoryOwned(userId, dto.categoryId);
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.paymentType !== undefined
          ? { paymentType: dto.paymentType }
          : {}),
        ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
      },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.expense.delete({ where: { id } });
    return { deleted: true, id };
  }

  async wipeAll(userId: string) {
    const result = await this.prisma.expense.deleteMany({ where: { userId } });
    return { deleted: result.count };
  }
}
