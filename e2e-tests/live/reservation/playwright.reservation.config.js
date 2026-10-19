import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.E2E_RESERVATION_RUN_ID) throw new Error('Use npm run test:live:reservation.');
const output = path.resolve(here, '../../../test-reports/e2e-reservation-live');
export default defineConfig({
  testDir: '.', testMatch: 'reservation.live.spec.js', workers: 1, retries: 0, forbidOnly: true,
  timeout: 60000, expect: { timeout: 15000 }, outputDir: path.join(output, 'artifacts'),
  reporter: [[path.resolve(here, '../redact-reporter.mjs')], ['list'],
    ['html', { outputFolder: path.join(output, 'report'), open: 'never' }],
    ['junit', { outputFile: path.join(output, 'junit.xml') }]],
  use: { baseURL: 'http://127.0.0.1:15174', screenshot: 'only-on-failure',
    video: 'retain-on-failure', trace: 'off', serviceWorkers: 'block', reducedMotion: 'reduce' },
  projects: [{ name: 'chromium-reservation-live', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node live/reservation/start-frontend.mjs', cwd: path.resolve(here, '../..'),
    url: 'http://127.0.0.1:15174', reuseExistingServer: false, timeout: 60000,
  },
});
