import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.E2E_LIVE_RUN_ID) throw new Error('Run this suite with npm run test:live.');
const output = path.resolve(here, '../../test-reports/e2e-live');
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  // A successful registration triggers a full document reload; allow cold Vite/.NET startup.
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: path.join(output, 'artifacts'),
  reporter: [[path.join(here, 'redact-reporter.mjs')], ['list'], ['html', { outputFolder: path.join(output, 'report'), open: 'never' }],
    ['junit', { outputFile: path.join(output, 'junit.xml') }]],
  use: {
    baseURL: `http://127.0.0.1:${process.env.E2E_LIVE_FRONTEND_PORT}`,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Authentication traces/HARs would retain request passwords and issued JWTs.
    trace: 'off', serviceWorkers: 'block', reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium-live', use: { ...devices['Desktop Chrome'] } }],
});
