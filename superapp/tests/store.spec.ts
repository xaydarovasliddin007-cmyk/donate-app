import { expect, test, type Page } from '@playwright/test';

const games = [
  {
    id: 'game-1',
    slug: 'mobile-legends',
    name: 'Mobile Legends: Bang Bang',
    category: 'MOBA',
    logoUrl: '/assets-store/diamond.png',
    availability: 'ACTIVE',
    isPurchasable: true,
  },
  {
    id: 'game-2',
    slug: 'pubg-mobile',
    name: 'PUBG Mobile',
    category: 'Battle Royale',
    logoUrl: '/assets-store/uc_stack.png',
    availability: 'ACTIVE',
    isPurchasable: true,
  },
  {
    id: 'game-3',
    slug: 'free-fire',
    name: 'Free Fire',
    category: 'Battle Royale',
    logoUrl: '/assets-store/fire.png',
    availability: 'ACTIVE',
    isPurchasable: true,
  },
  {
    id: 'game-4',
    slug: 'valorant',
    name: 'Valorant',
    category: 'FPS',
    logoUrl: null,
    availability: 'COMING_SOON',
    isPurchasable: false,
  },
];
async function mockStore(page: Page, tg = false, busyTopup = false, insufficientBalance = false, invalidPlayer = false, expiredTopup = false) {
  let orders: object[] = [];
  const sent: { path: string; body: Record<string, unknown> }[] = [];
  await page.route('https://telegram.org/**', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
  if (tg)
    await page.addInitScript(() => {
      (window as unknown as { Telegram: object }).Telegram = {
        WebApp: {
          initData: 'test-signed-data',
          ready() {},
          expand() {},
          setHeaderColor() {},
          setBackgroundColor() {},
          openLink() {},
          openTelegramLink() {},
          BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
          openInvoice(_url: string, callback: (status: string) => void) {
            callback('paid');
          },
        },
      };
    });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : undefined;
    if (body) sent.push({ path, body });
    let data: unknown;
    if (path.startsWith('/auth/'))
      data = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        user: {
          id: 'user-1',
          publicId: 'UZD-TEST1234',
          displayName: 'Asliddin',
          isGuest: !tg,
          hasTelegramAccount: tg,
        },
      };
    else if (path === '/games') data = { games };
    else if (path.endsWith('/servers')) data = { servers: [{ id: 'server-1', code: 'GLOBAL', name: 'Global' }] };
    else if (path.endsWith('/products'))
      data = {
        products: [
          {
            id: 'product-1',
            name: '86 Diamonds',
            amountMinor: 1550000,
            currency: 'UZS',
            starsPrice: 65,
          },
          {
            id: 'product-2',
            name: '165 Diamonds x2',
            amountMinor: 2900000,
            currency: 'UZS',
          },
          {
            id: 'product-3',
            name: 'Weekly Pass',
            amountMinor: 1840000,
            currency: 'UZS',
          },
          {
            id: 'product-4',
            name: 'Twilight Pass',
            amountMinor: 10500000,
            currency: 'UZS',
          },
        ],
      };
    else if (path === '/wallet') data = { balanceMinor: insufficientBalance ? 0 : 5000000, currency: 'UZS' };
    else if (path === '/saved-games') data = { savedGames: [{ id: 'profile-1', playerId: '123456789', serverId: 'GLOBAL', zoneId: '1234', updatedAt: '2026-09-24T10:00:00Z', game: games[0] }] };
    else if (path === '/app/config')
      data = {
        supportUrl: 'https://t.me/uzdonate_support',
        telegramBotUrl: 'https://t.me/uzdonate1bot',
        telegramPaymentsEnabled: true,
      };
    else if (path === '/topups/options')
      data = {
        options: [
          { id: 'HUMO', label: 'HUMO', mode: 'AUTO', available: true },
          { id: 'UZCARD', label: 'UZCARD', mode: 'AUTO', available: true },
          {
            id: 'BANKOMAT',
            label: 'Bankomat',
            mode: 'MANUAL',
            available: true,
          },
        ],
      };
    else if (path === '/topups/reserve') {
      if (busyTopup && body.amountMinor === 5000000)
        return route.fulfill({
          status: 409,
          json: {
            error: {
              code: 'TOPUP_AMOUNT_BUSY',
              message: 'Busy',
              details: {
                requestedAmountMinor: 5000000,
                suggestedAmountsMinor: [5010000, 5020000],
              },
            },
          },
        });
      data = {
        id: 'topup-1',
        amountMinor: body.amountMinor,
        currency: 'UZS',
        type: body.type,
        channel: body.channel,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + (expiredTopup ? -1000 : 420000)).toISOString(),
        receivingMethods: [
          {
            id: 'method-1',
            type: 'CARD_TRANSFER',
            cardNumber: '9860 1234 5678 9012',
            cardHolderName: 'UZDONATE',
            bankName: 'Test Bank',
            cardNetwork: body.channel === 'UZCARD' ? 'UZCARD' : 'HUMO',
          },
          {
            id: 'method-2',
            type: 'CARD_TRANSFER',
            cardNumber: '8600 9876 5432 1098',
            cardHolderName: 'UZDONATE 2',
            bankName: 'Second Test Bank',
            cardNetwork: 'HUMO',
          },
        ],
      };
    } else if (path === '/topups/topup-1/confirm-paid') data = { id: 'topup-1', status: 'PENDING' };
    else if (path === '/topups/topup-1/receipt')
      data = {
        id: 'topup-1',
        status: 'PENDING',
        userReference: 'Telegram chek #1',
      };
    else if (path === '/topups') data = { topUps: [] };
    else if (path === '/orders' && !body) data = { orders };
    else if (path === '/orders/validate-player') data = invalidPlayer
      ? { valid: false, reason: 'Zone ID does not match' }
      : { valid: true, playerName: 'AsliddinMLBB', playerRegion: 'Global' };
    else if (path === '/orders' || path === '/telegram/invoices') {
      const order = {
        id: 'order-1',
        orderNumber: 'UZD123',
        game: games[0],
        items: [{ productName: '86 Diamonds' }],
        playerId: body.playerId,
        zoneId: body.zoneId,
        amountMinor: tg ? 6500 : 1550000,
        currency: tg ? 'XTR' : 'UZS',
        status: 'COMPLETED',
        createdAt: '2026-09-15T10:00:00Z',
      };
      orders = [order];
      data = path.includes('invoices') ? { invoiceUrl: 'https://t.me/$test-invoice', orderId: 'order-1' } : order;
    } else if (path === '/payments/wallet') data = { status: 'SUCCEEDED' };
    else if (path === '/orders/order-1') data = orders[0];
    else
      return route.fulfill({
        status: 404,
        json: { error: { message: 'Not found' } },
      });
    await route.fulfill({ json: data });
  });
  return sent;
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('catalog filters, light mode and responsive layout', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockStore(page);
  await page.goto('/');
  await expect(page.locator('.launch-screen')).toHaveCount(0);
  await expect(page.locator('.game-card')).toHaveCount(3);
  await page.waitForTimeout(1500);
  const featuredBanner = page.locator('.game-banner');
  const featuredArt = featuredBanner.locator('.game-banner__art');
  await expect(featuredBanner).toHaveCount(1);
  await expect(featuredArt).toBeVisible();
  await expect(featuredBanner.locator('.game-banner__copy')).toHaveCount(1);
  const artBox = await featuredArt.boundingBox();
  const bannerBox = await featuredBanner.boundingBox();
  expect(artBox).not.toBeNull();
  expect(bannerBox).not.toBeNull();
  expect((bannerBox?.height || 0)).toBeGreaterThan(170);
  expect((bannerBox?.height || 0)).toBeLessThanOrEqual(240);
  if (info.project.name !== 'desktop') {
    const mobileNav = page.getByRole('navigation', { name: "Asosiy bo'limlar" }).filter({ visible: true });
    const dockBottom = await mobileNav.evaluate((element) => Math.round(element.getBoundingClientRect().bottom));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await mobileNav.evaluate((element) => Math.round(element.getBoundingClientRect().bottom))).toBe(dockBottom);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await noOverflow(page);
  await page.screenshot({
    path: `../artifacts/catalog-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: "O'yinlar", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: "O'yinni tanlang" })).toBeVisible();
  await expect(page.locator('.tab-view')).toHaveCSS('opacity', '1');
  await expect(page.locator('.game-card')).toHaveCount(4);
  await page.getByLabel("O'yin qidirish").fill('PUBG');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Qidiruvni tozalash' }).click();
  await page.getByLabel('Faqat mavjudlar').check();
  await expect(page.locator('.game-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Mavzuni almashtirish' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('banner keeps one matching slide through repeated rotations and manual selection', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error' && /same key|Encountered two children/i.test(message.text())) errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('uzdonate_locale', 'ru'));
  await page.clock.install();
  await mockStore(page);
  await page.goto('/');
  // Smooth scrolling needs real animation frames; this test deliberately
  // controls the clock to exercise many rotations in seconds.
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  await expect(page.locator('.game-card')).toHaveCount(3);
  await page.clock.fastForward(2000);
  await expect(page.locator('.launch-screen')).toHaveCount(0);
  const banner = page.locator('.game-banner');
  const initialHeight = await banner.evaluate((element) => (element as HTMLElement).offsetHeight);

  for (let rotation = 0; rotation < 24; rotation++) {
    const currentGame = games[rotation % 3];
    await expect(banner.locator('.game-banner__slide')).toHaveCount(1);
    await expect(banner.locator('.game-banner__slide')).toHaveAttribute('data-game-id', currentGame.id);
    await expect(banner.locator('.game-banner__copy')).toHaveCount(1);
    await expect(banner.locator('.game-banner__art')).toHaveAttribute('src', currentGame.logoUrl!);
    await expect.poll(() => banner.locator('.game-banner__art').evaluate((element) => (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(banner.locator('.game-banner__title')).toHaveText(currentGame.slug === 'mobile-legends' ? 'Mobile Legends' : currentGame.name);
    expect(await banner.evaluate((element) => (element as HTMLElement).offsetHeight)).toBe(initialHeight);
    await page.clock.fastForward(4500);
  }

  await banner.scrollIntoViewIfNeeded();
  await page.clock.runFor(500);
  await banner.getByRole('button', { name: 'Free Fire', exact: true }).click();
  await page.clock.fastForward(18000);
  await expect(banner.locator('.game-banner__slide')).toHaveAttribute('data-game-id', 'game-3');
  await expect(banner.locator('.game-banner__copy')).toHaveCount(1);
  await page.screenshot({ path: `../artifacts/banner-ru-${info.project.name}.png`, fullPage: true });
  await banner.locator('.game-banner__slide').click();
  await expect(page.getByRole('dialog', { name: 'Free Fire' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('tablet Telegram webview keeps navigation inside the viewport', async ({ page }) => {
  await mockStore(page);
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: "Asosiy bo'limlar" })).toBeVisible();
  await noOverflow(page);
});
test('wallet top-up chooses the payment method before amount', async ({ page }, info) => {
  const sent = await mockStore(page);
  await page.goto('/');
  await page.getByRole('button', { name: "Balans to'ldirish", exact: true }).click();
  await expect(page.getByRole('heading', { name: "To'lov usulini tanlang" })).toBeVisible();
  await expect(page.locator('.wallet-balance-card')).toBeVisible();
  await expect(page.locator('.topup-progress > div')).toHaveCount(3);
  await page.locator('.wallet-sheet').evaluate(async (dialog) => {
    const entrance = dialog.getAnimations({ subtree: true }).filter((animation) =>
      Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await Promise.all(entrance.map((animation) => animation.finished.catch(() => {})));
  });
  await page.screenshot({
    path: `../artifacts/wallet-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name !== 'desktop') {
    const walletNav = page.getByRole('navigation', {
      name: "Balans sahifasi bo'limlari",
    });
    await expect(walletNav).toBeVisible();
    const bottomBeforeScroll = await walletNav.evaluate((element) => Math.round(element.getBoundingClientRect().bottom));
    await page.locator('.wallet-sheet>.checkout-form').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(walletNav).toBeVisible();
    expect(await walletNav.evaluate((element) => Math.round(element.getBoundingClientRect().bottom))).toBe(bottomBeforeScroll);
  }
  await page.getByRole('button', { name: /^HUMO/ }).click();
  await expect(page.getByRole('heading', { name: 'Summani kiriting' })).toBeVisible();
  await page.getByLabel("Summa, so'm").fill('75000');
  await page.getByRole('button', { name: "To'lov rekvizitlari" }).click();
  await expect(page.getByText('9860 1234 5678 9012')).toBeVisible();
  await expect(page.getByText('Avtomatik tekshirilmoqda')).toBeVisible();
  await expect(page.getByRole('button', { name: "To'lovni amalga oshirdim" })).toHaveCount(0);
  expect(sent.find((item) => item.path === '/topups/reserve')?.body).toMatchObject({
    amountMinor: 7500000,
    type: 'CARD_TRANSFER',
    channel: 'HUMO',
  });
});

