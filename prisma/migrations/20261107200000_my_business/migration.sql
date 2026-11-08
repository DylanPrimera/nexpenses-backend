-- CreateEnum
CREATE TYPE "BusinessPaymentMethod" AS ENUM ('cash', 'transfer');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "keptBusinessAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "keptBusinessCycleStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessIncome" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientName" TEXT,
    "amount" INTEGER NOT NULL,
    "collectedOn" DATE NOT NULL,
    "paymentMethod" "BusinessPaymentMethod" NOT NULL,
    "bankName" TEXT,
    "addedToCycleStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_userId_key" ON "Business"("userId");

-- CreateIndex
CREATE INDEX "BusinessIncome_businessId_collectedOn_idx" ON "BusinessIncome"("businessId", "collectedOn");

-- CreateIndex
CREATE INDEX "BusinessIncome_businessId_addedToCycleStartedAt_idx" ON "BusinessIncome"("businessId", "addedToCycleStartedAt");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessIncome" ADD CONSTRAINT "BusinessIncome_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "User" ADD CONSTRAINT "User_keptBusinessAmount_check" CHECK ("keptBusinessAmount" >= 0);

-- AddCheckConstraint
ALTER TABLE "BusinessIncome" ADD CONSTRAINT "BusinessIncome_amount_check" CHECK ("amount" > 0);

-- AddCheckConstraint
ALTER TABLE "BusinessIncome" ADD CONSTRAINT "BusinessIncome_bankName_check" CHECK ("bankName" IS NULL OR "paymentMethod" = 'transfer');
