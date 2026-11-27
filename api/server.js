import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storeDirectory = path.join(root, 'data');
const storePath = path.join(storeDirectory, 'receipt-store.json');
const reasonsPath = path.join(storeDirectory, 'red-flag-reasons.json');
const port = Number(process.env.API_PORT || 3001);

async function readJsonFile(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJsonFile(file, value) {
  await mkdir(storeDirectory, { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}
async function readReceipts() {
  const rows = await readJsonFile(storePath, []);
  return Array.isArray(rows) ? rows.filter((row) => row?.id).map(removeEmailMetadata) : [];
}
function removeEmailMetadata(receipt) {
  const { reminderEvents, ...record } = receipt;
  record.timeline = (Array.isArray(receipt.timeline) ? receipt.timeline : [])
    .filter((event) => event.kind !== 'reminder')
    .map((event) => {
      const { senderEmail, receiverEmail, notifyEmails, emailedTo, emailStatus, emailError, ...stageEvent } = event;
      return stageEvent;
    });
  return record;
}
async function saveReceipt(receipt) {
  if (!receipt?.id || !Number.isInteger(Number(receipt.stage)) || Number(receipt.stage) < 1 || Number(receipt.stage) > 4) return { error: 'Receipt details are incomplete.' };
  const rows = await readReceipts();
  const index = rows.findIndex((row) => row.id === receipt.id);
  const existing = index >= 0 ? rows[index] : null;
  const next = removeEmailMetadata({ ...existing, ...receipt, timeline: receipt.timeline || [] });
  next.updatedAt = new Date().toISOString();
  if (index >= 0) rows[index] = next; else rows.unshift(next);
  await writeJsonFile(storePath, rows);
  return { receipt: next };
}
function readRequest(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Request is too large.'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON.')); }
    });
    request.on('error', reject);
  });
}
function send(response, status, data) {
  response.statusCode = status;
  response.end(JSON.stringify(data));
}

const server = http.createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'GET' && request.url === '/api/receipts') {
    send(response, 200, { receipts: await readReceipts() });
    return;
  }
  if (request.method === 'POST' && request.url === '/api/receipts') {
    try {
      const body = await readRequest(request);
      const result = await saveReceipt(body.receipt);
      send(response, result.error ? 400 : 200, result);
    } catch (error) { send(response, 400, { error: error.message }); }
    return;
  }
  if (request.method === 'GET' && request.url === '/api/red-flags') {
    send(response, 200, { reasons: await readJsonFile(reasonsPath, {}) });
    return;
  }
  if (request.method === 'POST' && request.url === '/api/red-flags') {
    try {
      const body = await readRequest(request);
      const key = String(body.key || '').trim();
      const reason = body.reason;
      if (!key || !reason || !String(reason.reason || '').trim() || !String(reason.name || '').trim() || !String(reason.designation || '').trim()) {
        send(response, 400, { error: 'Complete the reason, name and designation.' });
        return;
      }
      const reasons = await readJsonFile(reasonsPath, {});
      reasons[key] = { ...reason, updatedAt: new Date().toISOString() };
      await writeJsonFile(reasonsPath, reasons);
      send(response, 200, { ok: true, reason: reasons[key] });
    } catch (error) { send(response, 400, { error: error.message }); }
    return;
  }
  send(response, 404, { error: 'Not found.' });
});

server.listen(port, '127.0.0.1', () => console.log(`Local data service listening on 127.0.0.1:${port}`));
