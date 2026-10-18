import { test as base, expect } from '@playwright/test';

// DTOs: LoginResponseDto, OrderCartResponseDto, OrderCartItemResponseDto;
// API paths/filters: authService.js, menuService.js, cartService.js, tableService.js.
export const dishes = [
  { menuItemId: 901, itemName: 'Fixture Vegetable Curry', description: 'Seasonal vegetables with rice',
    price: 1200, category: 'Main Course', dietaryInfo: 'Vegan', isAvailable: true, imageReference: null },
  { menuItemId: 902, itemName: 'Fixture Lime Soda', description: 'Fresh lime and sparkling water',
    price: 350, category: 'Beverage', dietaryInfo: 'Vegetarian', isAvailable: true, imageReference: null },
];

export const test = base.extend({
  mockApi: [async ({ page, baseURL }, use) => {
    const state = { calls: [], cart: [], menuFailure: false, availability: [] };
    const frontendOrigin = new URL(baseURL).origin;
    const cartResponse = () => ({ cartId: 1, customerId: 9001,
      items: state.cart.map(item => ({ ...item, subtotal: item.unitPrice * item.quantity })),
      total: state.cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) });
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === frontendOrigin && !url.pathname.startsWith('/api/')) return route.continue();
      // No external services or production data are contacted by this mocked suite.
      if (!url.pathname.startsWith('/api/')) return route.abort();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
      const method = request.method();
      const body = request.postData() ? request.postDataJSON() : null;
      state.calls.push({ path: url.pathname, method, body, query: Object.fromEntries(url.searchParams) });
      const reply = (json, status = 200) => route.fulfill({ status, json });
      if (url.pathname === '/api/auth/login' && method === 'POST') return reply({ message: 'Invalid email or password' }, 401);
      if (url.pathname === '/api/notifications/unread-count') return reply({ unreadCount: 0 });
      if (url.pathname === '/api/customer-menu') {
        if (state.menuFailure) return reply({ message: 'Menu temporarily unavailable' }, 503);
        return reply(dishes.filter(item =>
          (!url.searchParams.get('category') || item.category === url.searchParams.get('category')) &&
          (!url.searchParams.get('dietaryInfo') || item.dietaryInfo === url.searchParams.get('dietaryInfo')) &&
          (!url.searchParams.get('search') || `${item.itemName} ${item.description}`.toLowerCase().includes(url.searchParams.get('search').toLowerCase()))));
      }
      if (url.pathname === '/api/reservations/availability') return reply(state.availability);
      if (url.pathname === '/api/order-cart' && method === 'GET') return reply(cartResponse());
      if (url.pathname === '/api/order-cart/items' && method === 'POST') {
        const dish = dishes.find(item => item.menuItemId === body.menuItemId);
        expect(dish).toBeDefined();
        const existing = state.cart.find(item => item.menuItemId === body.menuItemId);
        if (existing) existing.quantity += body.quantity;
        else state.cart.push({ ...dish, cartItemId: 1, unitPrice: dish.price, quantity: body.quantity });
        return reply(cartResponse());
      }
      const match = url.pathname.match(/^\/api\/order-cart\/items\/(\d+)$/);
      if (match && method === 'PUT') {
        const item = state.cart.find(item => item.menuItemId === Number(match[1]));
        expect(item).toBeDefined();
        item.quantity = body.quantity;
        return reply(cartResponse());
      }
      if (match && method === 'DELETE') {
        state.cart = state.cart.filter(item => item.menuItemId !== Number(match[1]));
        return reply(cartResponse());
      }
      state.calls.at(-1).unexpected = true;
      return reply({ message: 'Unexpected request in mocked UI test' }, 501);
    });
    await use(state);
    expect(state.calls.filter(call => call.unexpected), 'All API requests must have explicit fixtures').toEqual([]);
  }, { auto: true }],
});

export async function customerSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'mock-ui-session-not-a-real-jwt');
    localStorage.setItem('user', JSON.stringify({ userId: 9001, fullName: 'UI Fixture Guest',
      email: 'ui-fixture@example.test', roles: ['Customer'] }));
  });
}
export { expect };
