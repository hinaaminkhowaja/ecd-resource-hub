import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storeDirectory = path.join(root, 'data');
const storePath = path.join(storeDirectory, 'receipt-store.json');
const port = Number(process.env.API_PORT || 3001);
async function readReceipts() {
  try {
    const rows = JSON.parse(await readFile(storePath, 'utf8'));
    return Array.isArray(rows) ? rows.filter((row) => row?.id).map(removeEmailMetadata) : [];
  } catch {
    return [];
  }
}

async function writeReceipts(rows) {
  await mkdir(storeDirectory, { recursive: true });
  await writeFile(storePath, JSON.stringify(rows, null, 2), 'utf8');
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
  if (!receipt?.id || !Number.isInteger(Number(receipt.stage)) || Number(receipt.stage) < 1 || Number(receipt.stage) > 4) {
    return { error: 'Receipt details are incomplete.' };
  }
  const rows = await readReceipts();
  const existingIndex = rows.findIndex((row) => row.id === receipt.id);
  const existing = existingIndex >= 0 ? rows[existingIndex] : null;
  const next = removeEmailMetadata({ ...existing, ...receipt, timeline: receipt.timeline || [] });
  next.updatedAt = new Date().toISOString();
  if (existingIndex >= 0) rows[existingIndex] = next;
  else rows.unshift(next);
  await writeReceipts(rows);
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

const server = http.createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.method === 'GET' && request.url === '/api/receipts') {
    response.end(JSON.stringify({ receipts: await readReceipts() }));
    return;
  }
  if (request.method === 'POST' && request.url === '/api/receipts') {
    try {
      const body = await readRequest(request);
      const result = await saveReceipt(body.receipt);
      if (result.error) { response.statusCode = 400; response.end(JSON.stringify(result)); return; }
      response.end(JSON.stringify(result));
    } catch (error) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: 'Not found.' }));
});

server.listen(port, '127.0.0.1', () => console.log(`Receipt service listening on 127.0.0.1:${port}`));

