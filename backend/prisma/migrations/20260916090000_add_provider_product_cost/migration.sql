ALTER TABLE "provider_products"
ADD COLUMN "cost_minor" INTEGER,
ADD COLUMN "price_updated_at" TIMESTAMP(3);

CREATE INDEX "provider_products_product_id_is_active_cost_minor_priority_idx"
ON "provider_products"("product_id", "is_active", "cost_minor", "priority");
