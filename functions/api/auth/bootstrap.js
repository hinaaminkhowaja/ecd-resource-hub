import { json, hashPassword } from "../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_BOOTSTRAP_SECRET) return json({ error:"Administrator bootstrap is not configured." },503);
  const body = await request.json().catch(() => ({}));
  const supplied = String(body.bootstrapSecret || "");
  if (supplied.length < 20 || supplied !== env.ADMIN_BOOTSTRAP_SECRET) return json({ error:"Invalid bootstrap secret." },403);
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  if (Number(count?.n || 0) !== 0) return json({ error:"Initial administrator already exists." },409);
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim();
  const password = String(body.password || "");
  if (!email.includes("@") || !fullName || password.length < 12) return json({ error:"Provide a valid email, name, and password of at least 12 characters." },400);
  const {salt,hash} = await hashPassword(password);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id,email,full_name,password_hash,password_salt,role,must_change_password) VALUES (?,?,?,?,?,'ADMIN',0)").bind(id,email,fullName,hash,salt).run();
  return json({ ok:true, message:"Initial administrator created. You can now sign in." },201);
}
