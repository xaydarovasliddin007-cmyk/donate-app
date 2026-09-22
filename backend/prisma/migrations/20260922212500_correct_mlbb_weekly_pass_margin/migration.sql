UPDATE "products" AS p
SET "amount_minor" = 1950000,
    "updated_at" = CURRENT_TIMESTAMP
FROM "games" AS g
, "game_servers" AS gs
WHERE g."slug" = 'mobile-legends'
  AND gs."game_id" = g."id"
  AND gs."code" = 'GLOBAL'
  AND p."game_id" = g."id"
  AND p."server_id" = gs."id"
  AND p."name" = 'Weekly Pass';
