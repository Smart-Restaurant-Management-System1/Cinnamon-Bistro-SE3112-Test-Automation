import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { databaseName } from './database.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const owned = path.resolve(here, '..');
const app = path.resolve(owned, process.env.E2E_APP_PATH || '../../Cinnamon-Bistro-CSP-Reference');
const runId = randomUUID();
const runtime = path.join(owned, '.runtime', `live-${runId}`);
const output = path.resolve(owned, '../test-reports/e2e-live');
const mode = process.env.E2E_LIVE_MYSQL_MODE || (process.platform === 'win32' ? 'native' : 'docker');
const secret = () => randomBytes(32).toString('hex');
const env = { ...process.env,
  E2E_LIVE_RUN_ID: runId, E2E_LIVE_DB_PASSWORD: secret(),
  E2E_LIVE_ACCOUNT_PASSWORD: secret() + 'aA1!', E2E_LIVE_WRONG_PASSWORD: secret(),
  E2E_LIVE_DB_PORT: process.env.E2E_LIVE_DB_PORT || '33079',
  E2E_LIVE_IDENTITY_PORT: process.env.E2E_LIVE_IDENTITY_PORT || '15001',
  E2E_LIVE_FRONTEND_PORT: process.env.E2E_LIVE_FRONTEND_PORT || '15173',
  DOTNET_CLI_HOME: path.join(owned, '.runtime/dotnet-home'), DOTNET_NOLOGO: '1',
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1',
  DOTNET_GENERATE_ASPNET_CERTIFICATE: 'false',
};
const secrets = [env.E2E_LIVE_DB_PASSWORD, env.E2E_LIVE_ACCOUNT_PASSWORD, env.E2E_LIVE_WRONG_PASSWORD];
const redact = value => secrets.reduce((text, value) => text.replaceAll(value, '[REDACTED]'), String(value));
const processes = [];
const logStreams = [];
let db;
let composeStarted = false;
let interrupted = false;
let result = { runId, mode, success: false, cleanupVerified: false };
let code = 1;

async function freePort(port) {
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error('Invalid live service port.');
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(port), '127.0.0.1', resolve); });
  await new Promise(resolve => server.close(resolve));
}

