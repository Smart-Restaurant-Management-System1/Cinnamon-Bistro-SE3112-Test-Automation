import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localConnection } from './local-database.mjs';

const test = base.extend({
  booking: async ({ request, context }, use, testInfo) => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const account = { fullName: 'Bandara Reservation Test', email: `bandara-res-${suffix}@example.com`,
      password: process.env.E2E_LIVE_ACCOUNT_PASSWORD, role: 'Customer' };
    const tableNumber = `E2E-${suffix}`;
    const traffic = [];
    const observe = page => page.on('response', response => {
      const url = new URL(response.url());
      if (['5000', '5001'].includes(url.port)) traffic.push({
        method: response.request().method(), path: url.pathname, status: response.status() });
    });
    context.pages().forEach(observe);
    context.on('page', observe);
    const identity = await localConnection('identity-service');
    const reservation = await localConnection('reservation-service');
    try {
      const response = await request.post('http://localhost:5001/api/auth/register', { data: account });
      expect(response.status(), 'Real service creates the unique test customer').toBe(201);
      const [users] = await identity.execute('SELECT UserId FROM Users WHERE Email = ?', [account.email]);
      expect(users).toHaveLength(1);
      const userId = users[0].UserId;
      const [table] = await reservation.execute(`INSERT INTO RestaurantTables
        (TableNumber, Capacity, Location, Status, IsActive) VALUES (?, 2, 'Bandara isolated UI test', 'Available', 1)`, [tableNumber]);
      const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      await use({ account, tableNumber, tableId: table.insertId, userId, date, reservation });
    } finally {
      // Stop this context's in-flight browser work before inspecting/deleting owned records.
      for (const page of context.pages()) {
        if (testInfo.status !== testInfo.expectedStatus) {
          await page.screenshot({ path: testInfo.outputPath(`failure-${context.pages().indexOf(page)}.png`), fullPage: true }).catch(() => {});
        }
      }
      await context.close();
      try {
        const [users] = await identity.execute('SELECT UserId FROM Users WHERE Email = ?', [account.email]);
        const [tables] = await reservation.execute('SELECT Id FROM RestaurantTables WHERE TableNumber = ?', [tableNumber]);
        const counts = {};
        await reservation.beginTransaction();
        try {
          for (const user of users) {
            const [rows] = await reservation.execute('SELECT Id, TableId FROM Reservations WHERE CustomerId = ?', [user.UserId]);
            for (const row of rows) {
              expect(tables.some(table => table.Id === row.TableId), 'Only this fixture table may be booked').toBe(true);
              await reservation.execute("DELETE FROM ReservationOutbox WHERE AggregateType = 'Reservation' AND AggregateId = ?", [row.Id]);
            }
            await reservation.execute('DELETE FROM CustomerNotifications WHERE CustomerId = ?', [user.UserId]);
            await reservation.execute('DELETE FROM Reservations WHERE CustomerId = ?', [user.UserId]);
            const [[remaining]] = await reservation.execute('SELECT COUNT(*) AS n FROM Reservations WHERE CustomerId = ?', [user.UserId]);
            const [[notifications]] = await reservation.execute('SELECT COUNT(*) AS n FROM CustomerNotifications WHERE CustomerId = ?', [user.UserId]);
            expect(Number(remaining.n)).toBe(0);
            expect(Number(notifications.n)).toBe(0);
            counts.reservationsRemaining = Number(remaining.n);
            counts.notificationsRemaining = Number(notifications.n);
            for (const row of rows) {
              const [[outbox]] = await reservation.execute("SELECT COUNT(*) AS n FROM ReservationOutbox WHERE AggregateType = 'Reservation' AND AggregateId = ?", [row.Id]);
              expect(Number(outbox.n)).toBe(0);
            }
            counts.outboxRemaining = 0;
            counts.deletedReservations = rows.length;
          }
          await reservation.execute('DELETE FROM RestaurantTables WHERE TableNumber = ?', [tableNumber]);
          const [[remaining]] = await reservation.execute('SELECT COUNT(*) AS n FROM RestaurantTables WHERE TableNumber = ?', [tableNumber]);
          expect(Number(remaining.n)).toBe(0);
          counts.tablesRemaining = Number(remaining.n);
          await reservation.commit();
        } catch (error) { await reservation.rollback(); throw error; }
        await identity.execute('DELETE FROM Users WHERE Email = ?', [account.email]);
        const [[remaining]] = await identity.execute('SELECT COUNT(*) AS n FROM Users WHERE Email = ?', [account.email]);
        expect(Number(remaining.n)).toBe(0);
        counts.usersRemaining = Number(remaining.n);
        for (const user of users) {
          const [[roles]] = await identity.execute('SELECT COUNT(*) AS n FROM UserRoles WHERE UserId = ?', [user.UserId]);
          expect(Number(roles.n)).toBe(0);
        }
        counts.userRolesRemaining = 0;
        await testInfo.attach('real-reservation-api-and-cleanup', { contentType: 'application/json',
          body: Buffer.from(JSON.stringify({ traffic, cleanup: counts }, null, 2)) });
        const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../test-reports/e2e-reservation-live');
        await writeFile(path.join(output, 'cleanup.json'), JSON.stringify({
          runId: process.env.E2E_RESERVATION_RUN_ID, cleanupVerified: true, ...counts }, null, 2));
      } finally { await reservation.end(); await identity.end(); }
    }
  },
});

