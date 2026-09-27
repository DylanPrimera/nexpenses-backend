-- CreateTable
CREATE TABLE "ProcessedInboundEmail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expenseId" TEXT,

    CONSTRAINT "ProcessedInboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedInboundEmail_messageId_key" ON "ProcessedInboundEmail"("messageId");

-- CreateIndex
CREATE INDEX "ProcessedInboundEmail_userId_idx" ON "ProcessedInboundEmail"("userId");

-- CreateIndex
CREATE INDEX "ProcessedInboundEmail_processedAt_idx" ON "ProcessedInboundEmail"("processedAt");

-- AddForeignKey
ALTER TABLE "ProcessedInboundEmail" ADD CONSTRAINT "ProcessedInboundEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedInboundEmail" ADD CONSTRAINT "ProcessedInboundEmail_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
