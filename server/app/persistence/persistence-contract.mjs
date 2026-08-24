import path from "node:path";
import os from "node:os";
export class PersistenceError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = (code) => { throw new PersistenceError(code); }, inside = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);
const absolute = (value, code) => { if (!value || !path.isAbsolute(value)) fail(code); return path.resolve(value); };
export function createPersistenceContract(env = process.env) {
  const production = (env.NODE_ENV || "development") === "production", reasons = [];
  const databasePath = env.DATABASE_PATH ? path.resolve(env.DATABASE_PATH) : null, landingDirectory = env.LANDING_STATIC_DIRECTORY ? path.resolve(env.LANDING_STATIC_DIRECTORY) : null, websiteDirectory = env.PUBLIC_STATIC_DIRECTORY ? path.resolve(env.PUBLIC_STATIC_DIRECTORY) : null, backupDirectory = env.LOADDER_BACKUP_DIR ? path.resolve(env.LOADDER_BACKUP_DIR) : null, instanceCount = Number(env.LOADDER_INSTANCE_COUNT || 1);
  if (production) {
    if (env.DATABASE_PATH && !path.isAbsolute(env.DATABASE_PATH)) reasons.push("PERSISTENCE_DATABASE_PATH_UNSAFE");
    for (const [value, missing, unsafe] of [[env.LANDING_STATIC_DIRECTORY,"PERSISTENCE_LANDING_NOT_CONFIGURED","PERSISTENCE_LANDING_PATH_UNSAFE"],[env.PUBLIC_STATIC_DIRECTORY,"PERSISTENCE_WEBSITE_NOT_CONFIGURED","PERSISTENCE_WEBSITE_PATH_UNSAFE"],[env.LOADDER_BACKUP_DIR,"PERSISTENCE_BACKUP_NOT_CONFIGURED","PERSISTENCE_BACKUP_DIR_UNSAFE"]]) { if (!value) reasons.push(missing); else if (!path.isAbsolute(value)) reasons.push(unsafe); }
    const temp = path.resolve(os.tmpdir());
    if (databasePath && (inside(temp, databasePath) || /(?:^|[/\\])(?:test|fixtures?)(?:[/\\]|$)/i.test(databasePath))) reasons.push("PERSISTENCE_DATABASE_PATH_UNSAFE");
    if (!Number.isInteger(instanceCount) || instanceCount !== 1) reasons.push("PERSISTENCE_MULTI_INSTANCE_UNSUPPORTED");
    if (backupDirectory && [landingDirectory, websiteDirectory].some((root) => root && (inside(root, backupDirectory) || inside(backupDirectory, root)))) reasons.push("PERSISTENCE_PUBLIC_BACKUP_OVERLAP");
  }
  const blocking = reasons.some((code) => !code.endsWith("_NOT_CONFIGURED")), configured = Boolean(databasePath && landingDirectory && websiteDirectory && backupDirectory && !blocking), deploymentValidated = configured && env.LOADDER_PERSISTENCE_VALIDATED === "true";
  return Object.freeze({ configured, deploymentValidated, status: blocking ? "BLOCKED" : deploymentValidated ? "DEPLOYMENT_VALIDATED" : configured ? "CODE_READY_DEPLOYMENT_VALIDATION_PENDING" : "NOT_CONFIGURED", reasonCodes: Object.freeze([...new Set(reasons)]), instanceCount, paths: Object.freeze({ databasePath, landingDirectory, websiteDirectory, backupDirectory }), singleWritableInstanceRequired: true, multiInstanceSqliteSupported: false });
}
export function assertSafeBackupPaths({ databasePath, backupDirectory, publicDirectories = [] }) {
  const db = absolute(databasePath, "PERSISTENCE_DATABASE_PATH_UNSAFE"), backup = absolute(backupDirectory, "PERSISTENCE_BACKUP_DIR_UNSAFE");
  if (publicDirectories.filter(Boolean).map((value) => path.resolve(value)).some((root) => inside(root, backup) || inside(backup, root))) fail("PERSISTENCE_PUBLIC_BACKUP_OVERLAP");
  if (inside(path.dirname(db), backup)) fail("PERSISTENCE_BACKUP_DIR_UNSAFE");
  return Object.freeze({ databasePath: db, backupDirectory: backup });
}
