import { expect, test, type Page } from '@playwright/test';

const games = [
  { id: 'game-1', slug: 'mobile-legends', name: 'Mobile Legends: Bang Bang', category: 'MOBA', logoUrl: '/assets-store/diamond.png', availability: 'ACTIVE', isPurchasable: true },
  { id: 'game-2', slug: 'pubg-mobile', name: 'PUBG Mobile', category: 'Battle Royale', logoUrl: '/assets-store/brand.png', availability: 'ACTIVE', isPurchasable: true },
  { id: 'game-3', slug: 'free-fire', name: 'Free Fire', category: 'Battle Royale', logoUrl: '/assets-store/diamond.png', availability: 'ACTIVE', isPurchasable: true },
  { id: 'game-4', slug: 'valorant', name: 'Valorant', category: 'FPS', logoUrl: null, availability: 'COMING_SOON', isPurchasable: false },
];
async function mockStore(page: Page, tg = false, busyTopup = false) {
  let orders: object[] = [];
  const sent: { path: string; body: Record<string, unknown> }[] = [];
  await page.route('https://telegram.org/**', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
  if (tg) await page.addInitScript(() => {
    (window as unknown as { Telegram: object }).Telegram = { WebApp: {
      initData: 'test-signed-data', ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {},
      BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
      openInvoice(_url: string, callback: (status: string) => void) { callback('paid'); },
    } };
  });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : undefined;
    if (body) sent.push({ path, body });
    let data: unknown;
    if (path.startsWith('/auth/')) data = { accessToken: 'test-token', refreshToken: 'test-refresh', user: { id: 'user-1', publicId: 'UZD-TEST1234', displayName: 'Asliddin', isGuest: !tg, hasTelegramAccount: tg } };
    else if (path === '/games') data = { games };
    else if (path.endsWith('/servers')) data = { servers: [{ id: 'server-1', code: 'GLOBAL', name: 'Global' }] };
    else if (path.endsWith('/products')) data = { products: [{ id: 'product-1', name: '86 Diamonds', amountMinor: 1550000, currency: 'UZS', starsPrice: 65 }] };
    else if (path === '/wallet') data = { balanceMinor: 5000000, currency: 'UZS' };
    else if (path === '/app/config') data = { supportUrl: 'https://t.me/uzdonate_support', telegramBotUrl: 'https://t.me/uzdonate1bot', telegramPaymentsEnabled: true };
    else if (path === '/topups/options') data = { options: [
      { id: 'HUMO', label: 'HUMO', mode: 'AUTO', available: true },
      { id: 'UZCARD', label: 'UZCARD', mode: 'AUTO', available: true },
      { id: 'BANKOMAT', label: 'Bankomat', mode: 'MANUAL', available: true },
    ] };
    else if (path === '/topups/reserve') {
      if (busyTopup && body.amountMinor === 5000000) return route.fulfill({ status: 409, json: { error: { code: 'TOPUP_AMOUNT_BUSY', message: 'Busy', details: { requestedAmountMinor: 5000000, suggestedAmountsMinor: [5010000, 5020000] } } } });
      data = { id: 'topup-1', amountMinor: body.amountMinor, currency: 'UZS', type: body.type, channel: body.channel, status: 'PENDING', expiresAt: new Date(Date.now() + 420000).toISOString(), receivingMethods: [{ id: 'method-1', type: 'CARD_TRANSFER', cardNumber: '9860 1234 5678 9012', cardHolderName: 'UZDONATE', bankName: 'Test Bank', cardNetwork: body.channel === 'UZCARD' ? 'UZCARD' : 'HUMO' }] };
    }
    else if (path === '/topups/topup-1/confirm-paid') data = { id: 'topup-1', status: 'PENDING' };
    else if (path === '/topups/topup-1/receipt') data = { id: 'topup-1', status: 'PENDING', userReference: 'Telegram chek #1' };
    else if (path === '/topups') data = { topUps: [] };
    else if (path === '/orders' && !body) data = { orders };
    else if (path === '/orders' || path === '/telegram/invoices') {
      const order = { id: 'order-1', orderNumber: 'UZD123', game: games[0], items: [{ productName: '86 Diamonds' }], playerId: body.playerId, zoneId: body.zoneId, amountMinor: tg ? 6500 : 1550000, currency: tg ? 'XTR' : 'UZS', status: 'COMPLETED', createdAt: '2026-09-15T10:00:00Z' };
      orders = [order]; data = path.includes('invoices') ? { invoiceUrl: 'https://t.me/$test-invoice', orderId: 'order-1' } : order;
    } else if (path === '/payments/wallet') data = { status: 'SUCCEEDED' };
    else if (path === '/orders/order-1') data = orders[0];
    else return route.fulfill({ status: 404, json: { error: { message: 'Not found' } } });
    await route.fulfill({ json: data });
  });
  return sent;
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('catalog filters, light mode and responsive layout', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await mockStore(page); await page.goto('/');
  await expect(page.locator('.game-card')).toHaveCount(3);
  await page.waitForTimeout(1500);
  if (info.project.name !== 'desktop') {
    const mobileNav = page.getByRole('navigation', { name: "Asosiy bo'limlar" }).filter({ visible: true });
    const dockBottom = await mobileNav.evaluate((element) => Math.round(element.getBoundingClientRect().bottom));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await mobileNav.evaluate((element) => Math.round(element.getBoundingClientRect().bottom))).toBe(dockBottom);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await noOverflow(page);
  await page.screenshot({ path: `../artifacts/catalog-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: "O'yinlar", exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.tab-view')).toHaveCSS('animation-name', 'tab-enter');
  await expect(page.locator('.game-card')).toHaveCount(4);
  await page.getByLabel("O'yin qidirish").fill('PUBG');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Qidiruvni tozalash' }).click();
  await page.getByLabel('Faqat mavjudlar').check();
  await expect(page.locator('.game-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Mavzuni almashtirish' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await noOverflow(page); expect(errors).toEqual([]);
});
test('wallet top-up chooses the payment method before amount', async ({ page }, info) => {
  const sent = await mockStore(page); await page.goto('/');
  await page.getByRole('button', { name: "Balans to'ldirish", exact: true }).click();
  await expect(page.getByRole('heading', { name: "To'lov usulini tanlang" })).toBeVisible();
  if (info.project.name !== 'desktop') {
    const walletNav = page.getByRole('navigation', { name: "Balans sahifasi bo'limlari" });
    await expect(walletNav).toBeVisible();
    const bottomBeforeScroll = await walletNav.evaluate((element) => Math.round(element.getBoundingClientRect().bottom));
    await page.locator('.wallet-sheet>.checkout-form').evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(walletNav).toBeVisible();
    expect(await walletNav.evaluate((element) => Math.round(element.getBoundingClientRect().bottom))).toBe(bottomBeforeScroll);
  }
  await page.screenshot({ path: `../artifacts/wallet-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: /^HUMO/ }).click();
  await expect(page.getByRole('heading', { name: 'Summani kiriting' })).toBeVisible();
  await page.getByLabel("Summa, so'm").fill('75000');
  await page.getByRole('button', { name: "To'lov rekvizitlari" }).click();
  await expect(page.getByText('9860 1234 5678 9012')).toBeVisible();
  expect(sent.find((item) => item.path === '/topups/reserve')?.body).toMatchObject({ amountMinor: 7500000, type: 'CARD_TRANSFER', channel: 'HUMO' });
});

