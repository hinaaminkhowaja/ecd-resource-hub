import { requireAdmin } from "./_lib/auth.js";
function csv(value){const s=String(value??"");return '"'+s.replace(/"/g,'""')+'"';}
export async function onRequestGet({ request, env }) {
  const auth=await requireAdmin(request,env); if(auth.response) return auth.response;
  const {results=[]}=await env.DB.prepare("SELECT region,local_board,rec_code,rec_name,view_type,class_name,reason,contributor_name,designation,created_at,updated_at FROM red_flag_reasons ORDER BY region,local_board,rec_code").all();
  const headers=["Region","LocalBoard","REC Code","REC Name","Comparison Type","Class","Reason","Contributor","Designation","Created At","Updated At"];
  const rows=[headers,...results.map(r=>[r.region,r.local_board,r.rec_code,r.rec_name,r.view_type,r.class_name,r.reason,r.contributor_name,r.designation,r.created_at,r.updated_at])];
  const body="\uFEFF"+rows.map(row=>row.map(csv).join(",")).join("\r\n");
  return new Response(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="ECED-Red-Flag-Reasons.csv"',"Cache-Control":"no-store"}});
}
