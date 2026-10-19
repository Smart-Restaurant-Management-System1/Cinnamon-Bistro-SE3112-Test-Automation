import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

// Explicitly opt in to writes against the developer's already-running LOCAL services.
// Configuration is read in memory; credentials are never logged or copied into reports.
export async function localConnection(service) {
  if (process.env.E2E_RESERVATION_ALLOW_LOCAL_WRITES !== '1' || !process.env.E2E_SERVICE_APP_PATH) {
    throw new Error('Set E2E_SERVICE_APP_PATH and E2E_RESERVATION_ALLOW_LOCAL_WRITES=1 for a local test installation.');
  }
  const folder = path.resolve(process.env.E2E_SERVICE_APP_PATH, 'backend', service);
  const base = JSON.parse(await readFile(path.join(folder, 'appsettings.json'), 'utf8'));
  let development = {};
  try { development = JSON.parse(await readFile(path.join(folder, 'appsettings.Development.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const text = development.ConnectionStrings?.DefaultConnection || base.ConnectionStrings?.DefaultConnection;
  const values = Object.fromEntries(String(text).split(';').filter(part => part.includes('=')).map(part => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim()];
  }));
  const database = service === 'identity-service' ? 'restaurant_identity_db' : 'restaurant_reservation_db';
  if (!['localhost', '127.0.0.1'].includes(values.server) || values.database !== database) {
    throw new Error('Refusing nonlocal or unexpected database configuration.');
  }
  return mysql.createConnection({ host: '127.0.0.1', port: Number(values.port || 3306),
    database, user: values.user || values['user id'], password: values.password, connectTimeout: 5000 });
}
