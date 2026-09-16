CREATE TYPE "card_network" AS ENUM ('HUMO', 'UZCARD');
CREATE TYPE "top_up_channel" AS ENUM ('HUMO', 'UZCARD', 'BANKOMAT');

ALTER TABLE "receiving_methods" ADD COLUMN "card_network" "card_network";
ALTER TABLE "top_up_requests" ADD COLUMN "channel" "top_up_channel";

-- Classify only real-looking legacy cards. The development placeholder must
-- never become an enabled automatic payment destination in production.
UPDATE "receiving_methods"
SET "card_network" = CASE
  WHEN regexp_replace(COALESCE("card_number", ''), '\\D', '', 'g') LIKE '9860%' THEN 'HUMO'::"card_network"
  WHEN regexp_replace(COALESCE("card_number", ''), '\\D', '', 'g') LIKE '8600%' THEN 'UZCARD'::"card_network"
  ELSE NULL
END
WHERE "type" = 'CARD_TRANSFER'
  AND lower("card_holder_name") NOT LIKE '%dev placeholder%';

CREATE INDEX "receiving_methods_type_card_network_is_active_idx"
ON "receiving_methods"("type", "card_network", "is_active");

CREATE INDEX "top_up_requests_channel_status_amount_minor_idx"
ON "top_up_requests"("channel", "status", "amount_minor");
