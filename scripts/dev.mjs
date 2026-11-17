import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const apiHost = '127.0.0.1';
const apiPort = Number(process.env.API_PORT || 3001);
const children = [];
let stopping = false;

async function isPortOpen() {
  return new Promise((resolve) => {
    const socket = createConnection({ host: apiHost, port: apiPort });
    socket.setTimeout(700);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

async function isReceiptServiceReady() {
  try {
    const response = await fetch(`http://${apiHost}:${apiPort}/api/receipts`, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return false;
    const data = await response.json();
    return Array.isArray(data.receipts);
  } catch {
    return false;
  }
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  process.exitCode = code;
}

if (await isReceiptServiceReady()) {
  console.log(`Receipt service already running on ${apiHost}:${apiPort}; reusing it.`);
} else if (await isPortOpen()) {
  console.error(`Port ${apiPort} is occupied by another service. Stop that service, then run npm run dev again.`);
  process.exit(1);
} else {
  const api = spawn(process.execPath, ['api/server.js'], { stdio: 'inherit', env: process.env });
  children.push(api);
  api.on('error', (error) => { console.error('Could not start the receipt service:', error.message); stopAll(1); });
  api.on('exit', (code) => { if (!stopping && code) stopAll(code); });
}

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit', env: process.env });
children.push(vite);
vite.on('error', (error) => { console.error('Could not start the dashboard:', error.message); stopAll(1); });
vite.on('exit', (code) => { if (!stopping) stopAll(code || 0); });
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
