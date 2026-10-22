import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { guardedConnection } from '../database.mjs';

const identityOrigin = `http://127.0.0.1:${process.env.E2E_LIVE_IDENTITY_PORT}`;
const test = base.extend({
  seedAccount: [true, { option: true }],
  account: async ({ request, page, seedAccount }, use, testInfo) => {
    const account = { fullName: 'Bandara Live Test Guest',
      email: `bandara-live-${randomUUID()}@example.com`,
      password: process.env.E2E_LIVE_ACCOUNT_PASSWORD, role: 'Customer' };
    const traffic = [];
    const pending = [];
    page.on('response', response => {
      if (new URL(response.url()).origin === identityOrigin) {
        traffic.push({ method: response.request().method(),
          path: new URL(response.url()).pathname, status: response.status() });
        pending.push(response.finished());
      }
    });
    // Teardown encloses setup too, so even partially successful registration is cleaned.
    try {
      if (seedAccount) {
        const response = await request.post(`${identityOrigin}/api/auth/register`, { data: account });
        expect(response.status(), 'Seed account is created by the real Identity Service').toBe(201);
      }
      await use(account);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
        await page.screenshot({ path: testInfo.outputPath('live-failure.png'), fullPage: true }).catch(() => {});
      }
      await page.close();
      await Promise.allSettled(pending);
      const db = await guardedConnection();
      try {
        const [users] = await db.execute('SELECT UserId FROM Users WHERE Email = ?', [account.email]);
        const ids = users.map(user => user.UserId);
        await db.execute('DELETE FROM Users WHERE Email = ?', [account.email]);
        const [[remaining]] = await db.execute('SELECT COUNT(*) AS count FROM Users WHERE Email = ?', [account.email]);
        expect(Number(remaining.count), 'Owned account removed from MySQL').toBe(0);
        for (const id of ids) {
          const [[roles]] = await db.execute('SELECT COUNT(*) AS count FROM UserRoles WHERE UserId = ?', [id]);
          expect(Number(roles.count), 'Cascading user-role cleanup completed').toBe(0);
        }
        await testInfo.attach('real-api-and-cleanup', { contentType: 'application/json',
          body: Buffer.from(JSON.stringify({ traffic, deletedUsers: ids.length,
            remainingUsers: Number(remaining.count), roleMappingsRemaining: 0 }, null, 2)) });
      } finally { await db.end(); }
    }
  },
});

test.describe('Real browser registration @live', () => {
  test.use({ seedAccount: false });
  test('registers a unique customer through the UI and persists its role in MySQL', async ({ page, account }, testInfo) => {
    await page.goto('/register');
    await page.getByLabel('Full Name *', { exact: true }).fill(account.fullName);
    await page.getByLabel('Email Address *', { exact: true }).fill(account.email);
    await page.getByLabel('Password *', { exact: true }).fill(account.password);
    await page.getByLabel('Confirm Password *', { exact: true }).fill(account.password);
    const responsePromise = page.waitForResponse(response => response.url() === `${identityOrigin}/api/auth/register`
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Register Guest Account', exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.email).toBe(account.email);
    expect(body.roles).toContain('Customer');
    await expect(page.getByRole('alert')).toHaveText('Registration Successful! Redirecting...');
    const db = await guardedConnection();
    try {
      const [rows] = await db.execute(`SELECT u.UserId, u.FullName, r.RoleName,
        (u.PasswordHash <> ?) AS passwordStoredAsHash
        FROM Users u JOIN UserRoles ur ON u.UserId = ur.UserId JOIN Roles r ON ur.RoleId = r.RoleId
        WHERE u.Email = ?`, [account.password, account.email]);
      expect(rows).toHaveLength(1);
      expect(rows[0].UserId).toBe(body.userId);
      expect(rows[0].FullName).toBe(account.fullName);
      expect(rows[0].RoleName).toBe('Customer');
      expect(Number(rows[0].passwordStoredAsHash)).toBe(1);
    } finally { await db.end(); }
    // Registration currently redirects to protected /portal without logging in.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('real-registration-complete.png') });
  });
});

test('real login restores the requested profile and fetches persisted data @live', async ({ page, account }, testInfo) => {
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  const loginResponse = page.waitForResponse(response => response.url() === `${identityOrigin}/api/auth/login`
    && response.request().method() === 'POST');
  const profileResponse = page.waitForResponse(response => response.url() === `${identityOrigin}/api/users/profile`
    && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  const profile = await profileResponse;
  expect(profile.status()).toBe(200);
  expect((await profile.json()).email).toBe(account.email);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByLabel('Full Name', { exact: false }).first()).toHaveValue(account.fullName);
  await expect(page.getByLabel('Email Address', { exact: true })).toHaveValue(account.email);
  // Do not expose the JWT in assertion output, logs or attachments.
  expect(await page.evaluate(() => Boolean(localStorage.getItem('token')))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('real-authenticated-profile.png'), fullPage: true });
});

test('real Identity Service rejects a wrong password for an existing customer @live', async ({ page, account }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_LIVE_WRONG_PASSWORD);
  const rejection = page.waitForResponse(response => response.url() === `${identityOrigin}/api/auth/login`
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await rejection).status()).toBe(401);
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => Boolean(localStorage.getItem('token')))).toBe(false);
  const db = await guardedConnection();
  try {
    const [[row]] = await db.execute('SELECT COUNT(*) AS count FROM Users WHERE Email = ?', [account.email]);
    expect(Number(row.count), 'Rejected login does not delete the existing customer').toBe(1);
  } finally { await db.end(); }
  await page.screenshot({ path: testInfo.outputPath('real-login-rejected.png') });
});
