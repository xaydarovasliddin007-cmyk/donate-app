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

  // The standard 5-tier UZS price ladder every game below maps its currency
  // amounts onto (small -> mega).
  const LADDER = [1_500_000, 2_900_000, 4_300_000, 8_500_000, 17_000_000];
  const tiers = (code: string, unit: string, amounts: number[]): SeedTier[] =>
    amounts.map((amount, i) => ({ code: `${code}_${amount}`, name: `${amount} ${unit}`, amountMinor: LADDER[i] }));

  // Real-priced tiers for games actually wired to the FazerCards live
  // catalog (see backend/README.md "FazerCards top-up setup"). Unlike
  // tiers() above, prices here are NOT a placeholder ladder — sellUzs is a
  // real UZS retail price (already *100 into minor units/tiyin) chosen to
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
      // A single "Global (UZ)" server, not the old Asia/Europe/Americas
      // picker — every tier here is fulfilled through FazerCards'
      // `mobile_legends_global` line regardless of which region a buyer
      // picked, so the old 3-way picker was cosmetic and misleading (same
      // product/price duplicated under three tabs). BekPinBot's reference
      // list leads with a combined "UZ/Global" tab for exactly this reason
      // — the vast majority of Uzbek buyers' MLBB accounts are on Global.
      servers: [{ name: 'Global (UZ)', code: 'GLOBAL' }],
      // Matches BekPinBot's exact package list/prices (a real competitor,
      // checked 2026-08-28) — every denomination here is a confirmed exact
      // match against a live FazerCards mobile_legends_global offer.
      // Order matches BekPinBot's layout exactly: the four x2 bonus packs,
      // then the four passes, then plain diamonds smallest-to-largest —
      // not the "all bonuses, then all diamonds, passes last" grouping
      // this had before.
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
      // free_fire_cis (not free_fire_id) — the CIS-region category is the
      // right supply line for players in Uzbekistan/CIS, even though its
      // own denomination ladder differs from the old placeholder tiers.
      // ~10% margin over live FazerCards USD cost, no competitor price was
      // checked for Free Fire.
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
      products: tiers('RBX', 'Robux', [80, 170, 400, 800, 1700]),
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
      // codm_activision_kz (Kazakhstan) — the closest CIS-region CODM line
      // FazerCards carries. Field key is user_id, not player_id.
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
      products: tiers('COC', 'Gems', [80, 500, 1200, 2500, 6500]),
    },
    {
      slug: 'clash-royale',
      name: 'Clash Royale',
      category: 'Strategy',
      logoEmoji: '👊',
      logoUrl:
        'https://play-lh.googleusercontent.com/z0rspJKftanEI7MA4WOdypbaaHfeKy4UjoawRGKf4Ys3v6LrrcleZWOfms7XK-J33Oqyfm3DlFd4Z_eKWafVFg=s256',
      availability: 'ACTIVE',
      products: tiers('CR', 'Gems', [80, 500, 1200, 2500, 6500]),
    },
    {
      slug: 'standoff-2',
      name: 'Standoff 2',
      category: 'FPS',
      logoEmoji: '💥',
      logoUrl:
        'https://play-lh.googleusercontent.com/BzFzyK022sdG6grfJqkwj3KoNFAxp0aQ7kYFzZwwfbHZvaMkViEQDco68Xt_tk4us6XrCG6ST3CJT32W3KutDQ=s256',
      availability: 'ACTIVE',
      products: tiers('SO2', 'Gold', [60, 300, 660, 1650, 3850]),
    },
    {
      slug: 'brawl-stars',
      name: 'Brawl Stars',
      category: 'Action',
      logoEmoji: '🌟',
      logoUrl:
        'https://play-lh.googleusercontent.com/c0hXyphuxh-gpnhSJGZV1I0IpWbq9IdEc1pautS7SmHlXNBrCff7bMqK-u63pJdfP3KJoxamG7W1dRMKr7ZzWKs=s256',
      availability: 'ACTIVE',
      products: tiers('BS', 'Gems', [30, 80, 170, 360, 950]),
    },
    {
      slug: 'among-us',
      name: 'Among Us',
      category: 'Party',
      logoEmoji: '🧑‍🚀',
      logoUrl:
        'https://play-lh.googleusercontent.com/pfGArJJx-vtMRVu2-ziedzAhTLsHgks6N3mNyyOC0oxRdsXINGwdd9h4ZutdTG7MfgiqlDXBXnk-kNo-Fns70Q=s256',
      availability: 'ACTIVE',
      // No premium currency — cosmetics are sold as flat packs, so the
      // ladder's names are pack tiers instead of a currency amount.
      products: LADDER.map((amountMinor, i) => ({
        code: `AMONGUS_PACK_${i}`,
        name: ['Small Pet Pack', 'Medium Pet Pack', 'Large Cosmetic Pack', 'Mega Cosmetic Pack', 'Ultimate Bundle'][i],
        amountMinor,
      })),
    },
    {
      slug: 'ea-fc-mobile',
      name: 'EA SPORTS FC Mobile',
      category: 'Sports',
      logoEmoji: '⚽',
      logoUrl:
        'https://play-lh.googleusercontent.com/NEp-Nq3k_EBZriaPEmAKdqjd2v3UGAhMcSvoOcdrfwZQavolX_-OwQA2TX21LS-A8x8cV15r3J2CFaG-yT2IVX4=s256',
      availability: 'ACTIVE',
      // eafc_mobile_id (Indonesia) — no region-neutral "global" EAFC Mobile
      // category exists on FazerCards; this is the closest available line.
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

    const servers = g.servers
      ? await Promise.all(
          g.servers.map((s) =>
            prisma.gameServer.upsert({
              where: { gameId_code: { gameId: game.id, code: s.code } },
              update: { name: s.name, isActive: true },
              create: { gameId: game.id, name: s.name, code: s.code, isActive: true, sortOrder: g.servers!.indexOf(s) },
            }),
          ),
        )
      : [null];

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
    // past orders may still reference them.
    const currentNames = g.products.map((p) => p.name);
    await prisma.product.updateMany({
      where: { gameId: game.id, name: { notIn: currentNames } },
      data: { isActive: false },
    });

    for (const server of servers) {
      for (const [productIndex, item] of g.products.entries()) {
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
