-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('TC', 'CONSUMO');

-- CreateEnum
CREATE TYPE "CreditProvider" AS ENUM ('NU', 'LULO', 'ICETEX', 'BANCO_BOGOTA', 'GENERIC');

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "provider" "CreditProvider" NOT NULL,
    "bankName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "productRef" TEXT,
    "cutoffDate" TIMESTAMP(3),
    "nextPaymentDate" TIMESTAMP(3),
    "daysPastDue" INTEGER NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(14,2) NOT NULL,
    "periodInterest" DECIMAL(14,2),
    "insuranceOrOtherCharges" DECIMAL(14,2),
    "rateEa" DECIMAL(8,4),
    "rateMv" DECIMAL(8,4),
    "creditLimit" DECIMAL(14,2),
    "availableCredit" DECIMAL(14,2),
    "usedAmount" DECIMAL(14,2),
    "minPayment" DECIMAL(14,2),
    "amountDueThisPeriod" DECIMAL(14,2),
    "installmentAmount" DECIMAL(14,2),
    "installmentCurrent" INTEGER,
    "installmentTotal" INTEGER,
    "originalAmount" DECIMAL(14,2),
    "termMonths" INTEGER,
    "installmentType" TEXT,
    "stage" TEXT,
    "rawExtract" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "creditId" TEXT,
ADD COLUMN "creditBalanceApplied" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "creditInstallmentAdvanced" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Credit_userId_idx" ON "Credit"("userId");

-- CreateIndex
CREATE INDEX "Credit_userId_nextPaymentDate_idx" ON "Credit"("userId", "nextPaymentDate");

-- CreateIndex
CREATE INDEX "Expense_creditId_idx" ON "Expense"("creditId");

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
