import { json, requireUser } from "./_lib/auth.js";
function inScope(user, item) {
  if (user.role === "ADMIN") return true;
  if (user.region !== item.region) return false;
  if (user.role === "REGION") return true;
  if (user.local_board !== item.localBoard) return false;
  if (user.role === "LOCAL_BOARD") return true;
  return user.role === "REC" && user.rec_code === item.recCode;
}
export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request,env); if (auth.response) return auth.response;
  const u=auth.user;
  let sql="SELECT id,reason_key,view_type,rec_code,rec_name,region,local_board,class_name,reason,contributor_name,designation,created_at,updated_at FROM red_flag_reasons";
  const args=[];
  if (u.role==="REGION") { sql+=" WHERE region=?"; args.push(u.region); }
  else if (u.role==="LOCAL_BOARD") { sql+=" WHERE region=? AND local_board=?"; args.push(u.region,u.local_board); }
  else if (u.role==="REC") { sql+=" WHERE region=? AND local_board=? AND rec_code=?"; args.push(u.region,u.local_board,u.rec_code); }
  sql+=" ORDER BY updated_at DESC";
  const {results=[]}=await env.DB.prepare(sql).bind(...args).all();
  return json({reasons:results});
}
export async function onRequestPost({ request, env }) {
  const auth=await requireUser(request,env); if(auth.response) return auth.response;
  const body=await request.json().catch(()=>({}));
  const item={
    reasonKey:String(body.reasonKey||"").trim(), viewType:String(body.viewType||"").trim(),
    recCode:String(body.recCode||"").trim(), recName:String(body.recName||"").trim(),
    region:String(body.region||"").trim(), localBoard:String(body.localBoard||"").trim(),
    className:String(body.className||"").trim(), reason:String(body.reason||"").trim(),
    contributorName:String(body.contributorName||"").trim(), designation:String(body.designation||"").trim()
  };
  if(!item.reasonKey||!["previous","quarter"].includes(item.viewType)||!item.recCode||!item.region||!item.reason||!item.contributorName||!item.designation) return json({error:"Complete the reason, REC, and contributor details."},400);
  if(!inScope(auth.user,item)) return json({error:"You do not have access to this REC."},403);
  const now=new Date().toISOString(), id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO red_flag_reasons (id,reason_key,view_type,rec_code,rec_name,region,local_board,class_name,reason,contributor_name,designation,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(reason_key,view_type,rec_code) DO UPDATE SET rec_name=excluded.rec_name,region=excluded.region,local_board=excluded.local_board,class_name=excluded.class_name,reason=excluded.reason,contributor_name=excluded.contributor_name,designation=excluded.designation,created_by=excluded.created_by,updated_at=excluded.updated_at`)
    .bind(id,item.reasonKey,item.viewType,item.recCode,item.recName,item.region,item.localBoard,item.className,item.reason,item.contributorName,item.designation,auth.user.id,now,now).run();
  return json({ok:true},201);
}
