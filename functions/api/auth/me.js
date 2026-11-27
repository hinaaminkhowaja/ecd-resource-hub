import { json, currentUser, publicUser } from "../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const user = await currentUser(request,env);
  return user ? json({ user:publicUser(user) }) : json({ user:null },401);
}
