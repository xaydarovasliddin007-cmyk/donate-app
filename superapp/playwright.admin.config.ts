import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Reuse the monorepo's browser test dependency for the admin application.
export default defineConfig({
  testDir: './tests-admin', timeout: 30000, workers: 1, retries: 0,
  outputDir: '../artifacts/playwright-admin',
  use: { baseURL: 'http://127.0.0.1:3002', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3002 --strictPort', cwd: fileURLToPath(new URL('../admin/', import.meta.url)), url: 'http://127.0.0.1:3002/admin/', reuseExistingServer: !process.env.CI },
});
