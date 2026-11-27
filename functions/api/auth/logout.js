import { json, readCookie, shaToken } from "../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  const token = readCookie(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await shaToken(token)).run();
  return json({ ok:true },200,{ "Set-Cookie":"ecd_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" });
}
