import type { Business, Prisma } from '@prisma/client';
import {
  nextCategoryColor,
  normalizeCategoryName,
} from '../common/constants/category-colors.js';

export const BUSINESS_CATEGORY_NAME = 'Negocio';

export async function ensureBusinessCategory(
  tx: Prisma.TransactionClient,
  userId: string,
  business: Pick<Business, 'id' | 'businessCategoryId'>,
): Promise<string> {
  if (business.businessCategoryId) {
    const stored = await tx.category.findFirst({
      where: { id: business.businessCategoryId, userId },
    });
    if (stored) return stored.id;
  }
  const name = normalizeCategoryName(BUSINESS_CATEGORY_NAME);
  const count = await tx.category.count({ where: { userId } });
  const category = await tx.category.upsert({
    where: { userId_name: { userId, name } },
    update: {},
    create: { userId, name, color: nextCategoryColor(count), usageCount: 0 },
  });
  await tx.business.update({
    where: { id: business.id },
    data: { businessCategoryId: category.id },
  });
  return category.id;
}
