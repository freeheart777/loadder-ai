import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import Database from "better-sqlite3";

const run = promisify(execFile);
const SERVER_DIR = fileURLToPath(new URL("..", import.meta.url));
const tmp = () => mkdtempSync(join(tmpdir(), "loadder-deploy-"));
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const node = (script, args, env) => run(process.execPath, [script, ...args], { cwd: SERVER_DIR, env: { ...process.env, ...env } }).then((r) => ({ code: 0, ...r }), (e) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }));

test("migrate script applies every migration once and is idempotent", async (t) => {
  const dir = tmp(); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { DATABASE_PATH: join(dir, "m.sqlite") };
  const first = await node("scripts/migrate.mjs", [], env);
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /Migrations: \d+ recorded \(\d+ applied now\)/);
  const second = await node("scripts/migrate.mjs", [], env);
  assert.equal(second.code, 0);
  assert.match(second.stdout, /\(0 applied now\)/, "a second run applies nothing");
  const db = new Database(env.DATABASE_PATH, { readonly: true });
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get().n > 100);
  db.close();
});

test("backup script takes a consistent copy of a live WAL database and verifies it", async (t) => {
  const dir = tmp(); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { DATABASE_PATH: join(dir, "live.sqlite") };
  assert.equal((await node("scripts/migrate.mjs", [], env)).code, 0);
  // A writer keeps the database open in WAL mode with data that has NOT been checkpointed into the main file.
  const live = new Database(env.DATABASE_PATH);
  live.pragma("journal_mode = WAL"); live.pragma("wal_autocheckpoint = 0");
  live.exec("CREATE TABLE backup_probe(id INTEGER PRIMARY KEY, v TEXT)");
  live.prepare("INSERT INTO backup_probe(v) VALUES (?)").run("only-in-wal");
  t.after(() => live.close());

  const dest = join(dir, "backups", "copy.sqlite");
  const result = await node("scripts/backup-sqlite.mjs", [dest], env);
  assert.equal(result.code, 0, result.stderr);
  const manifest = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(manifest.integrity, "ok"); assert.ok(manifest.latestMigration > 100); assert.match(manifest.sha256, /^[0-9a-f]{64}$/);
  const copy = new Database(dest, { readonly: true });
  assert.equal(copy.prepare("SELECT v FROM backup_probe").get().v, "only-in-wal", "WAL-resident data is in the backup");
  copy.close();

  assert.equal((await node("scripts/backup-sqlite.mjs", [dest], env)).code, 2, "never overwrites an existing backup");
  assert.equal((await node("scripts/backup-sqlite.mjs", [join(dir, "x.sqlite")], { DATABASE_PATH: join(dir, "missing.sqlite") })).code, 2);
  assert.equal(existsSync(join(dir, "x.sqlite")), false);
});

test("production refuses to boot without AUTH_HASH_SECRET", async () => {
  const dir = tmp();
  const result = await node("index.mjs", [], { NODE_ENV: "production", AUTH_HASH_SECRET: "", DATABASE_PATH: join(dir, "p.sqlite"), API_PORT: String(await freePort()) });
  assert.notEqual(result.code, 0);
  assert.match(`${result.stderr}${result.stdout}`, /AUTH_HASH_SECRET is required in production/);
  rmSync(dir, { recursive: true, force: true });
});

test("production boot through the supervisor: no dev OTP, no demo customers, fails closed on SMS, exits cleanly on SIGTERM", async (t) => {
  const dir = tmp(); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const apiPort = await freePort(), publicPort = await freePort();
  const dbPath = join(dir, "prod.sqlite");
  const logs = [];
  const child = spawn(process.execPath, ["start.mjs"], {
    cwd: SERVER_DIR, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production", API_HOST: "127.0.0.1", API_PORT: String(apiPort), PUBLIC_SITE_HOST: "127.0.0.1", PUBLIC_SITE_PORT: String(publicPort), DATABASE_PATH: dbPath, AUTH_HASH_SECRET: "production-boot-test-secret", AUTH_EXPOSE_DEV_OTP: "true", SMS_PROVIDER: "simulator", SITE_MEDIA_LOCAL_DIR: join(dir, "media"), MEDICAL_DOCUMENT_DEV_DIR: join(dir, "med"), LOADDER_OBJECT_STORAGE_DIR: join(dir, "obj"), PROCESS_SHUTDOWN_GRACE_MS: "8000" },
  });
  child.stdout.on("data", (d) => logs.push(String(d))); child.stderr.on("data", (d) => logs.push(String(d)));
  const exited = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal })));
  t.after(() => child.kill("SIGKILL"));
  const base = `http://127.0.0.1:${apiPort}`;
  let health;
  for (let i = 0; i < 80 && !health; i++) { try { const r = await fetch(`${base}/api/health`); if (r.ok) health = await r.json(); } catch { /* starting */ } if (!health) await sleep(500); }
  assert.ok(health, `API did not become healthy:\n${logs.join("").slice(-1500)}`);
  assert.equal(health.environment, "production");
  assert.equal(health.auth.otpDelivery, "not-connected"); assert.equal(health.auth.productionReady, false);

  const otp = await fetch(`${base}/api/auth/send-otp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mobile: "09121234567", name: "Operator" }) });
  const otpBody = await otp.text();
  assert.equal(otp.status, 503, "simulator SMS is refused in production");
  assert.equal(JSON.parse(otpBody).code, "OTP_DELIVERY_NOT_CONFIGURED");
  assert.equal(/developmentOtp|\d{5}/.test(otpBody), false, "no code in the response");
  const status = await (await fetch(`${base}/api/auth/status`)).json();
  assert.equal(status.developmentOtpExposed, false, "AUTH_EXPOSE_DEV_OTP is ignored in production");

  assert.equal((await fetch(`http://127.0.0.1:${publicPort}/sites/none`)).status, 404, "public-site runtime is up");

  const db = new Database(dbPath, { readonly: true });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM customers").get().n, 0, "production starts without demo customers");
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM marketing_channels").get().n > 0, "reference catalog is still seeded");
  db.close();
  assert.equal(/\b\d{5}\b/.test(logs.join("")) && /developmentOtp/.test(logs.join("")), false);

  child.kill("SIGTERM");
  const result = await Promise.race([exited, sleep(15000).then(() => "timeout")]);
  assert.notEqual(result, "timeout", "supervisor must stop within its grace period");
  assert.equal(result.code, 0, `clean exit expected, got ${JSON.stringify(result)}\n${logs.join("").slice(-800)}`);
});
