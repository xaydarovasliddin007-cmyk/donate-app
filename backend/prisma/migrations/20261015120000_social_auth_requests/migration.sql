CREATE TABLE "social_auth_requests" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('google', 'telegram')),
  "intent" TEXT NOT NULL CHECK ("intent" IN ('login', 'link')),
  "locale" TEXT NOT NULL DEFAULT 'uz',
  "request_secret_hash" TEXT NOT NULL,
  "code_hash" TEXT,
  "identity" JSONB,
  "target_user_id" UUID,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "social_auth_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_auth_requests_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "social_auth_requests_expires_at_idx" ON "social_auth_requests"("expires_at");
CREATE INDEX "social_auth_requests_target_user_id_idx" ON "social_auth_requests"("target_user_id");
