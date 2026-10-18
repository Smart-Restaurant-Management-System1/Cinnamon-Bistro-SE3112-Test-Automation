import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..', process.env.E2E_APP_PATH || '../../Cinnamon-Bistro-CSP-Reference');
const frontend = path.join(app, 'frontend/restaurant-web');
const vite = path.join(frontend, 'node_modules/vite/bin/vite.js');
if (!existsSync(vite)) throw new Error('Install frontend dependencies with npm ci in ' + frontend);
// Explicit local API bases override the application's deployment-oriented env files.
const child = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  cwd: frontend,
  stdio: 'inherit',
  env: { ...process.env, VITE_API_URL: process.env.VITE_API_URL || 'http://127.0.0.1:5001/api',
    VITE_RESERVATION_API_URL: process.env.VITE_RESERVATION_API_URL || 'http://127.0.0.1:5000/api' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
