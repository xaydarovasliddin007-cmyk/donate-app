CREATE TABLE "telegram_top_up_reviews" (
  "id" UUID NOT NULL,
  "top_up_request_id" UUID NOT NULL,
  "chat_id" TEXT NOT NULL,
  "receipt_message_id" INTEGER NOT NULL,
  "trigger_callback_id" TEXT NOT NULL,
  "prompt_message_id" INTEGER,
  "confirmation_message_id" INTEGER,
  "amount_minor" INTEGER,
  "review_note" TEXT,
  "state" TEXT NOT NULL DEFAULT 'AMOUNT',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telegram_top_up_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_top_up_reviews_amount_check" CHECK ("amount_minor" IS NULL OR "amount_minor" BETWEEN 1 AND 2000000000),
  CONSTRAINT "telegram_top_up_reviews_state_check" CHECK ("state" IN ('AMOUNT', 'REASON', 'READY', 'APPLIED', 'CANCELLED')),
  CONSTRAINT "telegram_top_up_reviews_request_fkey" FOREIGN KEY ("top_up_request_id") REFERENCES "top_up_requests"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "telegram_top_up_reviews_trigger_callback_id_key" ON "telegram_top_up_reviews"("trigger_callback_id");
CREATE INDEX "telegram_top_up_reviews_chat_id_prompt_message_id_idx" ON "telegram_top_up_reviews"("chat_id", "prompt_message_id");
CREATE INDEX "telegram_top_up_reviews_expires_at_idx" ON "telegram_top_up_reviews"("expires_at");