test('busy top-up amount stays exact and offers free alternatives', async ({ page }) => {
  const sent = await mockStore(page, false, true); await page.goto('/');
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

test('bankomat top-up sends a receipt for admin review', async ({ page }) => {
  const sent = await mockStore(page); await page.goto('/');
  await page.getByRole('button', { name: "Balans to'ldirish", exact: true }).click();
  await page.getByRole('button', { name: /^Bankomat/ }).click();
  await page.getByRole('button', { name: "To'lov rekvizitlari" }).click();
  await page.getByLabel('Chek screenshotini yuklang').setInputFiles({
    name: 'chek.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await page.getByRole('button', { name: 'Chekni yuborish' }).click();
  await expect(page.getByText('Chek adminga yuborildi. Tasdiqlangach balans yangilanadi.')).toBeVisible();
  expect(sent.find((item) => item.path === '/topups/reserve')?.body).toMatchObject({ type: 'PAYNET_TERMINAL', channel: 'BANKOMAT' });
  expect(sent.find((item) => item.path === '/topups/topup-1/receipt')?.body).toMatchObject({ fileName: 'chek.png', mimeType: 'image/png' });
});
test('checkout validates player and zone, pays and shows server order', async ({ page }, info) => {
  const sent = await mockStore(page); await page.goto('/');
  await page.locator('.game-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('radio').first().click();
  await page.getByLabel('Player ID', { exact: true }).fill('123456789');
  await page.getByLabel('Zone ID', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Davom etish' }).click();
  await expect(page.getByText('Buyurtmani tasdiqlang')).toBeVisible();
  await page.screenshot({ path: `../artifacts/checkout-${info.project.name}.png` });
  await page.getByRole('button', { name: /to'lash/ }).click();
  await expect(page.getByRole('heading', { name: 'Xarid bajarildi' })).toBeVisible();
  const checkout = sent.find((item) => item.path === '/orders')!;
  expect(checkout.body.zoneId).toBe('1234'); expect(checkout.body.idempotencyKey).toBeTruthy();
  await page.getByRole('button', { name: 'Tayyor', exact: true }).click();
  await page.getByRole('button', { name: 'Buyurtmalar', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.order-row')).toHaveCount(1); await noOverflow(page);
});
test('Telegram uses signed login with the same wallet experience', async ({ page }) => {
  const sent = await mockStore(page, true); await page.goto('/');
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
  await mockStore(page); let failures = 1;
  await page.route('**/api/v1/games', (route) => failures-- > 0 ? route.fulfill({ status: 503, json: { error: { message: 'Offline' } } }) : route.fallback());
  await page.goto('/'); await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Qayta urinish' }).click();
  await expect(page.locator('.game-card')).toHaveCount(3);
});
