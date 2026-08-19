-- DropIndex
DROP INDEX "products_game_id_idx";

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "logo_url" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "server_id" UUID;

-- CreateTable
CREATE TABLE "game_servers" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_servers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_servers_game_id_idx" ON "game_servers"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_servers_game_id_code_key" ON "game_servers"("game_id", "code");

-- CreateIndex
CREATE INDEX "products_game_id_server_id_idx" ON "products"("game_id", "server_id");

-- AddForeignKey
ALTER TABLE "game_servers" ADD CONSTRAINT "game_servers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "game_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
