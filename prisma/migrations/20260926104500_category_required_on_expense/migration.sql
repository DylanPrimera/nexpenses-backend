-- Reverse 20260926104000_category_optional_on_expense: restore required categories and restrictive deletes
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_categoryId_fkey";

ALTER TABLE "Expense" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
