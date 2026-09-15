ALTER TABLE "users" ADD COLUMN "telegram_id" TEXT;
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");
ALTER TABLE "products" ADD COLUMN "stars_price" INTEGER;
ALTER TABLE "products" ADD CONSTRAINT "products_stars_price_positive" CHECK ("stars_price" IS NULL OR "stars_price" BETWEEN 1 AND 100000);
ALTER TABLE "payments" ADD COLUMN "checkout_url" TEXT;
ALTER TABLE "payments" ADD COLUMN "telegram_charge_id" TEXT;
CREATE UNIQUE INDEX "payments_telegram_charge_id_key" ON "payments"("telegram_charge_id");