test('Russian language can be selected and remains selected after reload', async ({ page }) => {
  await mockStore(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Русский язык' }).click();
  await expect(page.getByRole('navigation', { name: 'Основные разделы' })).toBeVisible();
  await page.getByRole('button', { name: 'Игры', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Выберите игру' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Основные разделы' })).toBeVisible();
});

test('busy top-up amount stays exact and offers free alternatives', async ({ page }) => {
  const sent = await mockStore(page, false, true);
  await page.goto('/');
  await page.getByRole('button', { name: "Balans to'ldirish", exact: true }).click();
  await page.getByRole('button', { name: /^HUMO/ }).click();
  await page.getByRole('button', { name: "To'lov rekvizitlari" }).click();
  await expect(page.getByText("50 000 so'm hozircha band")).toBeVisible();
  await expect(page.getByRole('button', { name: "50 100 so'm" })).toBeVisible();
  await page.waitForTimeout(450);
  await page.screenshot({ path: '../artifacts/topup-amount-busy.png' });
  await page.getByRole('button', { name: "50 100 so'm" }).click();
  await page.getByRole('button', { name: "To'lov rekvizitlari" }).click();
  await expect(page.getByText('9860 1234 5678 9012')).toBeVisible();
  const reserves = sent.filter((item) => item.path === '/topups/reserve');
  expect(reserves.map((item) => item.body.amountMinor)).toEqual([5000000, 5010000]);
});

