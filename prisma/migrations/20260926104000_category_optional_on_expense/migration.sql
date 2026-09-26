-- AlterTable: make Expense.categoryId optional and SetNull on category delete
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_categoryId_fkey";

ALTER TABLE "Expense" ALTER COLUMN "categoryId" DROP NOT NULL;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
