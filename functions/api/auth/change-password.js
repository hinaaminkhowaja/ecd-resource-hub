import { json, currentUser, hashPassword } from "../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  const user = await currentUser(request,env);
  if (!user) return json({error:"Authentication required."},401);
  const body = await request.json().catch(()=>({}));
  const password = String(body.newPassword || "");
  if (password.length < 12) return json({error:"Use a password of at least 12 characters."},400);
  const {salt,hash} = await hashPassword(password);
  await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,must_change_password=0 WHERE id=?").bind(hash,salt,user.id).run();
  return json({ok:true});
}
