UPDATE "products" AS p
SET "amount_minor" = prices.amount_minor,
    "updated_at" = CURRENT_TIMESTAMP
FROM "games" AS g
, "game_servers" AS gs
, (
  VALUES
    ('55 (50+5) Diamonds x2', 950000),
    ('165 (150+15) Diamonds x2', 2850000),
    ('275 (250+25) Diamonds x2', 4550000),
    ('565 (500+65) Diamonds x2', 9500000),
    ('Weekly Elite Pack', 1000000),
    ('Monthly Elite Pack', 4900000),
    ('Weekly Pass', 1750000),
    ('Twilight Pass', 9900000),
    ('86 (78+8) Diamonds', 1450000),
    ('172 (156+16) Diamonds', 2800000),
    ('257 (234+23) Diamonds', 4200000),
    ('706 (625+81) Diamonds', 11500000),
    ('2195 (1860+335) Diamonds', 34500000),
    ('3688 (3099+589) Diamonds', 57500000),
    ('5532 (4649+883) Diamonds', 87000000),
    ('9288 (7740+1548) Diamonds', 145000000)
) AS prices(name, amount_minor)
WHERE g."slug" = 'mobile-legends'
  AND gs."game_id" = g."id"
  AND gs."code" = 'GLOBAL'
  AND p."game_id" = g."id"
  AND p."server_id" = gs."id"
  AND p."name" = prices.name;
