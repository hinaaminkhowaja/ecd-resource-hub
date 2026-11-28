import { randomBytes, scryptSync } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';

const dataDir = path.resolve('data');
const usersFile = path.join(dataDir, 'users.json');
const rl = readline.createInterface({ input:stdin, output:stdout });
try {
  let users = [];
  try { users = JSON.parse(await readFile(usersFile, 'utf8')); } catch {}
  if (users.some((user) => user.role === 'ADMIN')) {
    console.log('An admin account already exists. Use the Admin → User Accounts screen to manage regional users.');
    process.exit(0);
  }
  const email = (await rl.question('Admin email: ')).trim().toLowerCase();
  const password = await rl.question('Admin password (minimum 12 characters): ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (password.length < 12) throw new Error('Password must be at least 12 characters.');
  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, salt, 64).toString('hex');
  users.push({ id:randomBytes(12).toString('hex'), email, role:'ADMIN', active:true, salt, passwordHash, createdAt:new Date().toISOString() });
  await mkdir(dataDir, { recursive:true });
  await writeFile(usersFile, JSON.stringify(users,null,2));
  console.log('Admin account created. Sign in through the ECED Resource Hub login page.');
} finally { rl.close(); }
