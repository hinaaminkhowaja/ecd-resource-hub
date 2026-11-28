import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storeDirectory = path.join(root, 'data');
const storePath = path.join(storeDirectory, 'receipt-store.json');
const reasonsPath = path.join(storeDirectory, 'red-flag-reasons.json');
const usersPath = path.join(storeDirectory, 'users.json');
const sessionsPath = path.join(storeDirectory, 'sessions.json');
const port = Number(process.env.API_PORT || 3001);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

async function readJsonFile(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJsonFile(file, value) {
  await mkdir(storeDirectory, { recursive: true });
  const temporary = file + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporary, file);
}
function send(response, status, data) {
  response.statusCode = status;
  response.end(JSON.stringify(data));
}
function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
function passwordHash(password, salt) { return scryptSync(password, salt, 64).toString('hex'); }
function verifyPassword(password, user) {
  const actual = Buffer.from(passwordHash(password, user.salt), 'hex');
  const expected = Buffer.from(user.passwordHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function cookieValue(request, name) {
  const cookies = String(request.headers.cookie || '').split(';');
  const item = cookies.map((part) => part.trim()).find((part) => part.startsWith(name + '='));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}
function setSessionCookie(response, token, maxAge) {
  response.setHeader('Set-Cookie', 'ecd_session=' + encodeURIComponent(token) + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + maxAge);
}
async function currentUser(request) {
  const token = cookieValue(request, 'ecd_session');
  if (!token) return null;
  const sessions = await readJsonFile(sessionsPath, []);
  const session = sessions.find((item) => item.tokenHash === hashToken(token) && item.expiresAt > Date.now());
  if (!session) return null;
  const users = await readJsonFile(usersPath, []);
  const user = users.find((item) => item.id === session.userId && item.active !== false);
  return user ? { id:user.id, email:user.email, role:user.role, region:user.region || null } : null;
}
async function requireUser(request, response) {
  const user = await currentUser(request);
  if (!user) send(response, 401, { error: 'Please sign in to continue.' });
  return user;
}
async function requireAdmin(request, response) {
  const user = await requireUser(request, response);
  if (!user) return null;
  if (user.role !== 'ADMIN') { send(response, 403, { error: 'Admin access is required.' }); return null; }
  return user;
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
async function createSession(user, response) {
  const token = randomBytes(32).toString('hex');
  const sessions = await readJsonFile(sessionsPath, []);
  const now = Date.now();
  const next = sessions.filter((item) => item.expiresAt > now);
  next.push({ tokenHash:hashToken(token), userId:user.id, expiresAt:now + SESSION_MS });
  await writeJsonFile(sessionsPath, next);
  setSessionCookie(response, token, Math.floor(SESSION_MS / 1000));
}
async function handle(request, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/api/health') { send(response,200,{ok:true}); return; }
  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    try {
      const body = await readRequest(request);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const users = await readJsonFile(usersPath, []);
      const user = users.find((item) => item.email === email && item.active !== false);
      if (!user || !verifyPassword(password, user)) { send(response, 401, { error: 'Email or password is incorrect.' }); return; }
      await createSession(user, response);
      send(response, 200, { user:{ id:user.id, email:user.email, role:user.role, region:user.region || null } });
    } catch (error) { send(response, 400, { error:error.message }); }
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = cookieValue(request, 'ecd_session');
    const sessions = await readJsonFile(sessionsPath, []);
    await writeJsonFile(sessionsPath, sessions.filter((item) => item.tokenHash !== hashToken(token)));
    setSessionCookie(response, '', 0);
    send(response, 200, { ok:true });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    const user = await currentUser(request);
    if (!user) { send(response, 401, { error:'Not signed in.' }); return; }
    send(response, 200, { user });
    return;
  }
  if (url.pathname.startsWith('/api/admin/users')) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const users = await readJsonFile(usersPath, []);
    if (request.method === 'GET') {
      send(response, 200, { users:users.filter((item) => item.role !== 'ADMIN').map(({ id,email,region,active,createdAt }) => ({ id,email,region,active,createdAt })) });
      return;
    }
    if (request.method === 'POST') {
      try {
        const body = await readRequest(request);
        const email = String(body.email || '').trim().toLowerCase();
        const region = String(body.region || '').trim();
        const password = String(body.password || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { send(response,400,{error:'Enter a valid email address.'}); return; }
        if (!region) { send(response,400,{error:'Select a region.'}); return; }
        if (password.length < 12) { send(response,400,{error:'Temporary password must be at least 12 characters.'}); return; }
        if (users.some((item) => item.email === email)) { send(response,409,{error:'This email already has an account.'}); return; }
        const salt = randomBytes(16).toString('hex');
        const user = { id:randomBytes(12).toString('hex'), email, region, role:'REGION', active:true, salt, passwordHash:passwordHash(password,salt), createdAt:new Date().toISOString() };
        users.push(user);
        await writeJsonFile(usersPath, users);
        send(response,201,{user:{id:user.id,email:user.email,region:user.region,active:user.active,createdAt:user.createdAt}});
      } catch (error) { send(response,400,{error:error.message}); }
      return;
    }
    if (request.method === 'PATCH') {
      try {
        const body = await readRequest(request);
        const user = users.find((item) => item.id === body.id && item.role === 'REGION');
        if (!user) { send(response,404,{error:'User not found.'}); return; }
        if (body.region) user.region = String(body.region).trim();
        if (typeof body.active === 'boolean') user.active = body.active;
        if (body.password) {
          if (String(body.password).length < 12) { send(response,400,{error:'Password must be at least 12 characters.'}); return; }
          user.salt = randomBytes(16).toString('hex');
          user.passwordHash = passwordHash(String(body.password), user.salt);
        }
        await writeJsonFile(usersPath, users);
        send(response,200,{ok:true});
      } catch (error) { send(response,400,{error:error.message}); }
      return;
    }
  }
  if (url.pathname === '/api/receipts') {
    const user = await requireUser(request,response);
    if (!user) return;
    if (request.method === 'GET') { send(response,200,{receipts:await readReceipts()}); return; }
    if (request.method === 'POST') {
      try { const result = await saveReceipt((await readRequest(request)).receipt); send(response,result.error?400:200,result); }
      catch (error) { send(response,400,{error:error.message}); }
      return;
    }
  }
  if (url.pathname === '/api/red-flags') {
    const user = await requireUser(request,response);
    if (!user) return;
    if (request.method === 'GET') {
      const all = await readJsonFile(reasonsPath,{});
      const reasons = user.role === 'ADMIN' ? all : Object.fromEntries(Object.entries(all).filter(([,reason]) => reason.region === user.region));
      send(response,200,{reasons});
      return;
    }
    if (request.method === 'POST') {
      try {
        const body = await readRequest(request);
        const key = String(body.key || '').trim();
        const reason = body.reason;
        if (!key || !reason || !String(reason.reason || '').trim() || !String(reason.name || '').trim() || !String(reason.designation || '').trim()) { send(response,400,{error:'Complete the reason, name and designation.'}); return; }
        if (user.role !== 'ADMIN' && reason.region !== user.region) { send(response,403,{error:'You can only save reasons for your assigned region.'}); return; }
        const reasons = await readJsonFile(reasonsPath,{});
        reasons[key] = { ...reason, region:user.role === 'ADMIN' ? String(reason.region || '').trim() : user.region, submittedBy:user.email, updatedAt:new Date().toISOString() };
        await writeJsonFile(reasonsPath,reasons);
        send(response,200,{ok:true,reason:reasons[key]});
      } catch (error) { send(response,400,{error:error.message}); }
      return;
    }
  }
  send(response,404,{error:'Not found.'});
}
http.createServer((request,response) => handle(request,response).catch((error) => { console.error(error); if (!response.headersSent) send(response,500,{error:'Internal server error.'}); })).listen(port,'127.0.0.1',() => console.log('Local data service listening on 127.0.0.1:' + port));
