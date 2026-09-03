-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discount_percent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "discount_percent" INTEGER NOT NULL DEFAULT 0;
