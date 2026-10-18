import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, '../test-reports/e2e');
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  forbidOnly: true,
  timeout: 30000,
  outputDir: path.join(output, 'artifacts'),
  reporter: [['list'], ['html', { outputFolder: path.join(output, 'report'), open: 'never' }],
    ['junit', { outputFile: path.join(output, 'junit.xml') }]],
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    screenshot: 'only-on-failure', trace: 'retain-on-failure', video: 'retain-on-failure',
    reducedMotion: 'reduce', serviceWorkers: 'block' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'node scripts/start-app.mjs', cwd: here,
    url: 'http://127.0.0.1:5173', reuseExistingServer: false, timeout: 60000,
  },
});
