-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "creditDueBefore" TIMESTAMP(3),
ADD COLUMN "creditDaysPastDueBefore" INTEGER;

-- AlterTable
ALTER TABLE "Credit" ADD COLUMN "paymentDay" INTEGER;
