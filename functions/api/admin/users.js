import { json, requireAdmin, hashPassword } from "../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request,env); if (auth.response) return auth.response;
  const { results=[] } = await env.DB.prepare("SELECT id,email,full_name,role,region,local_board,rec_code,active,must_change_password,created_at FROM users ORDER BY full_name").all();
  return json({ users:results });
}
export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request,env); if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim();
  const password = String(body.temporaryPassword || "");
  const role = String(body.role || "");
  const region = String(body.region || "").trim();
  const localBoard = String(body.localBoard || "").trim();
  const recCode = String(body.recCode || "").trim();
  if (!email.includes("@") || !fullName || password.length < 12 || !["REGION","LOCAL_BOARD","REC"].includes(role)) return json({ error:"Provide valid details, a role, and a temporary password of at least 12 characters." },400);
  if (role === "REGION" && !region) return json({ error:"Select a region for this account." },400);
  if (role === "LOCAL_BOARD" && (!region || !localBoard)) return json({ error:"Select both region and Local Board." },400);
  if (role === "REC" && (!region || !localBoard || !recCode)) return json({ error:"Select region, Local Board, and REC." },400);
  const {salt,hash} = await hashPassword(password);
  try {
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO users (id,email,full_name,password_hash,password_salt,role,region,local_board,rec_code,must_change_password) VALUES (?,?,?,?,?,?,?,?,?,1)")
      .bind(id,email,fullName,hash,salt,role,region || null,localBoard || null,recCode || null).run();
    return json({ ok:true,id },201);
  } catch (error) {
    return json({ error:"Could not create account. Check whether this email is already registered." },409);
  }
}
export async function onRequestPatch({ request, env }) {
  const auth = await requireAdmin(request,env); if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return json({ error:"User ID is required." },400);
  if (body.active === false) {
    await env.DB.prepare("UPDATE users SET active=0 WHERE id=? AND role<>'ADMIN'").bind(id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
  } else if (body.active === true) {
    await env.DB.prepare("UPDATE users SET active=1 WHERE id=? AND role<>'ADMIN'").bind(id).run();
  } else return json({ error:"Specify active true or false." },400);
  return json({ ok:true });
}
