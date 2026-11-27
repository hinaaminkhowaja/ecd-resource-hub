const encoder = new TextEncoder();
const SESSION_DAYS = 7;
const COOKIE = "ecd_session";

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(value) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}
export async function hashPassword(password, salt = toHex(crypto.getRandomValues(new Uint8Array(16)))) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: 210000, hash: "SHA-256" }, material, 256);
  return { salt, hash: toHex(bits) };
}
export async function verifyPassword(password, salt, expected) {
  const result = await hashPassword(password, salt);
  return result.hash === expected;
}
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}
export function cookieHeader(token, maxAge = SESSION_DAYS * 86400) {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
export function readCookie(request) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map((v) => v.trim()).find((v) => v.startsWith(COOKIE + "="));
  return item ? item.slice(COOKIE.length + 1) : "";
}
export async function createSession(db, userId) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(tokenHash,userId,expires).run();
  return token;
}
export async function currentUser(request, env) {
  const token = readCookie(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`SELECT u.id,u.email,u.full_name,u.role,u.region,u.local_board,u.rec_code,u.must_change_password
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.active=1`).bind(tokenHash,new Date().toISOString()).first();
  return row || null;
}
export function publicUser(user) {
  return { id:user.id, email:user.email, fullName:user.full_name, role:user.role, region:user.region, localBoard:user.local_board, recCode:user.rec_code, mustChangePassword:Boolean(user.must_change_password) };
}
export async function requireUser(request, env) {
  const user = await currentUser(request, env);
  return user ? { user } : { response: json({ error:"Authentication required." },401) };
}
export async function requireAdmin(request, env) {
  const result = await requireUser(request, env);
  if (result.response) return result;
  return result.user.role === "ADMIN" ? result : { response: json({ error:"Administrator access required." },403) };
}
export async function shaToken(token) { return sha256(token); }
