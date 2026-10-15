import { expect, test, type Page } from '@playwright/test';

async function mockPanel(page: Page, manual = true) {
  const calls: { body: unknown }[] = [];
  let verified = false;
  let imageAuth = '';
  await page.addInitScript(() => {
    localStorage.setItem('uzdonate_admin_access_token', 'isolated-admin-token');
    localStorage.setItem('uzdonate_admin_refresh_token', 'isolated-admin-refresh');
    localStorage.setItem('uzdonate_admin_locale', 'uz');
  });
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { id: 'isolated-admin', email: 'finance@example.com', fullName: 'Test Finance', role: 'FINANCE' } });
    if (path.endsWith('/topups/topup-test/receipt')) {
      imageAuth = route.request().headers().authorization;
      return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
    }
    if (path.endsWith('/topups/topup-test/verify')) {
      calls.push({ body: route.request().postData() ? route.request().postDataJSON() : undefined }); verified = true;
      return route.fulfill({ json: { status: 'VERIFIED' } });
    }
    if (path.endsWith('/topups')) return route.fulfill({ json: { topUps: verified ? [] : [{ id: 'topup-test', type: manual ? 'PAYNET_TERMINAL' : 'CARD_TRANSFER', channel: manual ? 'BANKOMAT' : 'HUMO', amountMinor: 5_000_000, currency: 'UZS', status: 'PENDING', userReference: 'Chek: bankomat.png', userConfirmedPaidAt: '2026-10-15T19:00:00Z', createdAt: '2026-10-15T19:00:00Z', receivingMethod: null, receipt: { fileName: 'bankomat.png', mimeType: 'image/png', deliveryStatus: 'FAILED' }, user: { id: 'test-user', publicId: 'UZD-TEST', displayName: 'Test Bankomat User' } }] } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/topups');
  await expect(page.getByText('Test Bankomat User', { exact: true })).toBeVisible();
  return { calls, imageAuth: () => imageAuth };
}

test('Bankomat actual amount requires a reason and an explicit amount confirmation', async ({ page }) => {
  const { calls } = await mockPanel(page);
  await page.getByRole('button', { name: 'Boshqa summa', exact: true }).click();
  await page.getByLabel('Haqiqiy tushgan summa, so‘m').fill('48 000,50');
  await page.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Summa nima sababdan');
  expect(calls).toHaveLength(0);
  await page.getByLabel('Summa o‘zgarishi sababi').fill('Bank ko‘chirmasidagi haqiqiy summa');
  await page.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('foydalanuvchi balansiga');
  await expect(dialog).toContainText('UZS');
  expect(calls).toHaveLength(0);
  await page.screenshot({ path: '../artifacts/payments/admin-bankomat-confirmation-preview.png' });
  await dialog.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await expect(page.getByText('Test Bankomat User', { exact: true })).toHaveCount(0);
  expect(calls).toEqual([{ body: { amountMinor: 4_800_050, reviewNote: 'Bank ko‘chirmasidagi haqiqiy summa' } }]);
});

test('cancelling a top-up confirmation never credits a payment', async ({ page }) => {
  const { calls } = await mockPanel(page);
  await page.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bekor qilish', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(calls).toHaveLength(0);
});

test('receipt preview authenticates its image request and uses a local blob URL', async ({ page }) => {
  const { imageAuth } = await mockPanel(page);
  await page.getByRole('button', { name: 'Chekni ko‘rish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Chekni ko‘rish' });
  await expect(dialog.getByRole('img')).toBeVisible();
  await expect(dialog.getByRole('img')).toHaveAttribute('src', /^blob:/);
  expect(imageAuth()).toBe('Bearer isolated-admin-token');
  await dialog.getByRole('button', { name: 'Bekor qilish', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('automatic card payments do not expose a manual amount override', async ({ page }) => {
  await mockPanel(page, false);
  await expect(page.getByRole('button', { name: 'Boshqa summa', exact: true })).toHaveCount(0);
});
