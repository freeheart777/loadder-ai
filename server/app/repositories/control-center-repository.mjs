import { requireWorkspaceId } from "../tenant-context.mjs";
const count = (db, table, workspaceId) => {
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  return exists ? Number(db.prepare(`SELECT count(*) AS total FROM ${table} WHERE workspace_id=?`).get(workspaceId).total) : 0;
};
export function createControlCenterRepository(db) {
  return Object.freeze({ summary() { const workspaceId=requireWorkspaceId(); return { projects:count(db,"site_projects",workspaceId), services:count(db,"booking_services",workspaceId), providers:count(db,"booking_providers",workspaceId), appointments:count(db,"booking_appointments",workspaceId), leads:count(db,"leads",workspaceId), orders:count(db,"orders",workspaceId) }; } });
}
