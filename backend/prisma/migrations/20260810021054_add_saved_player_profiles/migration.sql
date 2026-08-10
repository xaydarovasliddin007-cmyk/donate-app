-- CreateTable
CREATE TABLE "saved_player_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "player_id" TEXT NOT NULL,
    "server_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_player_profiles_user_id_game_id_key" ON "saved_player_profiles"("user_id", "game_id");

-- AddForeignKey
ALTER TABLE "saved_player_profiles" ADD CONSTRAINT "saved_player_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_player_profiles" ADD CONSTRAINT "saved_player_profiles_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
