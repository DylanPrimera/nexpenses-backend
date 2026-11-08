import type { Prisma } from '@prisma/client';

export type SupplementUser = {
  id: string;
  cycleStartedAt: Date;
  keptBusinessAmount: number;
  keptBusinessCycleStartedAt: Date | null;
};

type SupplementClient = {
  businessIncome: Pick<Prisma.TransactionClient['businessIncome'], 'aggregate'>;
};

export function keptBusinessAmountForCycle(user: SupplementUser): number {
  const keptCycle = user.keptBusinessCycleStartedAt;
  if (!keptCycle) return 0;
  return keptCycle.getTime() === user.cycleStartedAt.getTime()
    ? user.keptBusinessAmount
    : 0;
}

export async function getBusinessSupplement(
  db: SupplementClient,
  user: SupplementUser,
): Promise<number> {
  const added = await db.businessIncome.aggregate({
    where: {
      business: { userId: user.id },
      addedToCycleStartedAt: user.cycleStartedAt,
    },
    _sum: { amount: true },
  });
  return (added._sum.amount ?? 0) + keptBusinessAmountForCycle(user);
}
