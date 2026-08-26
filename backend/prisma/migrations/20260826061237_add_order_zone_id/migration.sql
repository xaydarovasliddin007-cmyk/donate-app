-- DropForeignKey
ALTER TABLE "top_up_requests" DROP CONSTRAINT "top_up_requests_receiving_method_id_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "zone_id" TEXT;

-- AddForeignKey
ALTER TABLE "top_up_requests" ADD CONSTRAINT "top_up_requests_receiving_method_id_fkey" FOREIGN KEY ("receiving_method_id") REFERENCES "receiving_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