function start(command, args, name, extraEnv = {}, cwd = runtime, visible = false) {
  const stream = createWriteStream(path.join(output, 'startup', `${name}.log`));
  logStreams.push(stream);
  const child = spawn(command, args, { cwd, env: { ...env, ...extraEnv }, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'] });
  child.on('error', () => {});
  for (const pipe of [child.stdout, child.stderr]) pipe.on('data', data => {
    const safe = redact(data);
    stream.write(safe);
    if (visible) process.stdout.write(safe);
  });
  processes.push(child);
  return child;
}

async function completed(child, timeoutMs = 180000) {
  if (child.exitCode !== null) return child.exitCode;
  let timer;
  try {
    return await Promise.race([
      once(child, 'exit').then(([exit]) => exit ?? 1),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Startup command timed out; inspect startup logs.')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

async function ready(check, label, children, timeoutMs = 90000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (interrupted) throw new Error('Live run interrupted.');
    if (children.some(child => child.exitCode !== null)) throw new Error(`${label} process exited; inspect startup logs.`);
    try { if (await check()) return; } catch { /* Retry readiness, not test assertions. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`${label} not ready; inspect startup logs.`);
}

async function stop(child) {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    await once(killer, 'exit');
  } else {
    child.kill('SIGTERM');
    try { await completed(child, 10000); } catch { child.kill('SIGKILL'); }
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  interrupted = true;
  // Interrupt the active test/build so control returns through finally.
  void Promise.all(processes.slice(-1).map(stop));
});

try {
  await mkdir(runtime, { recursive: true });
  await mkdir(path.join(output, 'startup'), { recursive: true });
  if (!['native', 'docker'].includes(mode)) throw new Error('E2E_LIVE_MYSQL_MODE must be native or docker.');
  if (new Set([env.E2E_LIVE_DB_PORT, env.E2E_LIVE_IDENTITY_PORT, env.E2E_LIVE_FRONTEND_PORT]).size !== 3) throw new Error('Live ports must be distinct.');
  for (const port of [env.E2E_LIVE_DB_PORT, env.E2E_LIVE_IDENTITY_PORT, env.E2E_LIVE_FRONTEND_PORT]) await freePort(port);
  await access(path.join(app, 'frontend/restaurant-web/node_modules/vite/bin/vite.js'));
  console.log('[live] Building actual Identity Service into the ignored runtime directory.');
  const artifacts = path.join(runtime, 'dotnet');
  const build = start('dotnet', ['build', path.join(app, 'backend/identity-service/identity-service.csproj'),
    '--configuration', 'Release', '--artifacts-path', artifacts, '--disable-build-servers', '--nologo'], 'build', {}, runtime, true);
  if (await completed(build) !== 0) throw new Error('Identity build failed.');
  let mysqlProcess;
  if (mode === 'native') {
    const binary = process.env.E2E_MYSQLD_PATH || 'C:/Program Files/MySQL/MySQL Server 8.0 New/bin/mysqld.exe';
    await access(binary);
    const datadir = path.join(runtime, 'mysql-data');
    await mkdir(datadir);
    const base = path.resolve(binary, '../..');
    console.log('[live] Initializing a fresh private MySQL directory (no installed service/data used).');
    const init = start(binary, ['--no-defaults', '--initialize-insecure', `--basedir=${base}`, `--datadir=${datadir}`, '--console'], 'mysql-init');
    if (await completed(init, 300000) !== 0) throw new Error('Private MySQL initialization failed.');
    mysqlProcess = start(binary, ['--no-defaults', `--basedir=${base}`, `--datadir=${datadir}`,
      '--bind-address=127.0.0.1', `--port=${env.E2E_LIVE_DB_PORT}`, '--mysqlx=0', '--console'], 'mysql');
  } else {
    console.log('[live] Starting a uniquely named disposable Compose MySQL service.');
    composeStarted = true;
    const up = start('docker', ['compose', '-f', path.join(here, 'compose.mysql.yml'), '-p', `bandara-${runId}`,
      'up', '-d'], 'compose-up', {}, runtime, true);
    if (await completed(up) !== 0) throw new Error('Docker Compose could not start private MySQL.');
  }
  await ready(async () => {
    db = await mysql.createConnection({ host: '127.0.0.1', port: Number(env.E2E_LIVE_DB_PORT), user: 'root',
      password: mode === 'docker' ? env.E2E_LIVE_DB_PASSWORD : '', multipleStatements: true, connectTimeout: 2000 });
    await db.query('SELECT 1');
    return true;
  }, 'MySQL', mysqlProcess ? [mysqlProcess] : [], 180000);
  if (mode === 'native') await db.query('ALTER USER CURRENT_USER() IDENTIFIED BY ?', [env.E2E_LIVE_DB_PASSWORD]);
  console.log('[live] Applying the real identity schema and migration to a run-owned database.');
  for (const name of ['01_init_identity.sql', '02_admin_user_management.sql']) {
    const sql = (await readFile(path.join(app, 'database/identity-db', name), 'utf8'))
      .replace(/^\uFEFF/, '').replaceAll('restaurant_identity_db', databaseName);
    await db.query(sql);
  }
  await db.query('CREATE TABLE E2EHarnessGuard (RunId VARCHAR(36) NOT NULL)');
  await db.execute('INSERT INTO E2EHarnessGuard (RunId) VALUES (?)', [runId]);
  const dll = path.join(artifacts, 'bin/identity-service/release/identity-service.dll');
  if (!existsSync(dll)) throw new Error('Unexpected Identity assembly output path; inspect build log.');
  const identity = start('dotnet', [dll, '--contentRoot', path.join(app, 'backend/identity-service')], 'identity', {
    ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: `http://127.0.0.1:${env.E2E_LIVE_IDENTITY_PORT}`,
    ConnectionStrings__DefaultConnection: `Server=127.0.0.1;Port=${env.E2E_LIVE_DB_PORT};Database=${databaseName};User ID=root;Password=${env.E2E_LIVE_DB_PASSWORD};`,
    Jwt__Key: secret(), Jwt__Issuer: 'BandaraLiveTests', Jwt__Audience: 'BandaraLiveBrowser',
    EmailValidation__SkipDnsCheck: 'true', Cors__AllowedOrigin: `http://127.0.0.1:${env.E2E_LIVE_FRONTEND_PORT}`,
    Logging__LogLevel__Default: 'Warning',
  });
  // Existing authenticated endpoint: 401 proves HTTP/controller middleware readiness without creating an account.
  await ready(async () => (await fetch(`http://127.0.0.1:${env.E2E_LIVE_IDENTITY_PORT}/api/auth/profile`,
    { signal: AbortSignal.timeout(2000) })).status === 401,
    'Identity Service', [identity]);
  const frontend = path.join(app, 'frontend/restaurant-web');
  const vite = start(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', env.E2E_LIVE_FRONTEND_PORT, '--strictPort'], 'frontend', {
    VITE_API_URL: `http://127.0.0.1:${env.E2E_LIVE_IDENTITY_PORT}/api`,
    VITE_RESERVATION_API_URL: 'http://127.0.0.1:15000/api',
  }, frontend);
  await ready(async () => (await fetch(`http://127.0.0.1:${env.E2E_LIVE_FRONTEND_PORT}`,
    { signal: AbortSignal.timeout(2000) })).ok, 'Frontend', [vite]);
  console.log('[live] Running 3 real browser/Identity/MySQL tests; no API interception.');
  const tests = start(process.execPath, [path.join(owned, 'node_modules/@playwright/test/cli.js'), 'test',
    '--config', path.join(here, 'playwright.live.config.js')], 'playwright', {}, owned, true);
  code = await completed(tests, 180000);
  result.testExitCode = code;
  const [[users]] = await db.query('SELECT COUNT(*) AS count FROM Users');
  const [[roles]] = await db.query('SELECT COUNT(*) AS count FROM UserRoles');
  result.remainingUsers = Number(users.count);
  result.remainingUserRoles = Number(roles.count);
  result.cleanupVerified = result.remainingUsers === 0 && result.remainingUserRoles === 0;
  if (!result.cleanupVerified) { console.error('[live] Account cleanup verification failed.'); code = 1; }
  result.success = code === 0 && result.cleanupVerified;
} catch (error) {
  // Do not dump driver objects: they can contain SQL parameters or credentials.
  console.error('[live] ' + redact(error.message));
  result.blocker = redact(error.message);
  code = 1;
} finally {
  if (db) {
    try { if (mode === 'native') await db.query('SHUTDOWN'); } catch { /* MySQL closes the connection during shutdown. */ }
    await db.end().catch(() => {});
  }
  for (const child of processes.toReversed()) await stop(child).catch(() => {});
  if (composeStarted) {
    const down = start('docker', ['compose', '-f', path.join(here, 'compose.mysql.yml'), '-p', `bandara-${runId}`,
      'down', '--volumes', '--remove-orphans'], 'compose-down', {}, runtime, true);
    try { if (await completed(down) !== 0) code = 1; } catch { code = 1; }
  }
  result.exitCode = code;
  result.success = result.success && code === 0;
  await writeFile(path.join(output, 'run-summary.json'), JSON.stringify(result, null, 2));
  await Promise.all(logStreams.map(stream => new Promise(resolve => stream.end(resolve))));
  console.log(`[live] Exit ${code}; cleanup verified: ${result.cleanupVerified}. Reports: ${output}`);
}
process.exitCode = code;
