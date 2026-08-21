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

  const seedGames: SeedGame[] = [
    {
      slug: 'mobile-legends',
      name: 'Mobile Legends: Bang Bang',
      category: 'MOBA',
      logoEmoji: '⚔️',
      logoUrl:
        'https://play-lh.googleusercontent.com/D8r13ijO9c-0_1N-CP4d63mR1w6YhDuR2mBQUl27ELJAx0sKdaKtM5vCUnSLODKBVzUx7rZ9cW4Ir9jYiufsSQ=s256',
      availability: 'ACTIVE',
      // Demonstrates per-server pricing (this plan's Part 4) — every other
      // game below has none and behaves exactly as before that concept
      // existed.
      servers: [
        { name: 'Asia', code: 'ASIA' },
        { name: 'Europe', code: 'EU' },
        { name: 'Americas', code: 'AMERICAS' },
      ],
      products: tiers('MLBB', 'Diamonds', [86, 172, 257, 344, 706]),
    },
    {
      slug: 'pubg-mobile',
      name: 'PUBG Mobile',
      category: 'Battle Royale',
      logoEmoji: '🎯',
      logoUrl:
        'https://play-lh.googleusercontent.com/O8jPCZ2EXAt7wGlbZhkhA-3vPIWVBpz8tZrRnsr7uVeqp0UD1AQwIEl_N9So80kdp8gDvIksC64GypylkQV_=s256',
      availability: 'ACTIVE',
      products: tiers('PUBGM', 'UC', [60, 120, 325, 660, 1800]),
    },
    {
      slug: 'free-fire',
      name: 'Free Fire',
      category: 'Battle Royale',
      logoEmoji: '🔥',
      logoUrl:
        'https://play-lh.googleusercontent.com/JT88XmsHoGDio7FxONwh382DhuTxuccfMmWFDtRBFjilySzNqWOCxUhqm8IhBKzQSwVrW2HWp_XvSgKFwi3ETA=s256',
      availability: 'ACTIVE',
      products: tiers('FF', 'Diamonds', [100, 210, 520, 1060, 2180]),
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
      // Genshin Impact's four real official server regions.
      servers: [
        { name: 'Asia', code: 'ASIA' },
        { name: 'America', code: 'AMERICA' },
        { name: 'Europe', code: 'EU' },
        { name: 'TW, HK, MO', code: 'TW_HK_MO' },
      ],
      products: tiers('GENSHIN', 'Genesis Crystals', [60, 300, 980, 1980, 3280]),
    },
    {
      slug: 'honor-of-kings',
      name: 'Honor of Kings',
      category: 'MOBA',
      logoEmoji: '👑',
      logoUrl:
        'https://play-lh.googleusercontent.com/ySKKDO_bieWZ11fmnOD1fuDpcPgOjASwjg9Nxyut3gk9bM_QPVYnAn3G4Q7_vR76dOs0VnW_DVFE99aOqVEcaCU=s256',
      availability: 'ACTIVE',
      products: tiers('HOK', 'Tokens', [60, 300, 980, 1980, 3280]),
    },
    {
      slug: 'call-of-duty-mobile',
      name: 'Call of Duty: Mobile',
      category: 'FPS',
      logoEmoji: '🪖',
      logoUrl:
        'https://play-lh.googleusercontent.com/4KLtYEExeMc9gcYZz1BgAiV87IZ8onX3aGld_lJ8xMydt1MP7m--a6dn0aGNMemq-IiwGrrhqt81TA-Qbve8=s256',
      availability: 'ACTIVE',
      products: tiers('CODM', 'CP', [80, 400, 800, 2000, 5000]),
    },
    {
      slug: '8-ball-pool',
      name: '8 Ball Pool',
      category: 'Sports',
      logoEmoji: '🎱',
      logoUrl:
        'https://play-lh.googleusercontent.com/F2_Kbn1-vQePDh_Y0qNCDhkmpEK5qdEyPwcJqwXho54ZVG4w6Szt32VHsyPzeVLPR2kfYI62-hGmNpQoDxS-wQ=s256',
      availability: 'ACTIVE',
      products: tiers('8BP', 'Cash', [25, 60, 125, 330, 600]),
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
      products: tiers('FCM', 'FC Points', [100, 550, 1200, 2800, 5900]),
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

    for (const server of servers) {
      for (const [productIndex, item] of g.products.entries()) {
        const providerCode = server ? `${item.code}_${server.code}` : item.code;

        const existing = await prisma.product.findFirst({
          where: { gameId: game.id, serverId: server?.id ?? null, name: item.name },
        });
        const product =
          existing ??
          (await prisma.product.create({
            data: {
              gameId: game.id,
              serverId: server?.id,
              name: item.name,
              description: `${item.name} — development/test product, delivered instantly by the mock provider.`,
              amountMinor: item.amountMinor,
              currency: 'UZS',
              isActive: true,
              isTest: true,
              sortOrder: productIndex,
            },
          }));

        await prisma.providerProduct.upsert({
          where: { providerId_productId: { providerId: topupProvider.id, productId: product.id } },
          update: { providerProductCode: providerCode, isActive: true, priority: 0 },
          create: {
            providerId: topupProvider.id,
            productId: product.id,
            providerProductCode: providerCode,
            priority: 0,
            isActive: true,
          },
        });
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
        cardNumberMasked: '8600 0000 0000 0000',
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
