import { fileURLToPath } from "node:url";
import path from "node:path";

import { db } from "../db/database.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { assignLegacyWorkspaceOwner } from "../app/services/legacy-workspace-assignment.mjs";

export function runLegacyOwnerAssignment(identifier) {
  runMigrations(db);
  return assignLegacyWorkspaceOwner(db, identifier, new Date().toISOString());
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const result = runLegacyOwnerAssignment(process.argv[2]);
    console.log(
      result.changed
        ? `Legacy workspace owner assigned to user ${result.userId}.`
        : `User ${result.userId} is already the legacy workspace owner.`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
