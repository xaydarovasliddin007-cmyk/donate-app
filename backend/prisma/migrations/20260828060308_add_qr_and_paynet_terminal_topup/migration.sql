-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "receiving_method_type" ADD VALUE 'QR_CODE';
ALTER TYPE "receiving_method_type" ADD VALUE 'PAYNET_TERMINAL';

-- AlterTable
ALTER TABLE "receiving_methods" ADD COLUMN     "qr_payload" TEXT,
ALTER COLUMN "card_number" DROP NOT NULL;