test('copy feedback is shown only for the card that was copied', async ({ page }) => {
  await mockStore(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {} },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: "Balans to'ldirish", exact: true }).click();
  await page.getByRole('button', { name: /^HUMO/ }).click();
  await page.getByRole('button', { name: "To'lov rekvizitlari" }).click();
  const cardCopyButtons = page.getByRole('button', { name: 'Karta raqamini nusxalash' });
  await expect(cardCopyButtons).toHaveCount(2);
  await cardCopyButtons.nth(0).click();
  await expect(cardCopyButtons.nth(0)).toHaveClass(/copied/);
  await expect(cardCopyButtons.nth(0)).toHaveAttribute('title', 'Nusxalandi');
  await expect(cardCopyButtons.nth(1)).toHaveAttribute('title', 'Nusxalash');
  await expect(cardCopyButtons.nth(1)).not.toHaveClass(/copied/);
});

test('bankomat top-up sends a receipt for admin review', async ({ page }) => {
  const sent = await mockStore(page, false, false, false, false, true);
  await page.goto('/');
  await page.getByRole('button', { name: "Balans to'ldirish", exact: true }).click();
  await page.getByRole('button', { name: /^Bankomat/ }).click();
  await page.getByRole('button', { name: "To'lov rekvizitlari" }).click();
  await expect(page.getByText('Rezerv muddati tugadi, lekin bankomat chekini tekshiruvga yuborishingiz mumkin.')).toBeVisible();
  await page.getByLabel('Chek screenshotini yuklang').setInputFiles({
    name: 'chek.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await page.getByRole('button', { name: 'Chekni yuborish' }).click();
  await expect(page.getByText('Chek adminga yuborildi.')).toBeVisible();
  await expect(page.getByText('Admin tasdiqlashi yoki rad etishi bilan balans holati yangilanadi.')).toBeVisible();
  expect(sent.find((item) => item.path === '/topups/reserve')?.body).toMatchObject({ type: 'PAYNET_TERMINAL', channel: 'BANKOMAT' });
  const receipt = sent.find((item) => item.path === '/topups/topup-1/receipt')?.body;
  expect(receipt).toMatchObject({ fileName: 'chek.jpg', mimeType: 'image/jpeg' });
  expect(Buffer.from(String(receipt?.dataBase64), 'base64').subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
});
test('checkout validates player and zone, pays and shows server order', async ({ page }, info) => {
  const sent = await mockStore(page);
  await page.goto('/');
  await page.locator('.game-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.product-icon').nth(0)).toHaveAttribute('data-visual', 'diamond');
  await expect(page.locator('.product-icon').nth(1)).toHaveAttribute('data-visual', 'bonus');
  await expect(page.locator('.product-icon').nth(2)).toHaveAttribute('data-visual', 'pass');
  await expect(page.locator('.product-icon').nth(3)).toHaveAttribute('data-visual', 'twilight');
  await expect(page.locator('.product-icon img')).toHaveCount(4);
  await expect(page.getByLabel('Player ID', { exact: true })).toHaveCount(0);
  await page.getByRole('radio').first().click();
  await expect(page.getByRole('heading', { name: "O'yin hisobingizni kiriting" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `../artifacts/checkout-details-${info.project.name}.png`,
  });
  await page.getByLabel('Player ID', { exact: true }).fill('123456789');
  await page.getByLabel('Zone ID', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Davom etish' }).click();
  await expect(page.getByText('Akkaunt tasdiqlandi')).toBeVisible();
  await expect(page.getByText('Buyurtmani tasdiqlang')).toBeVisible();
  await expect(page.locator('.receipt')).toContainText('AsliddinMLBB');
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `../artifacts/checkout-${info.project.name}.png`,
  });
  await page.getByRole('button', { name: /to'lash/ }).click();
  await expect(page.getByRole('heading', { name: 'Xarid bajarildi' })).toBeVisible();
  const checkout = sent.find((item) => item.path === '/orders')!;
  expect(sent.find((item) => item.path === '/orders/validate-player')?.body).toMatchObject({ playerId: '123456789', zoneId: '1234' });
  expect(checkout.body.zoneId).toBe('1234');
  expect(checkout.body.idempotencyKey).toBeTruthy();
  await page.getByRole('button', { name: 'Buyurtmalarga borish' }).click();
  await page.getByRole('button', { name: 'Buyurtmalar', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.order-row')).toHaveCount(1);
  await noOverflow(page);
});

test('checkout offers in-place wallet top-up when balance is insufficient', async ({ page }) => {
  await mockStore(page, false, false, true);
  await page.goto('/');
  await page.locator('.game-card').first().click();
  await page.getByRole('radio').first().click();
  await page.getByLabel('Player ID', { exact: true }).fill('123456789');
  await page.getByLabel('Zone ID', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Davom etish' }).click();
  await expect(page.getByRole('button', { name: /Balansni to'ldirish/ })).toBeVisible();
  await page.getByRole('button', { name: /Balansni to'ldirish/ }).click();
  await expect(page.getByRole('heading', { name: "Balansni to'ldirish" })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Buyurtmani tasdiqlang')).toBeVisible();
  await expect(page.locator('.receipt')).toContainText('123456789');
});

test('MLBB checkout stays on identity step when Player ID and Zone ID do not match', async ({ page }) => {
  const sent = await mockStore(page, false, false, false, true);
  await page.goto('/');
  await page.locator('.game-card').first().click();
  await page.getByRole('radio').first().click();
  await page.getByLabel('Player ID', { exact: true }).fill('123456789');
  await page.getByLabel('Zone ID', { exact: true }).fill('9999');
  await page.getByRole('button', { name: 'Davom etish' }).click();
  await expect(page.getByRole('heading', { name: "O'yin hisobingizni kiriting" })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Zone ID does not match');
  expect(sent.some((item) => item.path === '/orders/validate-player')).toBe(true);
  expect(sent.some((item) => item.path === '/orders')).toBe(false);
});

test('saved game quick buy pre-fills player, server and zone for final review', async ({ page }) => {
  await mockStore(page);
  await page.goto('/');
  const savedGame = page.getByRole('button', { name: /123456789.*1234/ });
  await expect(savedGame).toBeVisible();
  await savedGame.click();
  await expect(page.getByRole('heading', { name: 'Paketni tanlang' })).toBeVisible();
  await page.getByRole('radio').first().click();
  await expect(page.getByRole('heading', { name: "O'yin hisobingizni kiriting" })).toBeVisible();
  await page.getByRole('button', { name: 'Davom etish' }).click();
  await expect(page.getByRole('heading', { name: 'Buyurtmani tasdiqlang' })).toBeVisible();
  await expect(page.locator('.receipt')).toContainText('AsliddinMLBB');
  await expect(page.locator('.receipt')).toContainText('123456789');
  await expect(page.locator('.receipt')).toContainText('1234');
  await expect(page.locator('.receipt')).toContainText('Global');
});

test('Telegram uses signed login with the same wallet experience', async ({ page }) => {
  const sent = await mockStore(page, true);
  await page.goto('/');
  await expect(page.locator('.payment-indicator')).toHaveCount(0);
  await expect(page.locator('.wallet-summary')).toContainText("50 000 so'm");
  await page.locator('.game-card').first().click();
  await page.getByRole('radio').first().click();
  await page.getByLabel('Player ID', { exact: true }).fill('123456789');
  await page.getByLabel('Zone ID', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Davom etish' }).click();
  await page.getByRole('button', { name: /15 500 so'm to'lash/ }).click();
  await expect(page.getByRole('heading', { name: 'Xarid bajarildi' })).toBeVisible();
  expect(sent.some((item) => item.path === '/auth/telegram')).toBe(true);
  expect(sent.some((item) => item.path === '/telegram/invoices')).toBe(false);
  expect(sent.some((item) => item.path === '/payments/wallet')).toBe(true);
});
test('failed catalog request has a working retry', async ({ page }) => {
  await mockStore(page);
  let failures = 1;
  await page.route('**/api/v1/games', (route) => (failures-- > 0 ? route.fulfill({ status: 503, json: { error: { message: 'Offline' } } }) : route.fallback()));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Qayta urinish' }).click();
  await expect(page.locator('.game-card')).toHaveCount(3);
});

function registeredSession() {
  return { accessToken: 'registered-token', refreshToken: 'registered-refresh', user: {
    id: 'registered-user', publicId: 'UZD-SAVED123', displayName: 'Website user',
    email: 'player@example.com', isGuest: false, hasTelegramAccount: false,
  } };
}

test('Telegram links to the current website account using a request-bound code', async ({ page }) => {
  await mockStore(page);
  await page.addInitScript(() => { window.open = () => null; });
  const request = { id: '81d07e85-2a55-4222-9c87-d8da851102db', provider: 'telegram', intent: 'link', requestSecret: 'isolated-request-secret-at-least-40-characters', authorizeUrl: 'https://t.me/uzdonate1bot?start=auth_test', expiresAt: '2099-01-01T00:00:00Z' };
  let exchange: Record<string, unknown> | undefined;
  await page.route('**/auth/requests/link', (route) => route.fulfill({ json: request }));
  await page.route(`**/auth/requests/${request.id}/exchange`, (route) => {
    exchange = route.request().postDataJSON();
    const result = registeredSession(); result.user.id = 'user-1'; result.user.publicId = 'UZD-TEST1234'; result.user.hasTelegramAccount = true;
    return route.fulfill({ json: result });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Hisobni saqlash', exact: true }).click();
  await page.getByRole('button', { name: 'Telegram hisobini ulash', exact: true }).click();
  await page.getByLabel('Telegram tasdiqlash kodi', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Kirishni tasdiqlash', exact: true }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.locator('.store-heading h1')).toHaveText('Website user');
  expect(exchange).toEqual({ requestSecret: request.requestSecret, code: '12345678' });
});

test('Google inside Telegram uses the external browser code flow', async ({ page }) => {
  await mockStore(page, true);
  await page.route('**/app/config', (route) => route.fulfill({ json: { googleClientId: 'test.apps.googleusercontent.com', telegramPaymentsEnabled: true } }));
  const request = { id: '108a6951-9e51-441d-9739-5e8c2a435d4a', provider: 'google', intent: 'link', requestSecret: 'isolated-google-request-secret-at-least-40-characters', authorizeUrl: 'https://uzdonate.uz/webapp/?auth_request=108a6951-9e51-441d-9739-5e8c2a435d4a', expiresAt: '2099-01-01T00:00:00Z' };
  await page.route('**/auth/requests/link', (route) => route.fulfill({ json: request }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil', exact: true }).filter({ visible: true }).last().click();
  await page.getByRole('button', { name: 'Hisobni saqlash', exact: true }).click();
  await page.getByRole('button', { name: 'Google hisobini ulash', exact: true }).click();
  await expect(page.getByLabel('Google tasdiqlash kodi', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Googleni ochish', exact: true })).toHaveAttribute('href', request.authorizeUrl);
  await expect(page.locator('iframe[title="Sign in with Google Button"]')).toHaveCount(0);
});

test('the external Google page returns a one-time code without creating a guest account', async ({ page }) => {
  const id = 'f3a0dfc8-d388-4ff0-9ea3-ed4095af68c8';
  let guestCreated = false;
  await page.route('**/auth/guest', (route) => { guestCreated = true; return route.fulfill({ status: 500 }); });
  await page.route(`**/auth/requests/${id}`, (route) => route.fulfill({ json: { provider: 'google', intent: 'link', locale: 'uz', googleClientId: 'test.apps.googleusercontent.com' } }));
  await page.route(`**/auth/requests/${id}/google`, (route) => route.fulfill({ json: { code: '12345678' } }));
  await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ contentType: 'text/javascript', body: `let callback;window.google={accounts:{id:{initialize(options){callback=options.callback},renderButton(host){const b=document.createElement('button');b.textContent='Test Google confirmation';b.onclick=()=>callback({credential:'isolated-google-token'});host.append(b)}}}};` }));
  await page.goto(`/?auth_request=${id}`);
  await page.getByRole('button', { name: 'Test Google confirmation', exact: true }).click();
  await expect(page.locator('.identity-code')).toHaveText('12345678');
  expect(guestCreated).toBe(false);
});

async function openWebsiteLogin(page: Page) {
  if (await page.locator('.header-login').isVisible()) await page.locator('.header-login').click();
  else {
    await page.getByRole('button', { name: 'Profil', exact: true }).filter({ visible: true }).last().click();
    await page.getByRole('button', { name: 'Mavjud hisobga kirish', exact: true }).click();
  }
}

test('a guest can save the current account using an email code and then sign out', async ({ page }) => {
  await mockStore(page);
  let completed: Record<string, unknown> | undefined;
  await page.route('**/auth/register/request-code', (route) => route.fulfill({ status: 204 }));
  await page.route('**/auth/account/complete', (route) => {
    completed = route.request().postDataJSON();
    return route.fulfill({ json: registeredSession() });
  });
  await page.route('**/auth/logout', (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Hisobni saqlash', exact: true }).click();
  await page.getByLabel('Ismingiz', { exact: true }).fill('Website user');
  await page.getByLabel('Email', { exact: true }).fill('player@example.com');
  await page.getByRole('button', { name: 'Kod yuborish', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('6 xonali kod');
  await page.getByLabel('Tasdiqlash kodi', { exact: true }).fill('123456');
  await page.getByLabel('Yangi parol', { exact: true }).fill('SecurePassword42!');
  await noOverflow(page);
  await page.screenshot({ path: `../artifacts/auth-${test.info().project.name}.png` });
  await page.locator('.sheet').getByRole('button', { name: 'Hisobni saqlash', exact: true }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.locator('.store-heading h1')).toHaveText('Website user');
  expect(completed).toEqual({ email: 'player@example.com', code: '123456', password: 'SecurePassword42!' });
  await page.getByRole('button', { name: 'Profil', exact: true }).filter({ visible: true }).last().click();
  await page.getByRole('button', { name: 'Hisobdan chiqish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mavjud hisobga kirish', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hisobdan chiqish', exact: true })).toHaveCount(0);
});

test('password recovery verifies an email code and returns to the registered account', async ({ page }) => {
  await mockStore(page);
  let reset: Record<string, unknown> | undefined;
  await page.route('**/auth/password/reset-request', (route) => route.fulfill({ status: 204 }));
  await page.route('**/auth/password/reset', (route) => {
    reset = route.request().postDataJSON();
    return route.fulfill({ json: registeredSession() });
  });
  await page.goto('/');
  await openWebsiteLogin(page);
  await page.getByRole('button', { name: 'Parolni unutdingizmi?', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('player@example.com');
  await page.getByRole('button', { name: 'Kod yuborish', exact: true }).click();
  await page.getByLabel('Tasdiqlash kodi', { exact: true }).fill('654321');
  await page.getByLabel('Yangi parol', { exact: true }).fill('UpdatedPassword42!');
  await page.getByRole('button', { name: 'Parolni yangilash', exact: true }).click();
  await page.getByRole('button', { name: 'Asosiy', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.store-heading h1')).toHaveText('Website user');
  expect(reset).toEqual({ email: 'player@example.com', code: '654321', newPassword: 'UpdatedPassword42!' });
});

test('switching accounts ignores wallet responses still arriving for the old account', async ({ page }) => {
  await mockStore(page);
  let releaseOldWallet!: () => void;
  let oldWalletRequested!: () => void;
  const requested = new Promise<void>((resolve) => { oldWalletRequested = resolve; });
  const released = new Promise<void>((resolve) => { releaseOldWallet = resolve; });
  await page.route('**/api/v1/wallet', async (route) => {
    if (route.request().headers().authorization === 'Bearer registered-token') {
      await route.fulfill({ json: { balanceMinor: 7_000_000, currency: 'UZS' } });
    } else {
      oldWalletRequested(); await released;
      await route.fulfill({ json: { balanceMinor: 5_000_000, currency: 'UZS' } });
    }
  });
  await page.route('**/auth/login', (route) => route.fulfill({ json: registeredSession() }));
  await page.goto('/');
  await requested;
  await openWebsiteLogin(page);
  await page.getByLabel('Email', { exact: true }).fill('player@example.com');
  await page.getByLabel('Parol', { exact: true }).fill('SecurePassword42!');
  await page.locator('.sheet').getByRole('button', { name: 'Kirish', exact: true }).click();
  await page.getByRole('button', { name: 'Asosiy', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.wallet-summary')).toContainText("70 000 so'm");
  releaseOldWallet();
  await expect(page.locator('.wallet-summary')).toContainText("70 000 so'm");
  await expect(page.locator('.store-heading h1')).toHaveText('Website user');
});

test('reduced motion keeps the storefront usable and keyboard sheet focus returns to its trigger', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockStore(page, true);
  await page.goto('/');
  await expect(page.locator('.launch-screen')).toHaveCount(0);
  await expect(page.locator('.app-shell[inert]')).toHaveCount(0);
  const card = page.locator('.game-card').first();
  await expect(card).toBeVisible();
  await expect(page.locator('.tab-view')).toHaveCSS('animation-name', 'none');
  const initialSlide = await page.locator('.game-banner__slide').getAttribute('data-game-id');
  await page.waitForTimeout(4700);
  expect(await page.locator('.game-banner__slide').getAttribute('data-game-id')).toBe(initialSlide);
  await card.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Mobile Legends: Bang Bang' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Yopish', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeFocused();
  await noOverflow(page);
});

test('empty states, translated dialog controls and light theme remain readable', async ({ page }, info) => {
  await mockStore(page, true);
  await page.goto('/');
  await expect(page.locator('.launch-screen')).toHaveCount(0);
  await page.screenshot({ path: `../artifacts/brand-refresh/storefront-dark-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  await page.locator('.wallet-action').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: `../artifacts/brand-refresh/wallet-dark-${info.project.name}.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Buyurtmalar', exact: true }).filter({ visible: true }).last().click();
  await expect(page.getByRole('heading', { name: "Hozircha buyurtmalar yo'q" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `../artifacts/brand-refresh/empty-orders-${info.project.name}.png`, animations: 'disabled' });
  await page.getByRole('button', { name: 'Русский язык' }).click();
  await page.getByRole('button', { name: 'Сменить тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Главная', exact: true }).filter({ visible: true }).last().click();
  await page.screenshot({ path: `../artifacts/brand-refresh/storefront-light-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  await page.locator('.wallet-action').click();
  const dialog = page.getByRole('dialog', { name: 'Пополнить баланс' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Закрыть', exact: true })).toBeVisible();
  await expect(dialog).toContainText('Выберите удобный способ и следуйте инструкциям.');
  if (info.project.name !== 'desktop') {
    const contrast = await dialog.locator('.wallet-bottom-nav .nav-wallet.active').evaluate((element) => {
      const style = getComputedStyle(element);
      const luminance = (value: string) => {
        const context = document.createElement('canvas').getContext('2d')!;
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map((channel) => {
          const c = channel / 255;
          return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
        });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const a = luminance(style.color), b = luminance(style.backgroundColor);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
  await noOverflow(page);
  await page.screenshot({ path: `../artifacts/brand-refresh/wallet-light-${info.project.name}.png`, animations: 'disabled' });
});

test('catalog loading is announced and primary actions have readable contrast', async ({ page }) => {
  await mockStore(page);
  let releaseCatalog!: () => void;
  const released = new Promise<void>((resolve) => { releaseCatalog = resolve; });
  await page.route('**/api/v1/games', async (route) => {
    await released;
    await route.fulfill({ json: { games } });
  });
  await page.goto('/');
  await expect(page.getByRole('status', { name: 'Katalog yuklanmoqda' })).toBeVisible();
  await noOverflow(page);
  releaseCatalog();
  await expect(page.locator('.game-card')).toHaveCount(3);
  const contrast = await page.locator('.wallet-action').evaluate((element) => {
    const style = getComputedStyle(element);
    const luminance = (value: string) => {
      const channels = value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => {
        const c = channel / 255;
        return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test('normal motion intro finishes and releases keyboard navigation and game sheets', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mockStore(page, true);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.launch-screen')).toBeVisible();
  await expect(page.locator('.app-shell[inert]')).toHaveCount(1);
  await page.keyboard.press('Tab');
  expect(await page.locator('.app-shell').evaluate((element) => element.contains(document.activeElement))).toBe(false);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `../artifacts/brand-refresh/intro-orbit-${info.project.name}.png` });
  await page.screenshot({ path: `../artifacts/brand-refresh/intro-settled-${info.project.name}.png`, animations: 'disabled' });
  await expect(page.locator('.launch-screen')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.app-shell[inert]')).toHaveCount(0);
  await expect(page.locator('.wallet-summary')).toContainText("50 000 so'm");
  await page.screenshot({ path: `../artifacts/brand-refresh/intro-complete-${info.project.name}.png`, animations: 'disabled' });
  await page.getByRole('button', { name: "O'yinlar", exact: true }).filter({ visible: true }).last().click();
  await expect(page.getByRole('heading', { name: "O'yinni tanlang" })).toBeVisible();
  const card = page.locator('.game-card').first();
  await card.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Mobile Legends: Bang Bang' });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: `../artifacts/brand-refresh/navigation-sheet-${info.project.name}.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeFocused();
  await noOverflow(page);
});

test('turning on reduced motion during the intro immediately makes the app interactive', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mockStore(page, true);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.launch-screen')).toBeVisible();
  await expect(page.locator('.app-shell[inert]')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.launch-screen')).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator('.app-shell[inert]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Buyurtmalar', exact: true }).filter({ visible: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Xaridlar tarixi' })).toBeVisible();
  const shop = page.getByRole('button', { name: "Do'konga o'tish" });
  await shop.focus();
  await expect(shop).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.wallet-summary')).toBeVisible();
  await expect(page.locator('.launch-screen')).toHaveCount(0);
  await noOverflow(page);
});

test('focused banner selection reveals its new copy while decorative artwork stays still', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mockStore(page, true);
  await page.goto('/');
  await expect(page.locator('.launch-screen')).toHaveCount(0);
  const banner = page.locator('.game-banner');
  await banner.scrollIntoViewIfNeeded();
  const selector = banner.getByRole('button', { name: 'Free Fire', exact: true });
  await selector.focus();
  await page.keyboard.press('Enter');
  await expect(selector).toBeFocused();
  await expect(banner.locator('.game-banner__title')).toHaveText('Free Fire');
  await expect(banner.locator('.game-banner__slide')).toHaveCSS('opacity', '1', { timeout: 2000 });
  for (const content of ['.game-banner__title', '.game-banner__description', '.game-banner__cta']) {
    await expect(banner.locator(content)).toHaveCSS('opacity', '1', { timeout: 2000 });
  }
  await expect(banner.locator('.game-banner__art')).toHaveCSS('animation-play-state', 'paused');
  await expect(selector).toBeFocused();
  await noOverflow(page);
  await page.screenshot({ path: `../artifacts/brand-refresh/banner-focused-${info.project.name}.png`, animations: 'disabled' });
});
