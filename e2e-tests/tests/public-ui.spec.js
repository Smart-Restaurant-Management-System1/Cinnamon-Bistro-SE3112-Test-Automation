import { test, expect } from '../helpers/fixtures.js';

test.describe('Public UI (network isolated)', () => {
  test('landing navigation focuses the section and opens registration', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A place to gather.A moment to savour.');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('link', { name: 'About', exact: true }).click();
    await expect(page).toHaveURL(/#about$/);
    await expect(page.locator('#about')).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('landing.png'), fullPage: true });
    await nav.getByRole('link', { name: 'Get Started' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  });

  test('mobile navigation opens and Escape restores toggle focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const toggle = page.getByRole('button', { name: 'Close' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  for (const path of ['/menu', '/cart', '/availability']) {
    test(`guest access to ${path} requires login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    });
  }

  test('empty and malformed login is blocked before an API request', async ({ page, mockApi }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Email address is required', { exact: true })).toBeVisible();
    await expect(page.getByText('Password is required', { exact: true })).toBeVisible();
    await page.getByLabel('Email address', { exact: true }).fill('bad-email');
    await page.getByLabel('Password', { exact: true }).fill('invalid-test-input');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    expect(mockApi.calls).toEqual([]);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('mocked login rejection displays API error and clears authentication', async ({ page, mockApi }) => {
    await page.goto('/login');
    await page.getByLabel('Email address', { exact: true }).fill('ui-fixture@example.test');
    await page.getByLabel('Password', { exact: true }).fill('invalid-test-input');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
    expect(mockApi.calls).toContainEqual({ path: '/api/auth/login', method: 'POST',
      body: { email: 'ui-fixture@example.test', password: 'invalid-test-input' }, query: {} });
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('registration validates required fields and mismatched passwords without submitting', async ({ page, mockApi }) => {
    await page.goto('/register');
    const submit = page.getByRole('button', { name: 'Register Guest Account' });
    await submit.click();
    for (const error of ['Full Name is required', 'Email address is required', 'Password is required', 'Confirm Password is required']) {
      await expect(page.getByText(error, { exact: true })).toBeVisible();
    }
    await page.getByLabel('Full Name *', { exact: true }).fill('Fixture Guest');
    await page.getByLabel('Email Address *', { exact: true }).fill('ui-fixture@example.test');
    await page.getByLabel('Password *', { exact: true }).fill('fixture-only-input');
    await page.getByLabel('Confirm Password *', { exact: true }).fill('different-fixture-input');
    await submit.click();
    await expect(page.getByText('Passwords do not match', { exact: true })).toBeVisible();
    expect(mockApi.calls).toEqual([]);
    await expect(page).toHaveURL(/\/register$/);
  });
});
