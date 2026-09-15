import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 30000, retries: 0, workers: 1,
  outputDir: '../artifacts/playwright',
  use: { baseURL: 'http://127.0.0.1:3001', headless: true, channel: 'msedge', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'msedge' } },
    { name: 'small-mobile', use: { viewport: { width: 320, height: 740 }, isMobile: true } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 3001 --strictPort', url: 'http://127.0.0.1:3001', reuseExistingServer: !process.env.CI },
});
