import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test-reports/e2e');
// Serve only this generated report, on loopback, for an authentic browser screenshot.
const server = createServer(async (request, response) => {
  const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, 'report', '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(path.join(root, 'report') + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(file);
    response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    response.end(data);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await expect(page.getByRole('link', { name: /All/ }).first()).toBeVisible();
  await expect(page.getByText('customer-mocked-ui.spec.js', { exact: true }).first()).toBeVisible();
  await mkdir(path.join(root, 'evidence'), { recursive: true });
  const screenshot = path.join(root, 'evidence/report.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(screenshot);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