async function reviewTable(page, booking) {
  await page.goto('/availability');
  await page.getByRole('textbox', { name: 'Visit date', exact: true }).fill(booking.date);
  await page.getByRole('textbox', { name: 'Start time', exact: true }).fill('18:00');
  await page.getByRole('spinbutton', { name: 'Duration (minutes)', exact: true }).fill('60');
  await page.getByRole('spinbutton', { name: 'Guest count', exact: true }).fill('2');
  const availability = page.waitForResponse(response => new URL(response.url()).pathname === '/api/reservations/availability');
  await page.getByRole('button', { name: 'Search Available Tables', exact: true }).click();
  const response = await availability;
  expect(response.status()).toBe(200);
  expect((await response.json()).some(table => table.tableId === booking.tableId)).toBe(true);
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: `Table ${booking.tableNumber}`, exact: true }) });
  await card.getByRole('button', { name: 'Reserve This Table' }).click();
  await expect(page.getByRole('region', { name: 'Reservation review' })).toContainText(booking.tableNumber);
}

test('real reservation is persisted and a stale browser booking is rejected @live', async ({ page, context, booking }, testInfo) => {
  await page.goto('/availability');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email address', { exact: true }).fill(booking.account.email);
  await page.getByLabel('Password', { exact: true }).fill(booking.account.password);
  const login = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await login).status()).toBe(200);
  await expect(page).toHaveURL(/\/availability$/);
  await reviewTable(page, booking);
  // Second real tab has stale advisory availability before the first tab commits.
  const stale = await context.newPage();
  await reviewTable(stale, booking);
  const created = page.waitForResponse(response => new URL(response.url()).pathname === '/api/reservations'
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm & Reserve Table', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.tableNumber).toBe(booking.tableNumber);
  expect(body.guestCount).toBe(2);
  expect(body.bookingReference).toEqual(expect.any(String));
  await expect(page).toHaveURL(/\/reservations\/confirmation$/);
  await expect(page.getByRole('heading', { name: 'Your Table Is Reserved' })).toBeVisible();
  await expect(page.getByText(body.bookingReference, { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('real-reservation-confirmed.png'), fullPage: true });
  const rejected = stale.waitForResponse(response => new URL(response.url()).pathname === '/api/reservations'
    && response.request().method() === 'POST');
  await stale.getByRole('button', { name: 'Confirm & Reserve Table', exact: true }).click();
  const conflict = await rejected;
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).code).toBe('TABLE_NO_LONGER_AVAILABLE');
  await expect(stale.getByRole('alert')).toContainText('This table was available when you selected it, but another customer completed a reservation first. Please search again for an available table.');
  await expect(stale.getByRole('alert').getByRole('link', { name: 'Return to availability search' })).toHaveAttribute('href', '/availability');
  await expect(stale).toHaveURL(/\/reservations\/new$/);
  await stale.screenshot({ path: testInfo.outputPath('real-reservation-conflict.png'), fullPage: true });
  const [rows] = await booking.reservation.execute(`SELECT CustomerId, TableId, GuestCount, BookingReference, Status
    FROM Reservations WHERE CustomerId = ?`, [booking.userId]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ CustomerId: booking.userId, TableId: booking.tableId,
    GuestCount: 2, BookingReference: body.bookingReference, Status: 'Pending' });
});
