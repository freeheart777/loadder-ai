import Database from "better-sqlite3";
import path from "node:path";
import { createSqliteBackup } from "../app/persistence/sqlite-backup.mjs";
const databasePath = process.env.DATABASE_PATH && path.resolve(process.env.DATABASE_PATH), backupDirectory = process.env.LOADDER_BACKUP_DIR && path.resolve(process.env.LOADDER_BACKUP_DIR);
if (!databasePath || !backupDirectory) throw new Error("PERSISTENCE_BACKUP_CONFIG_REQUIRED");
const db = new Database(databasePath, { fileMustExist: true });
try { db.pragma("foreign_keys = ON"); const result = createSqliteBackup({ db, databasePath, backupDirectory, publicDirectories: [process.env.LANDING_STATIC_DIRECTORY, process.env.PUBLIC_STATIC_DIRECTORY].filter(Boolean) }); console.log(JSON.stringify({ success: true, filename: result.filename, bytes: result.bytes, checksum: result.checksum, migrationCount: result.migrationCount, integrity: result.integrity })); }
finally { db.close(); }
