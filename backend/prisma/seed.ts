// Development seed data — safe to re-run (everything is an upsert).
// Prices below are clearly-marked test/dev values (Product.isTest = true),
// not real provider prices. Run with: npm run prisma:seed
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // --- Providers ------------------------------------------------------------
  const topupProvider = await prisma.provider.upsert({
    where: { code: 'DEV_MOCK_TOPUP' },
    update: {},
    create: {
      code: 'DEV_MOCK_TOPUP',
      name: 'Dev Mock Top-up Provider',
      type: 'TOPUP',
      isActive: true,
      healthStatus: 'HEALTHY',
      lastCheckedAt: new Date(),
    },
  });

  await prisma.provider.upsert({
    where: { code: 'DEV_MOCK_PAYMENT' },
    update: {},
    create: {
      code: 'DEV_MOCK_PAYMENT',
      name: 'Dev Mock Payment Provider',
      type: 'PAYMENT',
      isActive: true,
      healthStatus: 'HEALTHY',
      lastCheckedAt: new Date(),
    },
  });

  // Real gateways — inactive by default. An admin flips isActive on once
  // PAYME_*/CLICK_* env vars are set and the adapter has been verified
  // against the provider's sandbox (see backend/.env.example).
  await prisma.provider.upsert({
    where: { code: 'PAYME' },
    update: {},
    create: { code: 'PAYME', name: 'Payme', type: 'PAYMENT', isActive: false, healthStatus: 'UNKNOWN' },
  });
  await prisma.provider.upsert({
    where: { code: 'CLICK' },
    update: {},
    create: { code: 'CLICK', name: 'Click', type: 'PAYMENT', isActive: false, healthStatus: 'UNKNOWN' },
  });
  await prisma.provider.upsert({
    where: { code: 'DIGIFLAZZ' },
    update: {},
    create: { code: 'DIGIFLAZZ', name: 'Digiflazz', type: 'TOPUP', isActive: false, healthStatus: 'UNKNOWN' },
  });
  await prisma.provider.upsert({
    where: { code: 'APIGAMES' },
    update: {},
    create: { code: 'APIGAMES', name: 'Apigames.id', type: 'TOPUP', isActive: false, healthStatus: 'UNKNOWN' },
  });
  const fazercardsProvider = await prisma.provider.upsert({
    where: { code: 'FAZERCARDS' },
    update: { isActive: true, healthStatus: 'HEALTHY', lastCheckedAt: new Date() },
    create: {
      code: 'FAZERCARDS',
      name: 'FazerCards',
      type: 'TOPUP',
      isActive: true,
      healthStatus: 'HEALTHY',
      lastCheckedAt: new Date(),
    },
  });

  // --- Games & catalog ---------------------------------------------------------
  //
  // Icons link each game's real official Google Play Store listing icon
  // (play-lh.googleusercontent.com) — standard practice for top-up
  // resellers, nothing downloaded/bundled. Prices are a deliberately
  // uniform 5-tier ladder (isTest: true) — not copied from any real
  // supplier or competitor — meant to be replaced once a real top-up
  // supplier is connected (see Product.isTest doc comment in schema.prisma).
  interface SeedTier {
    code: string;
    name: string;
    amountMinor: number;
    // "<category_id>:<offer_id>" from FazerCards' live catalog — set only
    // for games priced from real FazerCards data (see realTier() below).
    // Everything else stays on the DEV_MOCK_TOPUP-only placeholder ladder.
    fazercardsCode?: string;
  }
  interface SeedServer {
    name: string;
    code: string;
    // Per-server product ladder override — for games where different
    // regions are genuinely different FazerCards categories with their own
    // catalog/pricing (e.g. MLBB's mobile_legends_ru vs _turkey vs
    // _global), not just a cosmetic label. Falls back to the game's shared
    // `products` list when omitted (every other game's server picker).
    products?: SeedTier[];
  }
  interface SeedGame {
    slug: string;
    name: string;
    category: string;
    logoEmoji: string;
    logoUrl?: string;
    availability: 'ACTIVE' | 'COMING_SOON';
    servers?: SeedServer[];
    products: SeedTier[];
  }

  // Est.-priced tiers for games where the real denomination ladder and price
  // is known (official storefront tiers, or a checked competitor) but no
  // FazerCards category/SKU has been confirmed yet (its wholesale price list
  // for these is gated behind a live account — ours is currently inactive).
  // Unlike the old flat placeholder ladder this replaced (every game's tiers
  // mapped onto the same 1.5M/2.9M/4.3M/8.5M/17M so'm regardless of what the
  // amount actually was — e.g. 80 Clash of Clans Gems, worth about $1, was
  // priced at 1,500,000 so'm), these are real numbers. isTest stays true
  // (no fazercardsCode) until a real provider code is wired up, so nothing
  // here is customer-visible in production yet — see games.service.ts's
  // isProduction-gated isTest filter.
  const estTier = (code: string, name: string, sellUzs: number): SeedTier => ({
    code,
    name,
    amountMinor: sellUzs * 100,
  });

  // Real-priced tiers for games actually wired to the FazerCards live
  // catalog (see backend/README.md "FazerCards top-up setup") — the only
  // difference from estTier() above is a confirmed fazercardsCode, which is
  // what actually makes a product real (isTest: false) rather than the
  // price itself. sellUzs is a real UZS retail price (already *100 into
  // minor units/tiyin) chosen to
  // sit close to a known competitor's price for the same package where one
  // was checked (BekPinBot, MLBB), or a comparable ~10% margin over the
  // live FazerCards USD cost otherwise (snapshot rate ~11,950 UZS/USD,
  // 2026-08-28 — re-check periodically, this isn't pegged to a live rate).
  const realTier = (code: string, name: string, sellUzs: number, fazercardsCode: string): SeedTier => ({
    code,
    name,
    amountMinor: sellUzs * 100,
    fazercardsCode,
  });

  const seedGames: SeedGame[] = [
    {
      slug: 'mobile-legends',
      name: 'Mobile Legends: Bang Bang',
      category: 'MOBA',
      logoEmoji: '⚔️',
      logoUrl:
        'https://play-lh.googleusercontent.com/D8r13ijO9c-0_1N-CP4d63mR1w6YhDuR2mBQUl27ELJAx0sKdaKtM5vCUnSLODKBVzUx7rZ9cW4Ir9jYiufsSQ=s256',
      availability: 'ACTIVE',
      // Six real regional servers, matching BekPinBot's own tab list
      // (checked 2026-08-29: UZ/Global, RU, TR, SG, MY, ID) — each one is a
      // genuinely distinct FazerCards category (mobile_legends_global vs
      // _ru vs _turkey vs _singapore vs _malaysia vs _indonesia) with its
      // own catalog and its own USD pricing, not a relabeled duplicate of
      // Global. Per-region UZS prices below are ~10% margin over each
      // category's live FazerCards USD offer at the ~11,950 UZS/USD
      // snapshot rate already used for Global, rounded to a clean number.
      // The picker's default (first entry) is Global — correct per the
      // requirement that ~90% of buyers here are on UZ/Global accounts.
      servers: [
        { name: 'Global (UZ)', code: 'GLOBAL' },
        {
          name: 'Russia',
          code: 'RU',
          products: [
            realTier('MLBB_RU_WEEKLY_PASS', 'Weekly Pass', 24_000, 'mobile_legends_ru:weekly_pass'),
            realTier('MLBB_RU_SUPER_VALUE', 'Super Value Pass', 14_000, 'mobile_legends_ru:super_value_pass'),
            realTier('MLBB_RU_35', '35 Diamonds', 7_500, 'mobile_legends_ru:35_diamonds'),
            realTier('MLBB_RU_55', '55 Diamonds', 12_000, 'mobile_legends_ru:55_diamonds'),
            realTier('MLBB_RU_165', '165 Diamonds', 36_000, 'mobile_legends_ru:165_diamonds'),
            realTier('MLBB_RU_275', '275 Diamonds', 60_000, 'mobile_legends_ru:275_diamonds'),
            realTier('MLBB_RU_565', '565 Diamonds', 120_000, 'mobile_legends_ru:565_diamonds'),
            realTier('MLBB_RU_1155', '1155 Diamonds', 241_000, 'mobile_legends_ru:1155_diamonds'),
            realTier('MLBB_RU_1765', '1765 Diamonds', 360_000, 'mobile_legends_ru:1765_diamonds'),
            realTier('MLBB_RU_2975', '2975 Diamonds', 601_000, 'mobile_legends_ru:2975_diamonds'),
            realTier('MLBB_RU_6000', '6000 Diamonds', 1_200_000, 'mobile_legends_ru:6000_diamonds'),
          ],
        },
        {
          name: 'Turkey',
          code: 'TR',
          products: [
            realTier('MLBB_TR_WEEKLY_ELITE', 'Weekly Elite Pack', 11_000, 'mobile_legends_turkey:weekly_elite_pack'),
            realTier('MLBB_TR_WEEKLY_PASS', 'Weekly Pass', 24_000, 'mobile_legends_turkey:weekly_pass'),
            realTier('MLBB_TR_MONTHLY_ELITE', 'Monthly Elite Pack', 55_000, 'mobile_legends_turkey:monthly_elite_pack'),
            realTier('MLBB_TR_TWILIGHT_PASS', 'Twilight Pass', 105_000, 'mobile_legends_turkey:twilight_pass'),
            realTier('MLBB_TR_LIMITED_VALUE', 'Limited-Time Value Pack', 2_600, 'mobile_legends_turkey:limited_time_value_pack'),
            realTier('MLBB_TR_16', '16 Diamonds', 3_100, 'mobile_legends_turkey:16_diamonds'),
            realTier('MLBB_TR_24', '24 Diamonds', 4_600, 'mobile_legends_turkey:24_diamonds'),
            realTier('MLBB_TR_44', '44 Diamonds', 8_500, 'mobile_legends_turkey:44_diamonds'),
            realTier('MLBB_TR_88', '88 Diamonds', 17_000, 'mobile_legends_turkey:88_diamonds'),
            realTier('MLBB_TR_133', '133 Diamonds', 25_500, 'mobile_legends_turkey:133_diamonds'),
            realTier('MLBB_TR_221', '221 Diamonds', 42_500, 'mobile_legends_turkey:221_diamonds'),
            realTier('MLBB_TR_494', '494 Diamonds', 94_000, 'mobile_legends_turkey:494_diamonds'),
            realTier('MLBB_TR_1041', '1041 Diamonds', 189_000, 'mobile_legends_turkey:1041_diamonds'),
            realTier('MLBB_TR_2645', '2645 Diamonds', 471_000, 'mobile_legends_turkey:2645_diamonds'),
            realTier('MLBB_TR_6146', '6146 Diamonds', 1_075_000, 'mobile_legends_turkey:6146_diamonds'),
          ],
        },
        {
          name: 'Singapore',
          code: 'SG',
          products: [
            realTier('MLBB_SG_55_x2', '55 (50+5) Diamonds x2', 12_000, 'mobile_legends_singapore:50_5_diamonds_first_top_up_bonus'),
            realTier('MLBB_SG_165_x2', '165 (150+15) Diamonds x2', 35_500, 'mobile_legends_singapore:150_15_diamonds_first_top_up_bonus'),
            realTier('MLBB_SG_275_x2', '275 (250+25) Diamonds x2', 59_000, 'mobile_legends_singapore:250_25_diamonds_first_top_up_bonus'),
            realTier('MLBB_SG_565_x2', '565 (500+65) Diamonds x2', 120_000, 'mobile_legends_singapore:500_65_diamonds_first_top_up_bonus'),
            realTier('MLBB_SG_WEEKLY_ELITE', 'Weekly Elite Pack', 12_000, 'mobile_legends_singapore:weekly_elite_pack'),
            realTier('MLBB_SG_WEEKLY_PASS', 'Weekly Pass', 26_000, 'mobile_legends_singapore:weekly_pass'),
            realTier('MLBB_SG_MONTHLY_ELITE', 'Monthly Elite Pack', 59_000, 'mobile_legends_singapore:monthly_elite_pack'),
            realTier('MLBB_SG_5', '5 Diamonds', 1_100, 'mobile_legends_singapore:5_diamonds'),
            realTier('MLBB_SG_14', '14 (13+1) Diamonds', 3_000, 'mobile_legends_singapore:13_1_diamonds'),
            realTier('MLBB_SG_42', '42 (38+4) Diamonds', 9_000, 'mobile_legends_singapore:38_4_diamonds'),
            realTier('MLBB_SG_70', '70 (64+6) Diamonds', 15_000, 'mobile_legends_singapore:64_6_diamonds'),
            realTier('MLBB_SG_140', '140 (127+13) Diamonds', 30_500, 'mobile_legends_singapore:127_13_diamonds'),
            realTier('MLBB_SG_284', '284 (254+30) Diamonds', 61_000, 'mobile_legends_singapore:254_30_diamonds'),
            realTier('MLBB_SG_355', '355 (317+38) Diamonds', 76_000, 'mobile_legends_singapore:317_38_diamonds'),
            realTier('MLBB_SG_429', '429 (383+46) Diamonds', 91_000, 'mobile_legends_singapore:383_46_diamonds'),
            realTier('MLBB_SG_716', '716 (633+83) Diamonds', 152_000, 'mobile_legends_singapore:633_83_diamonds'),
            realTier('MLBB_SG_1084', '1084 (940+144) Diamonds', 233_000, 'mobile_legends_singapore:940_144_diamonds'),
            realTier('MLBB_SG_1446', '1446 (1252+194) Diamonds', 304_000, 'mobile_legends_singapore:1252_194_diamonds'),
            realTier('MLBB_SG_2976', '2976 (2501+475) Diamonds', 609_000, 'mobile_legends_singapore:2501_475_diamonds'),
            realTier('MLBB_SG_7502', '7502 (6252+1250) Diamonds', 1_510_000, 'mobile_legends_singapore:6252_1250_diamonds'),
          ],
        },
        {
          name: 'Malaysia',
          code: 'MY',
          products: [
            realTier('MLBB_MY_55_x2', '55 (50+5) Diamonds x2', 12_000, 'mobile_legends_malaysia:50_5_diamonds_first_top_up_bonus'),
            realTier('MLBB_MY_165_x2', '165 (150+15) Diamonds x2', 35_500, 'mobile_legends_malaysia:150_15_diamonds_first_top_up_bonus'),
            realTier('MLBB_MY_275_x2', '275 (250+25) Diamonds x2', 59_000, 'mobile_legends_malaysia:250_25_diamonds_first_top_up_bonus'),
            realTier('MLBB_MY_565_x2', '565 (500+65) Diamonds x2', 120_000, 'mobile_legends_malaysia:500_65_diamonds_first_top_up_bonus'),
            realTier('MLBB_MY_WEEKLY_ELITE', 'Weekly Elite Pack', 12_000, 'mobile_legends_malaysia:weekly_elite_pack'),
            realTier('MLBB_MY_WEEKLY_PASS', 'Weekly Pass', 26_000, 'mobile_legends_malaysia:weekly_pass'),
            realTier('MLBB_MY_MONTHLY_ELITE', 'Monthly Elite Pack', 59_000, 'mobile_legends_malaysia:monthly_elite_pack'),
            realTier('MLBB_MY_TWILIGHT_PASS', 'Twilight Pass', 112_000, 'mobile_legends_malaysia:twilight_pass'),
            realTier('MLBB_MY_5', '5 Diamonds', 1_100, 'mobile_legends_malaysia:5_diamonds'),
            realTier('MLBB_MY_14', '14 (13+1) Diamonds', 3_000, 'mobile_legends_malaysia:13_1_diamonds'),
            realTier('MLBB_MY_42', '42 (38+4) Diamonds', 9_000, 'mobile_legends_malaysia:38_4_diamonds'),
            realTier('MLBB_MY_70', '70 (64+6) Diamonds', 15_000, 'mobile_legends_malaysia:64_6_diamonds'),
            realTier('MLBB_MY_140', '140 (127+13) Diamonds', 30_500, 'mobile_legends_malaysia:127_13_diamonds'),
            realTier('MLBB_MY_284', '284 (254+30) Diamonds', 61_000, 'mobile_legends_malaysia:254_30_diamonds'),
            realTier('MLBB_MY_355', '355 (317+38) Diamonds', 76_000, 'mobile_legends_malaysia:317_38_diamonds'),
            realTier('MLBB_MY_429', '429 (383+46) Diamonds', 91_000, 'mobile_legends_malaysia:383_46_diamonds'),
            realTier('MLBB_MY_716', '716 (633+83) Diamonds', 152_000, 'mobile_legends_malaysia:633_83_diamonds'),
            realTier('MLBB_MY_1084', '1084 (940+144) Diamonds', 229_000, 'mobile_legends_malaysia:940_144_diamonds'),
            realTier('MLBB_MY_1446', '1446 (1252+194) Diamonds', 295_000, 'mobile_legends_malaysia:1252_194_diamonds'),
            realTier('MLBB_MY_2976', '2976 (2501+475) Diamonds', 609_000, 'mobile_legends_malaysia:2501_475_diamonds'),
            realTier('MLBB_MY_7502', '7502 (6252+1250) Diamonds', 1_510_000, 'mobile_legends_malaysia:6252_1250_diamonds'),
          ],
        },
        {
          name: 'Indonesia',
          code: 'ID',
          products: [
            realTier('MLBB_ID_100_x2', '100 (50+50) Diamonds x2', 11_500, 'mobile_legends_indonesia:50_50_diamonds_first_top_up_bonus'),
            realTier('MLBB_ID_300_x2', '300 (150+150) Diamonds x2', 34_500, 'mobile_legends_indonesia:150_150_diamonds_first_top_up_bonus'),
            realTier('MLBB_ID_500_x2', '500 (250+250) Diamonds x2', 58_000, 'mobile_legends_indonesia:250_250_diamonds_first_top_up_bonus'),
            realTier('MLBB_ID_1000_x2', '1000 (500+500) Diamonds x2', 117_000, 'mobile_legends_indonesia:500_500_diamonds_first_top_up_bonus'),
            realTier('MLBB_ID_WEEKLY_ELITE', 'Weekly Elite Pack', 12_000, 'mobile_legends_indonesia:weekly_elite_pack'),
            realTier('MLBB_ID_WEEKLY_PASS', 'Weekly Pass', 22_500, 'mobile_legends_indonesia:weekly_pass'),
            realTier('MLBB_ID_MONTHLY_ELITE', 'Monthly Elite Pack', 58_000, 'mobile_legends_indonesia:monthly_elite_pack'),
            realTier('MLBB_ID_TWILIGHT_PASS', 'Twilight Pass', 111_000, 'mobile_legends_indonesia:twilight_pass'),
            realTier('MLBB_ID_5', '5 Diamonds', 1_100, 'mobile_legends_indonesia:5_diamonds'),
            realTier('MLBB_ID_12', '12 (11+1) Diamonds', 2_800, 'mobile_legends_indonesia:11_1_diamonds'),
            realTier('MLBB_ID_19', '19 (17+2) Diamonds', 4_200, 'mobile_legends_indonesia:17_2_diamonds'),
            realTier('MLBB_ID_28', '28 (25+3) Diamonds', 6_000, 'mobile_legends_indonesia:25_3_diamonds'),
            realTier('MLBB_ID_44', '44 (40+4) Diamonds', 9_000, 'mobile_legends_indonesia:40_4_diamonds'),
            realTier('MLBB_ID_59', '59 (53+6) Diamonds', 12_000, 'mobile_legends_indonesia:53_6_diamonds'),
            realTier('MLBB_ID_85', '85 (77+8) Diamonds', 18_000, 'mobile_legends_indonesia:77_8_diamonds'),
            realTier('MLBB_ID_170', '170 (154+16) Diamonds', 35_000, 'mobile_legends_indonesia:154_16_diamonds'),
            realTier('MLBB_ID_240', '240 (217+23) Diamonds', 49_500, 'mobile_legends_indonesia:217_23_diamonds'),
            realTier('MLBB_ID_296', '296 (256+40) Diamonds', 61_000, 'mobile_legends_indonesia:256_40_diamonds'),
            realTier('MLBB_ID_408', '408 (367+41) Diamonds', 84_000, 'mobile_legends_indonesia:367_41_diamonds'),
            realTier('MLBB_ID_568', '568 (503+65) Diamonds', 115_000, 'mobile_legends_indonesia:503_65_diamonds'),
            realTier('MLBB_ID_875', '875 (774+101) Diamonds', 175_000, 'mobile_legends_indonesia:774_101_diamonds'),
            realTier('MLBB_ID_2010', '2010 (1708+302) Diamonds', 382_000, 'mobile_legends_indonesia:1708_302_diamonds'),
            realTier('MLBB_ID_4830', '4830 (4003+827) Diamonds', 917_000, 'mobile_legends_indonesia:4003_827_diamonds'),
          ],
        },
      ],
      // Global (UZ) — this game's default/fallback ladder, and the server
      // ~90% of buyers here actually use. Matches BekPinBot's exact
      // package list/prices (a real competitor, checked 2026-08-28) —
      // every denomination here is a confirmed exact match against a live
      // FazerCards mobile_legends_global offer. Order matches BekPinBot's
      // layout exactly: the four x2 bonus packs, then the four passes,
      // then plain diamonds smallest-to-largest.
      products: [
        realTier('MLBB_55_x2', '55 (50+5) Diamonds x2', 9_800, 'mobile_legends_global:50_5_diamonds_first_top_up_bonus'),
        realTier('MLBB_165_x2', '165 (150+15) Diamonds x2', 29_000, 'mobile_legends_global:150_15_diamonds_first_top_up_bonus'),
        realTier('MLBB_275_x2', '275 (250+25) Diamonds x2', 46_000, 'mobile_legends_global:250_25_diamonds_first_top_up_bonus'),
        realTier('MLBB_565_x2', '565 (500+65) Diamonds x2', 96_000, 'mobile_legends_global:500_65_diamonds_first_top_up_bonus'),
        realTier('MLBB_WEEKLY_ELITE', 'Weekly Elite Pack', 11_000, 'mobile_legends_global:weekly_elite_pack'),
        realTier('MLBB_MONTHLY_ELITE', 'Monthly Elite Pack', 51_000, 'mobile_legends_global:monthly_elite_pack'),
        realTier('MLBB_WEEKLY_PASS', 'Weekly Pass', 18_600, 'mobile_legends_global:weekly_pass'),
        realTier('MLBB_TWILIGHT_PASS', 'Twilight Pass', 105_000, 'mobile_legends_global:twilight_pass'),
        realTier('MLBB_86', '86 (78+8) Diamonds', 15_500, 'mobile_legends_global:78_8_diamonds'),
        realTier('MLBB_172', '172 (156+16) Diamonds', 29_800, 'mobile_legends_global:156_16_diamonds'),
        realTier('MLBB_257', '257 (234+23) Diamonds', 44_000, 'mobile_legends_global:234_23_diamonds'),
        realTier('MLBB_706', '706 (625+81) Diamonds', 122_000, 'mobile_legends_global:625_81_diamonds'),
        realTier('MLBB_2195', '2195 (1860+335) Diamonds', 364_000, 'mobile_legends_global:1860_335_diamonds'),
        realTier('MLBB_3688', '3688 (3099+589) Diamonds', 605_000, 'mobile_legends_global:3099_589_diamonds'),
        realTier('MLBB_5532', '5532 (4649+883) Diamonds', 915_000, 'mobile_legends_global:4649_883_diamonds'),
        realTier('MLBB_9288', '9288 (7740+1548) Diamonds', 1_520_000, 'mobile_legends_global:7740_1548_diamonds'),
      ],
    },
    {
      slug: 'pubg-mobile',
      name: 'PUBG Mobile',
      category: 'Battle Royale',
      logoEmoji: '🎯',
      logoUrl:
        'https://play-lh.googleusercontent.com/O8jPCZ2EXAt7wGlbZhkhA-3vPIWVBpz8tZrRnsr7uVeqp0UD1AQwIEl_N9So80kdp8gDvIksC64GypylkQV_=s256',
      availability: 'ACTIVE',
      // pubg_mobile_auto chosen over the cheaper-on-paper pubg_mobile_manual
      // category — "manual" implies non-instant/human-handled fulfillment
      // on FazerCards' side, a worse customer experience for a few % in
      // margin. ~10% margin over live FazerCards USD cost, no competitor
      // price was checked for PUBG (see chat — only MLBB was benchmarked).
      products: [
        realTier('PUBGM_60', '60 UC', 11_650, 'pubg_mobile_auto:60_uc'),
        realTier('PUBGM_325', '325 UC', 58_250, 'pubg_mobile_auto:325_uc'),
        realTier('PUBGM_660', '660 UC', 116_500, 'pubg_mobile_auto:660_uc'),
        realTier('PUBGM_1800', '1800 UC', 292_000, 'pubg_mobile_auto:1800_uc'),
        realTier('PUBGM_3850', '3850 UC', 584_000, 'pubg_mobile_auto:3850_uc'),
        realTier('PUBGM_8100', '8100 UC', 1_168_000, 'pubg_mobile_auto:8100_uc'),
      ],
    },
    {
      slug: 'free-fire',
      name: 'Free Fire',
      category: 'Battle Royale',
      logoEmoji: '🔥',
      logoUrl:
        'https://play-lh.googleusercontent.com/JT88XmsHoGDio7FxONwh382DhuTxuccfMmWFDtRBFjilySzNqWOCxUhqm8IhBKzQSwVrW2HWp_XvSgKFwi3ETA=s256',
      availability: 'ACTIVE',
      // free_fire_cis is the default/fallback server — the right supply
      // line for players in Uzbekistan/CIS — plus 6 more real FazerCards
      // regional categories (each its own catalog and USD pricing, priced
      // the same way MLBB's regional servers are: ~10% margin, rounded).
      // Every region's raw catalog is much longer than what's listed here
      // (FF_ID alone has 50+ granular diamond amounts) — trimmed to a
      // representative ladder (subscription items + ~9 evenly-spread
      // diamond amounts), same curation MLBB's servers didn't need since
      // FazerCards' own MLBB catalogs are already short.
      servers: [
        { name: 'CIS', code: 'CIS' },
        {
          name: 'Europe',
          code: 'EU',
          products: [
            realTier('FF_EU_WEEKLY_LITE', 'Weekly Lite', 3_600, 'free_fire_eu:weekly_lite'),
            realTier('FF_EU_WEEKLY_MEMBERSHIP', 'Weekly Membership', 21_500, 'free_fire_eu:weekly_membership'),
            realTier('FF_EU_25', '25 Diamonds', 3_300, 'free_fire_eu:25_diamonds'),
            realTier('FF_EU_110', '110 Diamonds', 13_000, 'free_fire_eu:110_diamonds'),
            realTier('FF_EU_231', '231 Diamonds', 25_500, 'free_fire_eu:231_diamonds'),
            realTier('FF_EU_520', '520 Diamonds', 64_000, 'free_fire_eu:520_diamonds'),
            realTier('FF_EU_583', '583 Diamonds', 64_000, 'free_fire_eu:583_diamonds'),
            realTier('FF_EU_1188', '1188 Diamonds', 128_000, 'free_fire_eu:1188_diamonds'),
            realTier('FF_EU_2180', '2180 Diamonds', 255_000, 'free_fire_eu:2180_diamonds'),
            realTier('FF_EU_5600', '5600 Diamonds', 637_000, 'free_fire_eu:5600_diamonds'),
            realTier('FF_EU_11500', '11500 Diamonds', 1_274_000, 'free_fire_eu:11500_diamonds'),
          ],
        },
        {
          name: 'Indonesia',
          code: 'ID',
          products: [
            realTier('FF_ID_WEEKLY_MEMBERSHIP', 'Weekly Membership', 20_500, 'free_fire_id:weekly_membership'),
            realTier('FF_ID_MONTHLY_MEMBERSHIP', 'Monthly Membership', 62_000, 'free_fire_id:monthly_membership'),
            realTier('FF_ID_5', '5 Diamonds', 700, 'free_fire_id:5_diamonds'),
            realTier('FF_ID_30', '30 Diamonds', 4_200, 'free_fire_id:30_diamonds'),
            realTier('FF_ID_100', '100 Diamonds', 11_000, 'free_fire_id:100_diamonds'),
            realTier('FF_ID_145', '145 Diamonds', 14_500, 'free_fire_id:145_diamonds'),
            realTier('FF_ID_280', '280 Diamonds', 28_000, 'free_fire_id:280_diamonds'),
            realTier('FF_ID_565', '565 Diamonds', 56_000, 'free_fire_id:565_diamonds'),
            realTier('FF_ID_930', '930 Diamonds', 91_000, 'free_fire_id:930_diamonds'),
            realTier('FF_ID_1080', '1080 Diamonds', 105_000, 'free_fire_id:1080_diamonds'),
            realTier('FF_ID_7290', '7290 Diamonds', 656_000, 'free_fire_id:7290_diamonds'),
          ],
        },
        {
          name: 'Malaysia/Singapore',
          code: 'MY_SG',
          products: [
            realTier('FF_MYSG_WEEKLY_LITE', 'Weekly Lite', 4_200, 'free_fire_my_sg:weekly_lite'),
            realTier('FF_MYSG_WEEKLY_MEMBERSHIP', 'Weekly Membership', 20_000, 'free_fire_my_sg:weekly_membership'),
            realTier('FF_MYSG_25', '25 Diamonds', 3_000, 'free_fire_my_sg:25_diamonds'),
            realTier('FF_MYSG_100', '100 Diamonds', 9_500, 'free_fire_my_sg:100_diamonds'),
            realTier('FF_MYSG_310', '310 Diamonds', 35_000, 'free_fire_my_sg:310_diamonds'),
            realTier('FF_MYSG_520', '520 Diamonds', 49_500, 'free_fire_my_sg:520_diamonds'),
            realTier('FF_MYSG_1060', '1060 Diamonds', 97_000, 'free_fire_my_sg:1060_diamonds'),
            realTier('FF_MYSG_2180', '2180 Diamonds', 196_000, 'free_fire_my_sg:2180_diamonds'),
            realTier('FF_MYSG_5600', '5600 Diamonds', 485_000, 'free_fire_my_sg:5600_diamonds'),
            realTier('FF_MYSG_11500', '11500 Diamonds', 999_000, 'free_fire_my_sg:11500_diamonds'),
          ],
        },
        {
          name: 'Philippines',
          code: 'PH',
          products: [
            realTier('FF_PH_20', '20 Diamonds', 2_000, 'free_fire_ph:20_diamonds'),
            realTier('FF_PH_40', '40 Diamonds', 4_100, 'free_fire_ph:40_diamonds'),
            realTier('FF_PH_100', '100 Diamonds', 10_000, 'free_fire_ph:100_diamonds'),
            realTier('FF_PH_205', '205 Diamonds', 20_000, 'free_fire_ph:205_diamonds'),
            realTier('FF_PH_420', '420 Diamonds', 40_500, 'free_fire_ph:420_diamonds'),
            realTier('FF_PH_650', '650 Diamonds', 61_000, 'free_fire_ph:650_diamonds'),
            realTier('FF_PH_1100', '1100 Diamonds', 101_000, 'free_fire_ph:1100_diamonds'),
            realTier('FF_PH_2250', '2250 Diamonds', 203_000, 'free_fire_ph:2250_diamonds'),
          ],
        },
        {
          name: 'Thailand',
          code: 'TH',
          products: [
            realTier('FF_TH_WEEKLY_PACK', 'Weekly Pack', 27_000, 'free_fire_th:weekly_pack'),
            realTier('FF_TH_MONTHLY_PACK', 'Monthly Pack', 114_000, 'free_fire_th:monthly_pack'),
            realTier('FF_TH_33', '33 Diamonds', 3_800, 'free_fire_th:33_diamonds'),
            realTier('FF_TH_68', '68 Diamonds', 7_500, 'free_fire_th:68_diamonds'),
            realTier('FF_TH_172', '172 Diamonds', 19_000, 'free_fire_th:172_diamonds'),
            realTier('FF_TH_310', '310 Diamonds', 34_500, 'free_fire_th:310_diamonds'),
            realTier('FF_TH_517', '517 Diamonds', 57_000, 'free_fire_th:517_diamonds'),
            realTier('FF_TH_690', '690 Diamonds', 77_000, 'free_fire_th:690_diamonds'),
            realTier('FF_TH_1052', '1052 Diamonds', 115_000, 'free_fire_th:1052_diamonds'),
            realTier('FF_TH_1801', '1801 Diamonds', 192_000, 'free_fire_th:1801_diamonds'),
            realTier('FF_TH_3698', '3698 Diamonds', 383_000, 'free_fire_th:3698_diamonds'),
          ],
        },
        {
          name: 'Vietnam',
          code: 'VN',
          products: [
            realTier('FF_VN_WEEKLY_LITE', 'Weekly Lite', 6_000, 'free_fire_vn:weekly_lite'),
            realTier('FF_VN_WEEKLY_MEMBERSHIP', 'Weekly Membership', 25_000, 'free_fire_vn:weekly_membership'),
            realTier('FF_VN_25', '25 Diamonds', 2_600, 'free_fire_vn:25_diamonds'),
            realTier('FF_VN_51', '51 Diamonds', 5_000, 'free_fire_vn:51_diamonds'),
            realTier('FF_VN_113', '113 Diamonds', 9_500, 'free_fire_vn:113_diamonds'),
            realTier('FF_VN_283', '283 Diamonds', 24_000, 'free_fire_vn:283_diamonds'),
            realTier('FF_VN_566', '566 Diamonds', 48_000, 'free_fire_vn:566_diamonds'),
            realTier('FF_VN_1132', '1132 Diamonds', 96_000, 'free_fire_vn:1132_diamonds'),
            realTier('FF_VN_2830', '2830 Diamonds', 241_000, 'free_fire_vn:2830_diamonds'),
          ],
        },
      ],
      // CIS — default/fallback ladder, the right supply line for players
      // in Uzbekistan/CIS. ~10% margin over live FazerCards USD cost, no
      // competitor price was checked for Free Fire.
      products: [
        realTier('FF_110', '110 Diamonds', 10_200, 'free_fire_cis:110_diamonds'),
        realTier('FF_341', '341 Diamonds', 31_000, 'free_fire_cis:341_diamonds'),
        realTier('FF_572', '572 Diamonds', 50_500, 'free_fire_cis:572_diamonds'),
        realTier('FF_1166', '1166 Diamonds', 101_200, 'free_fire_cis:1166_diamonds'),
        realTier('FF_2398', '2398 Diamonds', 202_400, 'free_fire_cis:2398_diamonds'),
        realTier('FF_6160', '6160 Diamonds', 512_700, 'free_fire_cis:6160_diamonds'),
      ],
    },
    {
      slug: 'telegram-premium',
      name: 'Telegram Premium',
      category: 'Subscription',
      logoEmoji: '✈️',
      logoUrl: 'https://play-lh.googleusercontent.com/PyZ3akMGXPV0tKKirKNwfO--PSQW3FHR6rD_H9mAaukZ8LiHyYFuBLeU8UZ2ok6r5SP79-3prkfybWKh98AZAD0=s256',
      availability: 'ACTIVE',
      // Uses FazerCards' dedicated /telegram/premium/buy endpoint (not the
      // generic /topups/order one) — see the "telegram_premium:" prefix
      // handling in fazercards-topup-provider.ts. ~10% margin over live
      // FazerCards USD cost, no competitor price was checked.
      products: [
        realTier('TG_PREMIUM_3M', 'Telegram Premium — 3 months', 160_000, 'telegram_premium:3'),
        realTier('TG_PREMIUM_6M', 'Telegram Premium — 6 months', 214_000, 'telegram_premium:6'),
        realTier('TG_PREMIUM_12M', 'Telegram Premium — 12 months', 388_000, 'telegram_premium:12'),
      ],
    },
    {
      slug: 'steam-wallet',
      name: 'Steam',
      category: 'Wallet',
      logoEmoji: '🎮',
      logoUrl: 'https://play-lh.googleusercontent.com/E_x2GPSJakCdUYfECBptVyFoVnC4BxIPy3K4OdbwNyEtEJkRAY_J-Lo_Ltiybq6LiJ_aZCIzvqLv5h4Fbk91=s256',
      availability: 'ACTIVE',
      // Preset USD amounts rather than a free-form "enter any amount"
      // flow — FazerCards' /steam-topup/order takes an arbitrary amount,
      // but modeling it as fixed Product tiers reuses the whole existing
      // catalog/order pipeline instead of a new custom-amount subsystem.
      // "Player ID" in the order flow is the buyer's Steam login for this
      // game — validatePlayer() actually checks it via
      // POST /steam-topup/check-login (see fazercards-topup-provider.ts),
      // unlike every other game's non-empty-string fallback. ~9% margin
      // over live FazerCards USD cost at the snapshot ~11,950 UZS/USD rate.
      products: [
        realTier('STEAM_5', 'Steam Wallet — $5', 65_000, 'steam_topup:USD:5'),
        realTier('STEAM_10', 'Steam Wallet — $10', 130_000, 'steam_topup:USD:10'),
        realTier('STEAM_20', 'Steam Wallet — $20', 260_000, 'steam_topup:USD:20'),
        realTier('STEAM_50', 'Steam Wallet — $50', 650_000, 'steam_topup:USD:50'),
      ],
    },
    {
      slug: 'roblox',
      name: 'Roblox',
      category: 'Sandbox',
      logoEmoji: '🧱',
      logoUrl:
        'https://play-lh.googleusercontent.com/QqZj22aXblAyYDxLQw-Gg0ycW0QkKhrDnwqgERZU9BMRXZnMlgXfq-94sikG5mEpt_I0lzZxcUzfLblmQgwYzUE=s256',
      availability: 'ACTIVE',
      // Real wholesale-USD-derived tiers (FazerCards publishes its Robux
      // wholesale price list publicly, unlike its gated game-topup
      // categories — see reseller.fazercards.com/catalog/roblox) at the
      // same ~10% margin the realTier() games use. Roblox itself doesn't
      // sell 30/170/950-style amounts — these are its actual denominations.
      products: [
        estTier('RBX_100', '100 Robux', 30_000),
        estTier('RBX_200', '200 Robux', 39_000),
        estTier('RBX_400', '400 Robux', 62_000),
        estTier('RBX_800', '800 Robux', 107_000),
        estTier('RBX_1000', '1,000 Robux', 133_000),
        estTier('RBX_1500', '1,500 Robux', 187_000),
        estTier('RBX_1700', '1,700 Robux', 225_000),
        estTier('RBX_2000', '2,000 Robux', 278_000),
        estTier('RBX_2500', '2,500 Robux', 319_000),
        estTier('RBX_4500', '4,500 Robux', 544_000),
        estTier('RBX_10000', '10,000 Robux', 1_094_000),
      ],
    },
    // No official mobile app / Play Store listing exists for Valorant —
    // kept as a coming-soon placeholder with its emoji only, same as before.
    { slug: 'valorant', name: 'Valorant', category: 'FPS', logoEmoji: '🔫', availability: 'COMING_SOON', products: [] },
    {
      slug: 'genshin-impact',
      name: 'Genshin Impact',
      category: 'RPG',
      logoEmoji: '⚡',
      logoUrl:
        'https://play-lh.googleusercontent.com/YQqyKaXX-63krqsfIzUEJWUWLINxcb5tbS6QVySdxbS7eZV7YB2dUjUvX27xA0TIGtfxQ5v-tQjwlT5tTB-O=s256',
      availability: 'ACTIVE',
      // Genshin Impact's four real official server regions. FazerCards'
      // genshin_impact_global category wants the zone as `fields.server`
      // (a select: america/asia/europe/tw_hk_mo — lowercase, unlike these
      // GameServer.code values), not `server_id` like most other games —
      // see the ":player_id:server" field-key override on fazercardsCode.
      servers: [
        { name: 'Asia', code: 'ASIA' },
        { name: 'America', code: 'AMERICA' },
        { name: 'Europe', code: 'EU' },
        { name: 'TW, HK, MO', code: 'TW_HK_MO' },
      ],
      products: [
        realTier('GENSHIN_60', '60 Genesis Crystals', 12_800, 'genshin_impact_global:60_genesis_crystals:player_id:server'),
        realTier('GENSHIN_330', '300 + 30 Genesis Crystals', 65_000, 'genshin_impact_global:300_30_genesis_crystals:player_id:server'),
        realTier('GENSHIN_1090', '980 + 110 Genesis Crystals', 194_000, 'genshin_impact_global:980_110_genesis_crystals:player_id:server'),
        realTier('GENSHIN_2240', '1980 + 260 Genesis Crystals', 389_000, 'genshin_impact_global:1980_260_genesis_crystals:player_id:server'),
        realTier('GENSHIN_3880', '3280 + 600 Genesis Crystals', 648_000, 'genshin_impact_global:3280_600_genesis_crystals:player_id:server'),
        realTier('GENSHIN_8080', '6480 + 1600 Genesis Crystals', 1_295_000, 'genshin_impact_global:6480_1600_genesis_crystals:player_id:server'),
      ],
    },
    {
      slug: 'honor-of-kings',
      name: 'Honor of Kings',
      category: 'MOBA',
      logoEmoji: '👑',
      logoUrl:
        'https://play-lh.googleusercontent.com/ySKKDO_bieWZ11fmnOD1fuDpcPgOjASwjg9Nxyut3gk9bM_QPVYnAn3G4Q7_vR76dOs0VnW_DVFE99aOqVEcaCU=s256',
      availability: 'ACTIVE',
      products: [
        realTier('HOK_80', '80 Tokens', 11_000, 'honor_of_kings:80_tokens'),
        realTier('HOK_240', '240 Tokens', 33_000, 'honor_of_kings:240_tokens'),
        realTier('HOK_400', '400 Tokens', 55_000, 'honor_of_kings:400_tokens'),
        realTier('HOK_830', '830 Tokens', 110_000, 'honor_of_kings:830_tokens'),
        realTier('HOK_1245', '1245 Tokens', 165_000, 'honor_of_kings:1245_tokens'),
        realTier('HOK_2508', '2508 Tokens', 330_000, 'honor_of_kings:2508_tokens'),
      ],
    },
    {
      slug: 'call-of-duty-mobile',
      name: 'Call of Duty: Mobile',
      category: 'FPS',
      logoEmoji: '🪖',
      logoUrl:
        'https://play-lh.googleusercontent.com/4KLtYEExeMc9gcYZz1BgAiV87IZ8onX3aGld_lJ8xMydt1MP7m--a6dn0aGNMemq-IiwGrrhqt81TA-Qbve8=s256',
      availability: 'ACTIVE',
      // codm_activision_kz (Kazakhstan) is the default/fallback — the
      // closest CIS-region CODM line FazerCards carries — plus 6 more real
      // regional categories (Activision CA/IN/SA/US, Garena SG-MY and
      // Garena Indonesia), each its own catalog/pricing. Field key is
      // user_id, not player_id, for every one of them.
      servers: [
        { name: 'Kazakhstan (CIS)', code: 'KZ' },
        {
          name: 'Canada',
          code: 'CA',
          products: [
            realTier('CODM_CA_88', '80 + 8 CP', 9_500, 'codm_activision_ca:88_cp:user_id'),
            realTier('CODM_CA_460', '400 + 60 CP', 43_000, 'codm_activision_ca:460_cp:user_id'),
            realTier('CODM_CA_960', '800 + 160 CP', 80_000, 'codm_activision_ca:960_cp:user_id'),
            realTier('CODM_CA_2600', '2000 + 600 CP', 216_000, 'codm_activision_ca:2600_cp:user_id'),
            realTier('CODM_CA_5400', '4000 + 1400 CP', 432_000, 'codm_activision_ca:5400_cp:user_id'),
            realTier('CODM_CA_11200', '8000 + 3200 CP', 1_235_000, 'codm_activision_ca:11200_cp:user_id'),
            realTier('CODM_CA_22400', '16000 + 6400 CP', 2_471_000, 'codm_activision_ca:22400_cp:user_id'),
            realTier('CODM_CA_33600', '24000 + 9600 CP', 3_707_000, 'codm_activision_ca:33600_cp:user_id'),
            realTier('CODM_CA_56000', '40000 + 16000 CP', 6_178_000, 'codm_activision_ca:56000_cp:user_id'),
          ],
        },
        {
          name: 'India',
          code: 'IN',
          products: [
            realTier('CODM_IN_88', '80 + 8 CP', 13_000, 'codm_activision_in:88_cp:user_id'),
            realTier('CODM_IN_460', '400 + 60 CP', 65_000, 'codm_activision_in:460_cp:user_id'),
            realTier('CODM_IN_960', '800 + 160 CP', 131_000, 'codm_activision_in:960_cp:user_id'),
            realTier('CODM_IN_2600', '2000 + 600 CP', 328_000, 'codm_activision_in:2600_cp:user_id'),
            realTier('CODM_IN_5400', '4000 + 1400 CP', 656_000, 'codm_activision_in:5400_cp:user_id'),
            realTier('CODM_IN_11200', '8000 + 3200 CP', 1_299_000, 'codm_activision_in:11200_cp:user_id'),
            realTier('CODM_IN_22400', '16000 + 6400 CP', 2_623_000, 'codm_activision_in:22400_cp:user_id'),
            realTier('CODM_IN_33600', '24000 + 9600 CP', 3_935_000, 'codm_activision_in:33600_cp:user_id'),
            realTier('CODM_IN_56000', '40000 + 16000 CP', 6_558_000, 'codm_activision_in:56000_cp:user_id'),
          ],
        },
        {
          name: 'Saudi Arabia',
          code: 'SA',
          products: [
            realTier('CODM_SA_88', '80 + 8 CP', 13_000, 'codm_activision_sa:88_cp:user_id'),
            realTier('CODM_SA_460', '400 + 60 CP', 63_000, 'codm_activision_sa:460_cp:user_id'),
            realTier('CODM_SA_960', '800 + 160 CP', 129_000, 'codm_activision_sa:960_cp:user_id'),
            realTier('CODM_SA_2600', '2000 + 600 CP', 315_000, 'codm_activision_sa:2600_cp:user_id'),
            realTier('CODM_SA_5400', '4000 + 1400 CP', 647_000, 'codm_activision_sa:5400_cp:user_id'),
            realTier('CODM_SA_11600', '8000 + 3600 CP', 1_294_000, 'codm_activision_sa:11600_cp:user_id'),
            realTier('CODM_SA_23200', '16000 + 7200 CP', 2_543_000, 'codm_activision_sa:23200_cp:user_id'),
            realTier('CODM_SA_34800', '24000 + 10800 CP', 3_753_000, 'codm_activision_sa:34800_cp:user_id'),
            realTier('CODM_SA_58000', '40000 + 18000 CP', 6_082_000, 'codm_activision_sa:58000_cp:user_id'),
          ],
        },
        {
          name: 'United States',
          code: 'US',
          products: [
            realTier('CODM_US_88', '80 + 8 CP', 13_000, 'codm_activision_us:88_cp:user_id'),
            realTier('CODM_US_460', '400 + 60 CP', 66_000, 'codm_activision_us:460_cp:user_id'),
            realTier('CODM_US_960', '800 + 160 CP', 131_000, 'codm_activision_us:960_cp:user_id'),
            realTier('CODM_US_2600', '2000 + 600 CP', 328_000, 'codm_activision_us:2600_cp:user_id'),
            realTier('CODM_US_5400', '4000 + 1400 CP', 657_000, 'codm_activision_us:5400_cp:user_id'),
            realTier('CODM_US_11600', '8000 + 3600 CP', 1_314_000, 'codm_activision_us:11600_cp:user_id'),
            realTier('CODM_US_23200', '16000 + 7200 CP', 2_629_000, 'codm_activision_us:23200_cp:user_id'),
            realTier('CODM_US_34800', '24000 + 10800 CP', 3_943_000, 'codm_activision_us:34800_cp:user_id'),
            realTier('CODM_US_58000', '40000 + 18000 CP', 6_572_000, 'codm_activision_us:58000_cp:user_id'),
          ],
        },
        {
          name: 'Singapore/Malaysia (Garena)',
          code: 'GARENA_SGMY',
          products: [
            realTier('CODM_SGMY_114', '114 CP', 16_000, 'codm_garena_sgmy:114_cp:user_id'),
            realTier('CODM_SGMY_253', '253 CP', 31_000, 'codm_garena_sgmy:253_cp:user_id'),
            realTier('CODM_SGMY_794', '794 CP', 93_000, 'codm_garena_sgmy:794_cp:user_id'),
            realTier('CODM_SGMY_1053', '1053 CP', 124_000, 'codm_garena_sgmy:1053_cp:user_id'),
            realTier('CODM_SGMY_2760', '2760 CP', 309_000, 'codm_garena_sgmy:2760_cp:user_id'),
            realTier('CODM_SGMY_9200', '9200 CP', 928_000, 'codm_garena_sgmy:9200_cp:user_id'),
            realTier('CODM_SGMY_12880', '12880 CP', 1_237_000, 'codm_garena_sgmy:12880_cp:user_id'),
            realTier('CODM_SGMY_15640', '15640 CP', 1_547_000, 'codm_garena_sgmy:15640_cp:user_id'),
            realTier('CODM_SGMY_19320', '19320 CP', 1_856_000, 'codm_garena_sgmy:19320_cp:user_id'),
          ],
        },
        {
          name: 'Indonesia (Garena)',
          code: 'GARENA_ID',
          products: [
            realTier('CODM_GID_31', '31 CP', 3_200, 'codm_garena_indonesia:31_cp:user_id'),
            realTier('CODM_GID_128', '128 CP', 13_500, 'codm_garena_indonesia:128_cp:user_id'),
            realTier('CODM_GID_645', '645 CP', 68_000, 'codm_garena_indonesia:645_cp:user_id'),
            realTier('CODM_GID_800', '800 CP', 76_000, 'codm_garena_indonesia:800_cp:user_id'),
            realTier('CODM_GID_2060', '2060 CP', 205_000, 'codm_garena_indonesia:2060_cp:user_id'),
            realTier('CODM_GID_3564', '3564 CP', 342_000, 'codm_garena_indonesia:3564_cp:user_id'),
            realTier('CODM_GID_7656', '7656 CP', 683_000, 'codm_garena_indonesia:7656_cp:user_id'),
            realTier('CODM_GID_15312', '15312 CP', 1_268_000, 'codm_garena_indonesia:15312_cp:user_id'),
            realTier('CODM_GID_76560', '76560 CP', 6_340_000, 'codm_garena_indonesia:76560_cp:user_id'),
          ],
        },
      ],
      // Kazakhstan (CIS) — default/fallback ladder.
      products: [
        realTier('CODM_88', '80 + 8 CP', 14_200, 'codm_activision_kz:88_cp:user_id'),
        realTier('CODM_460', '400 + 60 CP', 70_500, 'codm_activision_kz:460_cp:user_id'),
        realTier('CODM_960', '800 + 160 CP', 141_500, 'codm_activision_kz:960_cp:user_id'),
        realTier('CODM_2600', '2000 + 600 CP', 368_000, 'codm_activision_kz:2600_cp:user_id'),
        realTier('CODM_5400', '4000 + 1400 CP', 709_000, 'codm_activision_kz:5400_cp:user_id'),
      ],
    },
    {
      slug: '8-ball-pool',
      name: '8 Ball Pool',
      category: 'Sports',
      logoEmoji: '🎱',
      logoUrl:
        'https://play-lh.googleusercontent.com/F2_Kbn1-vQePDh_Y0qNCDhkmpEK5qdEyPwcJqwXho54ZVG4w6Szt32VHsyPzeVLPR2kfYI62-hGmNpQoDxS-wQ=s256',
      availability: 'ACTIVE',
      // Field key is user_id, not player_id.
      products: [
        realTier('8BP_20', '20 Cash', 20_000, '8_ball_pool:20_cash:user_id'),
        realTier('8BP_50', '50 Cash', 50_000, '8_ball_pool:50_cash:user_id'),
        realTier('8BP_110', '110 Cash', 99_000, '8_ball_pool:110_cash:user_id'),
        realTier('8BP_250', '250 Cash', 199_000, '8_ball_pool:250_cash:user_id'),
      ],
    },
    {
      slug: 'clash-of-clans',
      name: 'Clash of Clans',
      category: 'Strategy',
      logoEmoji: '🏰',
      logoUrl:
        'https://play-lh.googleusercontent.com/gX_sXesdzLc9C4tancLSiJKZom_gLi7Uc5cMfaC-zaY0gvFbXV_DTRZFNqlVx6USMWkqglYgr-k0NeaUq5zE=s256',
      availability: 'ACTIVE',
      // Supercell prices Gems identically across Clash of Clans/Royale and
      // Brawl Stars ($0.99/$4.99/$9.99/$19.99/$49.99/$99.99 for
      // 80/500/1200/2500/6500/14000) — priced here at ~15% below that
      // official rate (no wholesale cost available; FazerCards gates its
      // Supercell-line price list behind a live account, unlike Robux's
      // public one), since undercutting official IAP is the point of a
      // top-up shop.
      products: [
        estTier('COC_80', '80 Gems', 10_000),
        estTier('COC_500', '500 Gems', 51_000),
        estTier('COC_1200', '1,200 Gems', 101_000),
        estTier('COC_2500', '2,500 Gems', 203_000),
        estTier('COC_6500', '6,500 Gems', 508_000),
        estTier('COC_14000', '14,000 Gems', 1_016_000),
      ],
    },
    {
      slug: 'clash-royale',
      name: 'Clash Royale',
      category: 'Strategy',
      logoEmoji: '👊',
      logoUrl:
        'https://play-lh.googleusercontent.com/z0rspJKftanEI7MA4WOdypbaaHfeKy4UjoawRGKf4Ys3v6LrrcleZWOfms7XK-J33Oqyfm3DlFd4Z_eKWafVFg=s256',
      availability: 'ACTIVE',
      // Same Supercell-wide Gems ladder/pricing as Clash of Clans above.
      products: [
        estTier('CR_80', '80 Gems', 10_000),
        estTier('CR_500', '500 Gems', 51_000),
        estTier('CR_1200', '1,200 Gems', 101_000),
        estTier('CR_2500', '2,500 Gems', 203_000),
        estTier('CR_6500', '6,500 Gems', 508_000),
        estTier('CR_14000', '14,000 Gems', 1_016_000),
      ],
    },
    {
      slug: 'standoff-2',
      name: 'Standoff 2',
      category: 'FPS',
      logoEmoji: '💥',
      logoUrl:
        'https://play-lh.googleusercontent.com/BzFzyK022sdG6grfJqkwj3KoNFAxp0aQ7kYFzZwwfbHZvaMkViEQDco68Xt_tk4us6XrCG6ST3CJT32W3KutDQ=s256',
      availability: 'ACTIVE',
      // Axlebolt prices Gold at €1.99/100 (no bulk discount) up to ~40% off
      // at the largest packs (standoff-2.fandom.com/wiki/Currency) — no
      // wholesale supplier confirmed for Standoff 2 (checked FazerCards and
      // the usual resellers), so this stays test-only until one turns up,
      // but the numbers themselves are now real instead of the old flat
      // placeholder ladder.
      products: [
        estTier('SO2_60', '60 Gold', 17_000),
        estTier('SO2_300', '300 Gold', 76_000),
        estTier('SO2_660', '660 Gold', 149_000),
        estTier('SO2_1650', '1,650 Gold', 326_000),
        estTier('SO2_3850', '3,850 Gold', 674_000),
      ],
    },
    {
      slug: 'brawl-stars',
      name: 'Brawl Stars',
      category: 'Action',
      logoEmoji: '🌟',
      logoUrl:
        'https://play-lh.googleusercontent.com/c0hXyphuxh-gpnhSJGZV1I0IpWbq9IdEc1pautS7SmHlXNBrCff7bMqK-u63pJdfP3KJoxamG7W1dRMKr7ZzWKs=s256',
      availability: 'ACTIVE',
      // Same Supercell-wide Gems ladder/pricing as Clash of Clans — the old
      // 30/80/170/360/950 amounts here weren't even real Brawl Stars Gems
      // denominations.
      products: [
        estTier('BS_80', '80 Gems', 10_000),
        estTier('BS_500', '500 Gems', 51_000),
        estTier('BS_1200', '1,200 Gems', 101_000),
        estTier('BS_2500', '2,500 Gems', 203_000),
        estTier('BS_6500', '6,500 Gems', 508_000),
        estTier('BS_14000', '14,000 Gems', 1_016_000),
      ],
    },
    {
      slug: 'among-us',
      name: 'Among Us',
      category: 'Party',
      logoEmoji: '🧑‍🚀',
      logoUrl:
        'https://play-lh.googleusercontent.com/pfGArJJx-vtMRVu2-ziedzAhTLsHgks6N3mNyyOC0oxRdsXINGwdd9h4ZutdTG7MfgiqlDXBXnk-kNo-Fns70Q=s256',
      availability: 'ACTIVE',
      // No premium currency — cosmetics are sold as flat packs. Innersloth's
      // real pack pricing is $2.99 per pet bundle and $0.99-2.99 per
      // individual cosmetic; scaled up to a $19.99 top bundle here. No
      // wholesale supplier confirmed (same as Standoff 2), so still
      // test-only, but no longer priced at ~40x real value like the old
      // shared placeholder ladder was.
      products: [
        estTier('AMONGUS_SMALL', 'Small Pet Pack', 39_000),
        estTier('AMONGUS_MEDIUM', 'Medium Pet Pack', 79_000),
        estTier('AMONGUS_LARGE', 'Large Cosmetic Pack', 131_000),
        estTier('AMONGUS_MEGA', 'Mega Cosmetic Pack', 197_000),
        estTier('AMONGUS_ULTIMATE', 'Ultimate Bundle', 263_000),
      ],
    },
    {
      slug: 'ea-fc-mobile',
      name: 'EA SPORTS FC Mobile',
      category: 'Sports',
      logoEmoji: '⚽',
      logoUrl:
        'https://play-lh.googleusercontent.com/NEp-Nq3k_EBZriaPEmAKdqjd2v3UGAhMcSvoOcdrfwZQavolX_-OwQA2TX21LS-A8x8cV15r3J2CFaG-yT2IVX4=s256',
      availability: 'ACTIVE',
      // eafc_mobile_id (Indonesia) is the default/fallback — no
      // region-neutral "global" EAFC Mobile category exists on FazerCards
      // — plus the 3 other real regional categories FazerCards carries
      // (Cambodia, Malaysia, Singapore), each its own catalog/pricing.
      // Only the FC Points currency is wired (not each region's identical-
      // priced "Silver" line, which reads like a duplicate/alt SKU for the
      // same offers, not a second real currency).
      servers: [
        { name: 'Indonesia', code: 'ID' },
        {
          name: 'Cambodia',
          code: 'KH',
          products: [
            realTier('FCM_KH_40', '40 FC Points', 5_000, 'eafc_mobile_kh:40_fc_points'),
            realTier('FCM_KH_100', '100 FC Points', 12_500, 'eafc_mobile_kh:100_fc_points'),
            realTier('FCM_KH_520', '520 FC Points', 63_000, 'eafc_mobile_kh:520_fc_points'),
            realTier('FCM_KH_1070', '1070 FC Points', 127_000, 'eafc_mobile_kh:1070_fc_points'),
            realTier('FCM_KH_2200', '2200 FC Points', 254_000, 'eafc_mobile_kh:2200_fc_points'),
            realTier('FCM_KH_5750', '5750 FC Points', 634_000, 'eafc_mobile_kh:5750_fc_points'),
            realTier('FCM_KH_12000', '12000 FC Points', 1_269_000, 'eafc_mobile_kh:12000_fc_points'),
          ],
        },
        {
          name: 'Malaysia',
          code: 'MY',
          products: [
            realTier('FCM_MY_40', '40 FC Points', 6_500, 'eafc_mobile_my:40_fc_points'),
            realTier('FCM_MY_100', '100 FC Points', 15_500, 'eafc_mobile_my:100_fc_points'),
            realTier('FCM_MY_520', '520 FC Points', 75_000, 'eafc_mobile_my:520_fc_points'),
            realTier('FCM_MY_1070', '1070 FC Points', 141_000, 'eafc_mobile_my:1070_fc_points'),
            realTier('FCM_MY_2200', '2200 FC Points', 299_000, 'eafc_mobile_my:2200_fc_points'),
            realTier('FCM_MY_5750', '5750 FC Points', 755_000, 'eafc_mobile_my:5750_fc_points'),
            realTier('FCM_MY_12000', '12000 FC Points', 1_511_000, 'eafc_mobile_my:12000_fc_points'),
          ],
        },
        {
          name: 'Singapore',
          code: 'SG',
          products: [
            realTier('FCM_SG_40', '40 FC Points', 6_000, 'eafc_mobile_sg:40_fc_points'),
            realTier('FCM_SG_100', '100 FC Points', 14_500, 'eafc_mobile_sg:100_fc_points'),
            realTier('FCM_SG_520', '520 FC Points', 70_000, 'eafc_mobile_sg:520_fc_points'),
            realTier('FCM_SG_1070', '1070 FC Points', 149_000, 'eafc_mobile_sg:1070_fc_points'),
            realTier('FCM_SG_2200', '2200 FC Points', 289_000, 'eafc_mobile_sg:2200_fc_points'),
            realTier('FCM_SG_5750', '5750 FC Points', 689_000, 'eafc_mobile_sg:5750_fc_points'),
            realTier('FCM_SG_12000', '12000 FC Points', 1_487_000, 'eafc_mobile_sg:12000_fc_points'),
          ],
        },
      ],
      // Indonesia — default/fallback ladder.
      products: [
        realTier('FCM_40', '40 FC Points', 4_600, 'eafc_mobile_id:40_fc_points'),
        realTier('FCM_100', '100 FC Points', 11_200, 'eafc_mobile_id:100_fc_points'),
        realTier('FCM_520', '520 FC Points', 55_000, 'eafc_mobile_id:520_fc_points'),
        realTier('FCM_1070', '1070 FC Points', 111_000, 'eafc_mobile_id:1070_fc_points'),
        realTier('FCM_2200', '2200 FC Points', 230_000, 'eafc_mobile_id:2200_fc_points'),
        realTier('FCM_5750', '5750 FC Points', 560_000, 'eafc_mobile_id:5750_fc_points'),
      ],
    },
  ];

  for (const [gameIndex, g] of seedGames.entries()) {
    const game = await prisma.game.upsert({
      where: { slug: g.slug },
      update: { name: g.name, category: g.category, logoEmoji: g.logoEmoji, logoUrl: g.logoUrl, availability: g.availability },
      create: {
        slug: g.slug,
        name: g.name,
        category: g.category,
        logoEmoji: g.logoEmoji,
        logoUrl: g.logoUrl,
        availability: g.availability,
        sortOrder: gameIndex,
      },
    });

    // Paired with the originating SeedServer (not just the DB row) so a
    // server with its own `products` override — e.g. MLBB's per-region
    // ladders, each a genuinely distinct FazerCards category/price, not a
    // relabeled duplicate — can be seeded with the right catalog below.
    const serverPairs: { seed: SeedServer | null; db: Awaited<ReturnType<typeof prisma.gameServer.upsert>> | null }[] = [];
    if (g.servers) {
      for (const [sIndex, s] of g.servers.entries()) {
        const dbServer = await prisma.gameServer.upsert({
          where: { gameId_code: { gameId: game.id, code: s.code } },
          update: { name: s.name, isActive: true },
          create: { gameId: game.id, name: s.name, code: s.code, isActive: true, sortOrder: sIndex },
        });
        serverPairs.push({ seed: s, db: dbServer });
      }
    } else {
      serverPairs.push({ seed: null, db: null });
    }

    // Deactivate servers this game used to have but no longer lists (e.g.
    // MLBB's old Asia/Europe/Americas picker, replaced by a single Global
    // server) — along with the duplicate per-server products seeded under
    // them, so a stale server/product pair can't still show up in the app.
    if (g.servers) {
      const currentCodes = g.servers.map((s) => s.code);
      const staleServers = await prisma.gameServer.findMany({
        where: { gameId: game.id, code: { notIn: currentCodes } },
      });
      if (staleServers.length > 0) {
        const staleServerIds = staleServers.map((s) => s.id);
        await prisma.product.updateMany({
          where: { gameId: game.id, serverId: { in: staleServerIds } },
          data: { isActive: false },
        });
        await prisma.gameServer.updateMany({
          where: { id: { in: staleServerIds } },
          data: { isActive: false },
        });
      }
    }

    // Deactivate stale products this game used to have under an old name
    // (e.g. the placeholder ladder's "86 Diamonds" before it became the
    // real-priced "86 (78+8) Diamonds") — soft-deleted, not removed, since
    // past orders may still reference them. Union across every server's
    // own product list (not just the fallback g.products) so a name that's
    // current for one region isn't wrongly swept as stale because it isn't
    // also in another region's list.
    const currentNames = new Set(
      serverPairs.flatMap(({ seed }) => (seed?.products ?? g.products).map((p) => p.name)),
    );
    await prisma.product.updateMany({
      where: { gameId: game.id, name: { notIn: [...currentNames] } },
      data: { isActive: false },
    });

    for (const { seed, db: server } of serverPairs) {
      const productsForServer = seed?.products ?? g.products;
      for (const [productIndex, item] of productsForServer.entries()) {
        const mockProviderCode = server ? `${item.code}_${server.code}` : item.code;
        const isReal = !!item.fazercardsCode;

        const description = isReal
          ? `${item.name} — fulfilled via FazerCards.`
          : `${item.name} — development/test product, delivered instantly by the mock provider.`;

        const existing = await prisma.product.findFirst({
          where: { gameId: game.id, serverId: server?.id ?? null, name: item.name },
        });
        // Re-running the seed after tweaking a realTier() price/description
        // (e.g. correcting a margin) must actually apply the change, not
        // just leave whatever was created the first time — this keeps
        // amountMinor/description/isTest/sortOrder in sync on every run.
        const product = existing
          ? await prisma.product.update({
              where: { id: existing.id },
              data: { description, amountMinor: item.amountMinor, isActive: true, isTest: !isReal, sortOrder: productIndex },
            })
          : await prisma.product.create({
              data: {
                gameId: game.id,
                serverId: server?.id,
                name: item.name,
                description,
                amountMinor: item.amountMinor,
                currency: 'UZS',
                isActive: true,
                isTest: !isReal,
                sortOrder: productIndex,
              },
            });

        // Real games get FazerCards as priority 0 (tried first) and
        // DEV_MOCK_TOPUP demoted to priority 1 (fallback, dev-only) —
        // every other game keeps DEV_MOCK_TOPUP at priority 0, unchanged.
        await prisma.providerProduct.upsert({
          where: { providerId_productId: { providerId: topupProvider.id, productId: product.id } },
          update: { providerProductCode: mockProviderCode, isActive: true, priority: isReal ? 1 : 0 },
          create: {
            providerId: topupProvider.id,
            productId: product.id,
            providerProductCode: mockProviderCode,
            priority: isReal ? 1 : 0,
            isActive: true,
          },
        });

        if (item.fazercardsCode) {
          await prisma.providerProduct.upsert({
            where: { providerId_productId: { providerId: fazercardsProvider.id, productId: product.id } },
            update: { providerProductCode: item.fazercardsCode, isActive: true, priority: 0 },
            create: {
              providerId: fazercardsProvider.id,
              productId: product.id,
              providerProductCode: item.fazercardsCode,
              priority: 0,
              isActive: true,
            },
          });
        }
      }
    }
  }

  // --- Receiving method (dev placeholder — admin replaces with a real card
  // via the admin API/panel before any shared/staging deploy; this is a
  // fake masked number, never a real one) ---------------------------------
  const existingReceivingMethod = await prisma.receivingMethod.findFirst({
    where: { cardHolderName: 'UZDONATE (dev placeholder)' },
  });
  if (!existingReceivingMethod) {
    await prisma.receivingMethod.create({
      data: {
        type: 'CARD_TRANSFER',
        cardNumber: '8600 0000 0000 0000',
        cardHolderName: 'UZDONATE (dev placeholder)',
        bankName: 'Dev Bank',
        isActive: true,
        sortOrder: 0,
      },
    });
  }

  // --- Default admin (dev only — change this password before any shared/staging deploy) ---
  const adminEmail = 'admin@uzdonate.dev';
  const adminPasswordHash = await argon2.hash('DevAdmin123!', { type: argon2.argon2id });
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      fullName: 'Dev Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('Seed complete.');
  console.log(`  Dev admin login: ${adminEmail} / DevAdmin123!  (change before any shared deploy)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
