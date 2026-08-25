-- AlterTable
ALTER TABLE "top_up_requests" ADD COLUMN     "auto_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expires_at" TIMESTAMP(3);
