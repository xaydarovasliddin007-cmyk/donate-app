UPDATE "products" AS p
SET "amount_minor" = prices.amount_minor,
    "updated_at" = CURRENT_TIMESTAMP
FROM "games" AS g,
     "game_servers" AS gs,
     (
       VALUES
         ('55 (50+5) Diamonds x2', 980000),
         ('165 (150+15) Diamonds x2', 2900000),
         ('275 (250+25) Diamonds x2', 4600000),
         ('565 (500+65) Diamonds x2', 9600000),
         ('Weekly Elite Pack', 1100000),
         ('Monthly Elite Pack', 5100000),
         ('Weekly Pass', 1860000),
         ('Twilight Pass', 10500000),
         ('86 (78+8) Diamonds', 1550000),
         ('172 (156+16) Diamonds', 2980000),
         ('257 (234+23) Diamonds', 4400000),
         ('706 (625+81) Diamonds', 12200000),
         ('2195 (1860+335) Diamonds', 36400000),
         ('3688 (3099+589) Diamonds', 60500000),
         ('5532 (4649+883) Diamonds', 91500000),
         ('9288 (7740+1548) Diamonds', 152000000)
     ) AS prices(name, amount_minor)
WHERE g."slug" = 'mobile-legends'
  AND gs."game_id" = g."id"
  AND gs."code" = 'GLOBAL'
  AND p."game_id" = g."id"
  AND p."server_id" = gs."id"
  AND p."name" = prices.name;
