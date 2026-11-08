-- AlterTable
ALTER TABLE "Business" ADD COLUMN "businessCategoryId" TEXT;

-- CreateTable
CREATE TABLE "BusinessExpense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "spentOn" DATE NOT NULL,
    "paymentMethod" "BusinessPaymentMethod" NOT NULL,
    "bankName" TEXT,
    "personalExpenseId" TEXT,
    "personalCycleStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessExpense_personalExpenseId_key" ON "BusinessExpense"("personalExpenseId");

-- CreateIndex
CREATE INDEX "BusinessExpense_businessId_spentOn_idx" ON "BusinessExpense"("businessId", "spentOn");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_businessCategoryId_fkey" FOREIGN KEY ("businessCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessExpense" ADD CONSTRAINT "BusinessExpense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessExpense" ADD CONSTRAINT "BusinessExpense_personalExpenseId_fkey" FOREIGN KEY ("personalExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "BusinessExpense" ADD CONSTRAINT "BusinessExpense_amount_check" CHECK ("amount" > 0);

-- AddCheckConstraint
ALTER TABLE "BusinessExpense" ADD CONSTRAINT "BusinessExpense_bankName_check" CHECK ("bankName" IS NULL OR "paymentMethod" = 'transfer');
