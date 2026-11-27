import { json, verifyPassword, createSession, cookieHeader, publicUser } from "../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return json({ error:"Enter your email and password." },400);
  const user = await env.DB.prepare("SELECT * FROM users WHERE email=? AND active=1").bind(email).first();
  if (!user || !(await verifyPassword(password,user.password_salt,user.password_hash))) return json({ error:"Email or password is incorrect." },401);
  const token = await createSession(env.DB,user.id);
  return json({ user:publicUser(user) },200,{ "Set-Cookie":cookieHeader(token) });
}
