import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localConnection } from './local-database.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, '../../../test-reports/e2e-reservation-live');
await mkdir(output, { recursive: true });
let exitCode = 1;
const runId = randomUUID();
let cleanupVerified = false;
try {
  // Fail before creating any records unless both databases and services are reachable.
  for (const service of ['identity-service', 'reservation-service']) {
    const db = await localConnection(service);
    try { await db.query('SELECT 1'); } finally { await db.end(); }
  }
  for (const port of [5000, 5001]) {
    const response = await fetch(`http://localhost:${port}/swagger/v1/swagger.json`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Service ${port} is not ready.`);
  }
  const child = spawn(process.execPath, [path.resolve(here, '../../node_modules/@playwright/test/cli.js'),
    'test', '--config', path.join(here, 'playwright.reservation.config.js')], {
    cwd: path.resolve(here, '../..'), windowsHide: true, stdio: 'inherit',
    env: { ...process.env, E2E_RESERVATION_RUN_ID: runId,
      E2E_LIVE_ACCOUNT_PASSWORD: randomBytes(32).toString('hex') + 'aA1!' },
  });
  exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
  try {
    const cleanup = JSON.parse(await readFile(path.join(output, 'cleanup.json'), 'utf8'));
    cleanupVerified = cleanup.runId === runId && cleanup.cleanupVerified === true;
  } catch { /* Missing/stale cleanup evidence must never produce success. */ }
  if (!cleanupVerified) { console.error('Cleanup verification is missing for this run.'); exitCode = 1; }
} catch (error) {
  // Database errors can include configuration details; print only their safe code.
  console.error('Reservation setup failed:', error.code || 'Check local-service prerequisites and opt-in variables.');
}
await writeFile(path.join(output, 'run-summary.json'), JSON.stringify({ runId, exitCode,
  cleanupVerified, mode: 'existing-local-services', finishedAt: new Date().toISOString() }, null, 2));
process.exitCode = exitCode;
