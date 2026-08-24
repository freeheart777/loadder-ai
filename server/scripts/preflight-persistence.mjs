import { closeSync, mkdirSync, openSync, rmSync } from "node:fs";
import path from "node:path";
import { createPersistenceContract } from "../app/persistence/persistence-contract.mjs";
import { validateSqliteFile } from "../app/persistence/sqlite-backup.mjs";
const contract = createPersistenceContract(process.env);
if (!contract.configured || contract.reasonCodes.length) throw new Error(contract.reasonCodes.join(",") || "PERSISTENCE_NOT_CONFIGURED");
for (const directory of [path.dirname(contract.paths.databasePath), contract.paths.landingDirectory, contract.paths.websiteDirectory, contract.paths.backupDirectory]) { mkdirSync(directory, { recursive: true, mode: 0o750 }); const probe = path.join(directory, `.loadder-write-probe-${process.pid}`); let fd; try { fd = openSync(probe, "wx", 0o600); } finally { if (fd !== undefined) closeSync(fd); rmSync(probe, { force: true }); } }
const database = validateSqliteFile(contract.paths.databasePath);
console.log(JSON.stringify({ success: true, status: contract.status, singleWritableInstanceRequired: true, database: { integrity: database.integrity, foreignKeyViolations: database.foreignKeys.length, migrationCount: database.migrationCount }, directoriesWritable: true }));
