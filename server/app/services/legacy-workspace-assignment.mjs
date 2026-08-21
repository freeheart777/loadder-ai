import crypto from "crypto";

import { LEGACY_WORKSPACE_ID } from "../../db/migrations/002_tenant_domain_data.mjs";

export function assignLegacyWorkspaceOwner(db, identifier, timestamp) {
  const value = String(identifier || "").trim();
  if (!value) throw new Error("A mobile number or user ID is required.");

  const user = db
    .prepare("SELECT id, mobile, name FROM users WHERE id = ? OR mobile = ?")
    .get(value, value);
  if (!user) throw new Error("User not found.");

  return db.transaction(() => {
    const workspace = db
      .prepare("SELECT id FROM workspaces WHERE id = ?")
      .get(LEGACY_WORKSPACE_ID);
    if (!workspace) throw new Error("Legacy workspace not found.");

    const existing = db
      .prepare(`
        SELECT id, role, status FROM workspace_memberships
        WHERE workspace_id = ? AND user_id = ?
      `)
      .get(LEGACY_WORKSPACE_ID, user.id);

    if (existing?.role === "owner" && existing.status === "active") {
      return { changed: false, userId: user.id, workspaceId: workspace.id };
    }

    let membershipId = existing?.id || crypto.randomUUID();
    if (existing) {
      db.prepare(`
        UPDATE workspace_memberships
        SET role = 'owner', status = 'active', updated_at = ?
        WHERE id = ?
      `).run(timestamp, existing.id);
    } else {
      db.prepare(`
        INSERT INTO workspace_memberships (
          id, workspace_id, user_id, role, status, created_at, updated_at
        ) VALUES (?, ?, ?, 'owner', 'active', ?, ?)
      `).run(
        membershipId,
        workspace.id,
        user.id,
        timestamp,
        timestamp
      );
    }

    db.prepare(`
      INSERT INTO audit_logs (
        id, workspace_id, user_id, action, resource_type,
        resource_id, metadata_json, created_at
      ) VALUES (?, ?, ?, 'workspace.legacy_owner_assigned',
        'workspace_membership', ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      workspace.id,
      user.id,
      membershipId,
      JSON.stringify({ source: "maintenance_cli" }),
      timestamp
    );

    return { changed: true, userId: user.id, workspaceId: workspace.id };
  })();
}
