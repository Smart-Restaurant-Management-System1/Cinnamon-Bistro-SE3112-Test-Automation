import { test, expect, customerSession } from '../helpers/fixtures.js';

test.describe('Mocked customer UI (no real backend)', () => {
  test.beforeEach(async ({ page }) => customerSession(page));

  test('menu category, dietary and search filters render returned dishes and reset', async ({ page, mockApi }) => {
    await page.goto('/menu');
    await expect(page.getByRole('article')).toHaveCount(2);
    const curry = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Fixture Vegetable Curry' }) });
    await expect(curry).toContainText('1,200.00');
    await expect(curry).toContainText('Seasonal vegetables with rice');
    await page.getByRole('button', { name: 'Beverage', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Fixture Lime Soda' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fixture Vegetable Curry' })).toHaveCount(0);
    expect(mockApi.calls.some(call => call.query.category === 'Beverage')).toBe(true);
    await page.getByLabel('Dietary Preference', { exact: true }).selectOption('Vegan');
    await expect(page.getByRole('article')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reset All Filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset All Filters' }).click();
    await expect(page.getByRole('article')).toHaveCount(2);
    await page.getByLabel('Search Dishes', { exact: true }).fill('lime');
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Fixture Lime Soda' })).toBeVisible();
    expect(mockApi.calls.some(call => call.query.search === 'lime')).toBe(true);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeDisabled();
  });

  test('menu service error is visible and Retry recovers', async ({ page, mockApi }) => {
    mockApi.menuFailure = true;
    await page.goto('/menu');
    await expect(page.getByRole('alert')).toContainText('Menu temporarily unavailable');
    await expect(page.getByRole('article')).toHaveCount(0);
    mockApi.menuFailure = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('add to cart, increase, decrease and remove update visible quantity and price', async ({ page, mockApi }, testInfo) => {
    await page.goto('/menu');
    const curry = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Fixture Vegetable Curry' }) });
    await curry.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByRole('status')).toContainText('Item added to your cart.');
    expect(mockApi.calls.find(call => call.path === '/api/order-cart/items')?.body).toEqual({ menuItemId: 901, quantity: 1 });
    await page.getByRole('link', { name: 'View Cart', exact: true }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByLabel('Quantity: 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Increase quantity of Fixture Vegetable Curry', exact: true }).click();
    await expect(page.getByLabel('Quantity: 2', { exact: true })).toBeVisible();
    await expect(page.getByText('Rs. 2,400.00', { exact: true }).first()).toBeVisible();
    expect(mockApi.calls.find(call => call.method === 'PUT')?.body).toEqual({ quantity: 2 });
    await page.screenshot({ path: testInfo.outputPath('cart-quantity-two.png'), fullPage: true });
    await page.getByRole('button', { name: 'Decrease quantity of Fixture Vegetable Curry', exact: true }).click();
    await expect(page.getByLabel('Quantity: 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Rs. 1,200.00', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your Cart Is Empty', exact: true })).toBeVisible();
    expect(mockApi.cart).toEqual([]);
    await expect(page.getByRole('heading', { name: 'Fixture Vegetable Curry', exact: true })).toHaveCount(0);
  });

  test('reservation search rejects missing values, zero guests and past times before API calls', async ({ page, mockApi }) => {
    await page.goto('/availability');
    await page.getByLabel('Guest count').fill('0');
    await page.getByRole('button', { name: 'Search Available Tables', exact: true }).click();
    for (const text of ['Visit date is required.', 'Start time is required.', 'Guest count must be at least 1.']) {
      await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible();
    }
    await expect(page.getByLabel('Guest count')).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Visit date').fill('2000-01-01');
    await page.getByLabel('Start time').fill('12:00');
    await page.getByLabel('Guest count').fill('2');
    await page.getByRole('button', { name: 'Search Available Tables', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('The requested start time must not be in the past.');
    expect(mockApi.calls.filter(call => call.path === '/api/reservations/availability')).toEqual([]);
  });

  test('valid reservation search sends filters and shows returned table capacity', async ({ page, mockApi }) => {
    mockApi.availability = [{ tableId: 901, tableNumber: 'E2E-01', seatingCapacity: 4 }];
    await page.goto('/availability');
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    await page.getByLabel('Visit date').fill(date);
    await page.getByLabel('Start time').fill('18:00');
    await page.getByRole('button', { name: 'Search Available Tables', exact: true }).click();
    const results = page.getByRole('region', { name: 'Available tables' });
    await expect(results.getByRole('heading', { name: 'Table E2E-01' })).toBeVisible();
    await expect(results).toContainText('4 seats');
    expect(mockApi.calls.find(call => call.path === '/api/reservations/availability')?.query).toEqual({
      date, startTime: '18:00', durationMinutes: '90', guestCount: '2',
    });
    await expect(results.getByRole('button', { name: 'Reserve This Table' })).toBeEnabled();
  });
});
