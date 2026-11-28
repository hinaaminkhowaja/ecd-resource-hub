const SESSION_DAYS = 7;
const COOKIE = "ecd_session";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}
function cookie(request, name) {
  const part = (request.headers.get("Cookie") || "").split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}
function cookieHeader(token, maxAge) {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function id() { return crypto.randomUUID().replaceAll("-", ""); }
async function body(request) {
  try { return await request.json(); } catch { throw new Error("Invalid JSON."); }
}
async function currentUser(request, env) {
  const token = cookie(request, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT u.id,u.email,u.role,u.region FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1"
  ).bind(await digest(token), Date.now()).first();
  return row || null;
}
async function requireUser(request, env) {
  const user = await currentUser(request, env);
  return user;
}
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
async function saveSession(user, env) {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now).run();
  await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)")
    .bind(id(), user.id, await digest(token), now + SESSION_DAYS * 86400000, now).run();
  return token;
}
async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/health") return json({ ok: true });

  if (request.method === "POST" && path === "/api/auth/login") {
    const input = await body(request);
    const email = String(input.email || "").trim().toLowerCase();
    if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 400);
    let user = await env.DB.prepare("SELECT id,email,role,region FROM users WHERE email=? AND active=1").bind(email).first();

    // Bootstrap the first administrator using the ADMIN_EMAIL Worker secret.
    if (!user) {
      const admins = await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE role='ADMIN'").first();
      const configuredEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
      if (!admins.total && configuredEmail && email === configuredEmail) {
        const adminId = id();
        await env.DB.prepare("INSERT INTO users(id,email,role,region,active,created_at) VALUES(?,?,'ADMIN','All',1,?)")
          .bind(adminId, email, new Date().toISOString()).run();
        user = { id: adminId, email, role: "ADMIN", region: "All" };
      }
    }
    if (!user) return json({ error: "This email address does not have an active account." }, 401);
    const token = await saveSession(user, env);
    return json({ user }, 200, { "Set-Cookie": cookieHeader(token, SESSION_DAYS * 86400) });
  }

  if (request.method === "POST" && path === "/api/auth/logout") {
    const token = cookie(request, COOKIE);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0) });
  }

  if (request.method === "GET" && path === "/api/auth/me") {
    const user = await requireUser(request, env);
    return user ? json({ user }) : json({ error: "Not signed in." }, 401);
  }

  if (path.startsWith("/api/")) {
    const user = await requireUser(request, env);
    if (!user) return json({ error: "Please sign in to continue." }, 401);
    const isAdmin = user.role === "ADMIN";

    if (path === "/api/admin/users") {
      if (!isAdmin) return json({ error: "Admin access is required." }, 403);
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT id,email,region,active,created_at AS createdAt FROM users WHERE role!='ADMIN' ORDER BY created_at DESC").all();
        return json({ users: results.map(u => ({ ...u, active: !!u.active })) });
      }
      if (request.method === "POST") {
        const input = await body(request);
        const email = String(input.email || "").trim().toLowerCase();
        const region = String(input.region || "").trim();
        if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 400);
        if (!region) return json({ error: "Select a region." }, 400);
        const exists = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
        if (exists) return json({ error: "This email already has an account." }, 409);
        const user = { id: id(), email, region, active: true, createdAt: new Date().toISOString() };
        await env.DB.prepare("INSERT INTO users(id,email,role,region,active,created_at) VALUES(?,?,'REGION',?,1,?)").bind(user.id,email,region,user.createdAt).run();
        return json({ user });
      }
      if (request.method === "PATCH") {
        const input = await body(request);
        const target = await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='REGION'").bind(String(input.id || "")).first();
        if (!target) return json({ error: "User not found." }, 404);
        if (input.region) await env.DB.prepare("UPDATE users SET region=? WHERE id=?").bind(String(input.region).trim(), target.id).run();
        if (typeof input.active === "boolean") await env.DB.prepare("UPDATE users SET active=? WHERE id=?").bind(input.active ? 1 : 0, target.id).run();
        return json({ ok: true });
      }
      return json({ error: "Method not allowed." }, 405);
    }

    if (path === "/api/receipts") {
      if (!isAdmin) return json({ error: "Admin access is required." }, 403);
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT record_json FROM receipts ORDER BY updated_at DESC").all();
        return json({ receipts: results.map(row => JSON.parse(row.record_json)) });
      }
      if (request.method === "POST") {
        const input = await body(request);
        const receipt = input.receipt;
        if (!receipt?.id || !Number.isInteger(Number(receipt.stage)) || Number(receipt.stage) < 1 || Number(receipt.stage) > 4) return json({ error: "Receipt details are incomplete." }, 400);
        const { reminderEvents, ...record } = receipt;
        record.timeline = (Array.isArray(receipt.timeline) ? receipt.timeline : []).filter(event => event.kind !== "reminder").map(event => {
          const { senderEmail, receiverEmail, notifyEmails, emailedTo, emailStatus, emailError, ...stageEvent } = event;
          return stageEvent;
        });
        record.updatedAt = new Date().toISOString();
        await env.DB.prepare("INSERT INTO receipts(id,record_json,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at")
          .bind(String(record.id), JSON.stringify(record), record.updatedAt).run();
        return json({ receipt: record });
      }
      return json({ error: "Method not allowed." }, 405);
    }

    if (path === "/api/red-flags") {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT flag_key,reason_json FROM red_flag_reasons").all();
        const reasons = {};
        for (const row of results) {
          const reason = JSON.parse(row.reason_json);
          if (isAdmin || user.region === "All" || reason.region === user.region) reasons[row.flag_key] = reason;
        }
        return json({ reasons });
      }
      if (request.method === "POST") {
        const input = await body(request);
        const key = String(input.key || "").trim();
        const reason = input.reason;
        if (!key || !reason || !String(reason.reason || "").trim() || !String(reason.name || "").trim() || !String(reason.designation || "").trim()) return json({ error: "Complete the reason, name and designation." }, 400);
        if (!isAdmin && user.region !== "All" && reason.region !== user.region) return json({ error: "You can only save reasons for your assigned region." }, 403);
        const saved = { ...reason, region: isAdmin || user.region === "All" ? String(reason.region || "").trim() : user.region, submittedBy: user.email, updatedAt: new Date().toISOString() };
        await env.DB.prepare("INSERT INTO red_flag_reasons(flag_key,region,reason_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(flag_key) DO UPDATE SET region=excluded.region,reason_json=excluded.reason_json,updated_at=excluded.updated_at")
          .bind(key, saved.region, JSON.stringify(saved), saved.updatedAt).run();
        return json({ ok: true, reason: saved });
      }
      return json({ error: "Method not allowed." }, 405);
    }
    return json({ error: "Not found." }, 404);
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try {
      if (new URL(request.url).pathname.startsWith("/api/")) return await handleApi(request, env);
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error("ECD Resource Hub request failed:", error);
      return json({ error: "The service could not complete this request." }, 500);
    }
  },
};
