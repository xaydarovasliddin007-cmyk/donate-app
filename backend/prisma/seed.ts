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

  // --- Games ------------------------------------------------------------------
  const games = await Promise.all(
    [
      { slug: 'mobile-legends', name: 'Mobile Legends: Bang Bang', category: 'MOBA', logoEmoji: '⚔️', availability: 'ACTIVE' as const, sortOrder: 0 },
      { slug: 'pubg-mobile', name: 'PUBG Mobile', category: 'Battle Royale', logoEmoji: '🎯', availability: 'COMING_SOON' as const, sortOrder: 1 },
      { slug: 'free-fire', name: 'Free Fire', category: 'Battle Royale', logoEmoji: '🔥', availability: 'COMING_SOON' as const, sortOrder: 2 },
      { slug: 'roblox', name: 'Roblox', category: 'Sandbox', logoEmoji: '🧱', availability: 'COMING_SOON' as const, sortOrder: 3 },
      { slug: 'valorant', name: 'Valorant', category: 'FPS', logoEmoji: '🔫', availability: 'COMING_SOON' as const, sortOrder: 4 },
    ].map((game) => prisma.game.upsert({ where: { slug: game.slug }, update: game, create: game })),
  );

  const mlbb = games.find((g) => g.slug === 'mobile-legends')!;

  // --- Mobile Legends products (the only functional MVP catalog) -------------
  const mlbbProducts = [
    { code: 'MLBB_86', name: '86 Diamonds', amountMinor: 1_500_000, sortOrder: 0 },
    { code: 'MLBB_172', name: '172 Diamonds', amountMinor: 2_900_000, sortOrder: 1 },
    { code: 'MLBB_257', name: '257 Diamonds', amountMinor: 4_300_000, sortOrder: 2 },
    { code: 'MLBB_344', name: '344 Diamonds', amountMinor: 5_700_000, sortOrder: 3 },
    { code: 'MLBB_WEEKLY_PASS', name: 'Weekly Diamond Pass', amountMinor: 2_100_000, sortOrder: 4 },
  ];

  for (const item of mlbbProducts) {
    // Product has no natural unique key besides id, so find-or-create by (gameId, name).
    const existing = await prisma.product.findFirst({ where: { gameId: mlbb.id, name: item.name } });
    const product =
      existing ??
      (await prisma.product.create({
        data: {
          gameId: mlbb.id,
          name: item.name,
          description: `${item.name} — development/test product, delivered instantly by the mock provider.`,
          amountMinor: item.amountMinor,
          currency: 'UZS',
          isActive: true,
          isTest: true,
          sortOrder: item.sortOrder,
        },
      }));

    await prisma.providerProduct.upsert({
      where: { providerId_productId: { providerId: topupProvider.id, productId: product.id } },
      update: { providerProductCode: item.code, isActive: true, priority: 0 },
      create: {
        providerId: topupProvider.id,
        productId: product.id,
        providerProductCode: item.code,
        priority: 0,
        isActive: true,
      },
    });
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

  // --- Promotion ----------------------------------------------------------------
  await prisma.promotion.upsert({
    where: { code: 'WELCOME' },
    update: {},
    create: {
      code: 'WELCOME',
      title: 'Welcome to UZDONATE',
      description: 'Fast, secure top-ups for your favorite games.',
      isActive: true,
    },
  });

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
