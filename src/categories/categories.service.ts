import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  nextCategoryColor,
  normalizeCategoryName,
} from '../common/constants/category-colors.js';
import { PaginationDto } from '../common/dtos/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { GetOrCreateCategoryDto } from './dto/get-or-create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCategoryDto) {
    const name = normalizeCategoryName(dto.name);
    const count = await this.prisma.category.count({ where: { userId } });
    const color = dto.color ?? nextCategoryColor(count);

    try {
      return await this.prisma.category.create({
        data: { name, color, usageCount: 0, userId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          `Category "${name}" already exists for this user`,
        );
      }
      throw e;
    }
  }

  async findAll(userId: string, pagination: PaginationDto) {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where: { userId },
        orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.category.count({ where: { userId } }),
    ]);
    return { items: data, total, limit, offset };
  }

  async findOne(userId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async getOrCreate(userId: string, dto: GetOrCreateCategoryDto) {
    const name = normalizeCategoryName(dto.name);
    const existing = await this.prisma.category.findUnique({
      where: { userId_name: { userId, name } },
    });

    if (existing) {
      return this.prisma.category.update({
        where: { id: existing.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    const count = await this.prisma.category.count({ where: { userId } });
    return this.prisma.category.create({
      data: {
        name,
        color: nextCategoryColor(count),
        usageCount: 1,
        userId,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(userId, id);
    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = normalizeCategoryName(dto.name);
    if (dto.color !== undefined) data.color = dto.color;

    try {
      return await this.prisma.category.update({ where: { id }, data });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Category name already exists for this user',
        );
      }
      throw e;
    }
  }
}
