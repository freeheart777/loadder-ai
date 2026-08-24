import path from "node:path";
import { restoreSqliteBackup } from "../app/persistence/sqlite-backup.mjs";
const [sourceArg, targetArg, checksum] = process.argv.slice(2);
if (!sourceArg || !targetArg) throw new Error("Usage: node server/scripts/restore-database.mjs /absolute/backup.sqlite /absolute/target.sqlite [sha256]");
const result = restoreSqliteBackup({ source: path.resolve(sourceArg), target: path.resolve(targetArg), expectedChecksum: checksum || null });
console.log(JSON.stringify({ success: true, target: result.target, checksum: result.checksum, migrationCount: result.migrationCount, integrity: result.integrity }));
