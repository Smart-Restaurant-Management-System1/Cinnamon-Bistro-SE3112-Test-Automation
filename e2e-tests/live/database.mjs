import mysql from 'mysql2/promise';

export const databaseName = 'e2e_it24100315_identity';

export function connectionOptions() {
  if (!process.env.E2E_LIVE_RUN_ID || !process.env.E2E_LIVE_DB_PASSWORD) {
    throw new Error('Use npm run test:live; a managed disposable database is required.');
  }
  return { host: '127.0.0.1', port: Number(process.env.E2E_LIVE_DB_PORT),
    user: 'root', password: process.env.E2E_LIVE_DB_PASSWORD, database: databaseName };
}

export async function guardedConnection() {
  const db = await mysql.createConnection(connectionOptions());
  try {
    const [rows] = await db.execute('SELECT RunId FROM E2EHarnessGuard');
    if (rows.length !== 1 || rows[0].RunId !== process.env.E2E_LIVE_RUN_ID) {
      throw new Error('Refusing access: database does not belong to this live run.');
    }
    return db;
  } catch (error) {
    await db.end();
    throw error;
  }
}
