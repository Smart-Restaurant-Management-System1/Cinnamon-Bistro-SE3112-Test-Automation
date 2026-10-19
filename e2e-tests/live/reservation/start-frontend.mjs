import { spawn } from 'node:child_process';
import path from 'node:path';

const frontend = path.resolve(process.env.E2E_SERVICE_APP_PATH, 'frontend/restaurant-web');
const child = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1', '--port', '15174', '--strictPort'], {
  cwd: frontend, windowsHide: true, stdio: 'inherit',
  env: { ...process.env, VITE_API_URL: 'http://localhost:5001/api',
    VITE_RESERVATION_API_URL: 'http://localhost:5000/api' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
