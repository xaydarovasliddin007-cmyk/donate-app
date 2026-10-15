CREATE TABLE "top_up_receipts" (
  "top_up_request_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
  "image_data" BYTEA NOT NULL CHECK (octet_length("image_data") BETWEEN 1 AND 5242880),
  "delivery_status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("delivery_status" IN ('PENDING', 'SENT', 'FAILED')),
  "telegram_message_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" TIMESTAMP(3),
  CONSTRAINT "top_up_receipts_pkey" PRIMARY KEY ("top_up_request_id"),
  CONSTRAINT "top_up_receipts_top_up_request_id_fkey" FOREIGN KEY ("top_up_request_id") REFERENCES "top_up_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
