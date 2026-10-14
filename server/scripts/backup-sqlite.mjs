// Consistent online backup of the SQLite database while the API is running (WAL-safe).
//   node scripts/backup-sqlite.mjs <destination-file>
// Uses SQLite's online backup API, then verifies the copy (integrity_check) and prints a manifest.
// Never copy the .sqlite file with cp while the server runs: the WAL would be missed.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const source = process.env.DATABASE_PATH;
const destination = process.argv[2];
if (!source || !destination) { console.error("usage: DATABASE_PATH=<db> node scripts/backup-sqlite.mjs <destination-file>"); process.exit(2); }
if (!fs.existsSync(source)) { console.error(`DATABASE_PATH does not exist: ${source}`); process.exit(2); }
if (fs.existsSync(destination)) { console.error(`Refusing to overwrite ${destination}`); process.exit(2); }

fs.mkdirSync(path.dirname(destination), { recursive: true });
const db = new Database(source, { fileMustExist: true });
try {
  await db.backup(destination);
} finally { db.close(); }

const copy = new Database(destination, { readonly: true, fileMustExist: true });
try {
  const integrity = copy.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") throw new Error(`backup failed integrity_check: ${integrity}`);
  const hasMigrations = copy.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").get();
  const latest = hasMigrations ? copy.prepare("SELECT MAX(version) AS v FROM schema_migrations").get().v : null;
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(destination)).digest("hex");
  console.log(JSON.stringify({ destination, bytes: fs.statSync(destination).size, integrity, latestMigration: latest, sha256 }));
} catch (error) {
  fs.rmSync(destination, { force: true });
  console.error(error.message);
  process.exit(1);
} finally { copy.close(); }
