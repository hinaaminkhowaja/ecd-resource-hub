import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const output = path.join("/tmp", "ecd-resource-hub-cloudflare-import.sql");

async function readJson(name, fallback) {
  try { return JSON.parse(await readFile(path.join(dataDir, name), "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return "'" + String(value).replaceAll("'", "''") + "'";
}
function json(value) { return sql(JSON.stringify(value)); }

const users = await readJson("users.json", []);
const receipts = await readJson("receipt-store.json", []);
const reasons = await readJson("red-flag-reasons.json", {});
const statements = [];

for (const user of users) {
  if (!user?.id || !user?.email || !["ADMIN", "REGION"].includes(user.role)) continue;
  statements.push(
    "INSERT OR REPLACE INTO users(id,email,role,region,active,created_at) VALUES(" +
    [user.id, user.email.toLowerCase(), user.role, user.region || "All", user.active === false ? 0 : 1, user.createdAt || new Date().toISOString()].map(sql).join(",") +
    ");"
  );
}
for (const receipt of receipts) {
  if (!receipt?.id) continue;
  const { reminderEvents, ...record } = receipt;
  record.timeline = (Array.isArray(receipt.timeline) ? receipt.timeline : [])
    .filter(event => event.kind !== "reminder")
    .map(event => {
      const { senderEmail, receiverEmail, notifyEmails, emailedTo, emailStatus, emailError, ...safeEvent } = event;
      return safeEvent;
    });
  statements.push("INSERT OR REPLACE INTO receipts(id,record_json,updated_at) VALUES(" +
    [String(record.id), JSON.stringify(record), record.updatedAt || new Date().toISOString()].map(sql).join(",") + ");");
}
for (const [key, reason] of Object.entries(reasons || {})) {
  if (!reason || typeof reason !== "object") continue;
  statements.push("INSERT OR REPLACE INTO red_flag_reasons(flag_key,region,reason_json,updated_at) VALUES(" +
    [key, reason.region || "", JSON.stringify(reason), reason.updatedAt || new Date().toISOString()].map(sql).join(",") + ");");
}

if (!statements.length) {
  console.log("No local users, receipts or red-flag reasons were found to import.");
  console.log("If this is a new deployment, the first admin can be bootstrapped using the ADMIN_EMAIL Worker secret.");
  process.exit(0);
}

await writeFile(output, statements.join("\n") + "\n", "utf8");
console.log(`Prepared ${users.length} user(s), ${receipts.length} receipt(s), and ${Object.keys(reasons || {}).length} red-flag reason(s).`);
console.log("Importing into the remote D1 database. Existing rows with matching IDs/keys will be replaced.");
const child = spawn("npx", ["wrangler", "d1", "execute", "ecd-resource-hub-db", "--remote", "--file", output], { stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", code => process.exit(code ?? 1));
