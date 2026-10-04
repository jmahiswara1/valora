import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: 'list',
  outputDir: '../../.local/playwright-results',
  use: { baseURL: 'http://127.0.0.1:3002', channel: 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    { command: 'node scripts/start-e2e.mjs', cwd: '../api', url: 'http://127.0.0.1:4001/api/v1/categories', timeout: 60000 },
    { command: 'node node_modules/next/dist/bin/next dev -p 3002', url: 'http://127.0.0.1:3002', timeout: 120000, env: { API_INTERNAL_ORIGIN: 'http://127.0.0.1:4001', NEXT_BUILD_DIRECTORY: '.next-e2e' } },
  ],
});
