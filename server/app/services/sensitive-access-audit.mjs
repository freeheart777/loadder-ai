import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

const ACTOR_KINDS = new Set(["operator", "app_user", "system"]);
// Metadata is evidence, not a data dump: scalars only, bounded, and anything
// that looks like a credential is dropped rather than stored.
const SECRET_KEY = /token|secret|password|otp|passcode|authorization|cookie|credential|hash|key/i;

export function sanitizeAuditMetadata(metadata = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(metadata || {}).slice(0, 20)) {
    if (SECRET_KEY.test(key)) continue;
    if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) clean[key.slice(0, 40)] = value;
    else if (typeof value === "string") clean[key.slice(0, 40)] = value.slice(0, 200);
  }
  return clean;
}

export function createSensitiveAccessAudit(db, { now = () => new Date().toISOString() } = {}) {
  function record({ siteProjectId = null, actor, action, resourceType, resourceId = null, metadata = {} }) {
    if (!actor || !ACTOR_KINDS.has(actor.kind) || !action || !resourceType) throw new Error("A sensitive access event needs an actor, action and resource type.");
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO sensitive_access_events(id,workspace_id,site_project_id,actor_kind,actor_id,action,resource_type,resource_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(id, requireWorkspaceId(), siteProjectId, actor.kind, actor.id ? String(actor.id) : null, String(action).slice(0, 80), String(resourceType).slice(0, 60), resourceId ? String(resourceId) : null, JSON.stringify(sanitizeAuditMetadata(metadata)), now());
    return id;
  }
  const list = ({ resourceType, resourceId } = {}) => db.prepare("SELECT id,site_project_id AS siteProjectId,actor_kind AS actorKind,actor_id AS actorId,action,resource_type AS resourceType,resource_id AS resourceId,metadata_json AS metadata,created_at AS createdAt FROM sensitive_access_events WHERE workspace_id=? AND (? IS NULL OR resource_type=?) AND (? IS NULL OR resource_id=?) ORDER BY created_at ASC, rowid ASC")
    .all(requireWorkspaceId(), resourceType ?? null, resourceType ?? null, resourceId ?? null, resourceId ?? null).map((row) => ({ ...row, metadata: JSON.parse(row.metadata) }));
  return Object.freeze({ record, list });
}
