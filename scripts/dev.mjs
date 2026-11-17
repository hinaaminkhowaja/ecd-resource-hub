import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['api/server.js'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit', env: process.env }),
];

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  process.exitCode = code;
}

for (const child of children) {
  child.on('error', (error) => { console.error(error); stopAll(1); });
  child.on('exit', (code) => { if (!stopping) stopAll(code || 0); });
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

