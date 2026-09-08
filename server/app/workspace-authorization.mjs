// Canonical workspace operator authorization.
//
// One rule, one place: the actor must hold an ACTIVE owner/admin membership in
// the workspace the request is already scoped to. The workspace id must come
// from the server-derived tenant context (see tenant-context.mjs), never from a
// request body.
//
// The check runs on the caller's own database handle so it stays inside the
// caller's transaction: authorization and the write it guards must succeed or
// roll back together, and a membership revoked mid-transaction cannot be raced.
// Callers keep their own domain error code and status; this predicate
// deliberately does not throw, so no domain's failure semantics change.

export const WORKSPACE_OPERATOR_ROLES = Object.freeze(["owner", "admin"]);

const OPERATOR_MEMBERSHIP_SQL =
  "SELECT id FROM workspace_memberships WHERE workspace_id=? AND user_id=? AND status='active' AND role IN('owner','admin')";

export function isWorkspaceOperator(db, workspaceId, userId) {
  if (!db || !workspaceId || !userId) return false;
  return Boolean(db.prepare(OPERATOR_MEMBERSHIP_SQL).get(workspaceId, userId));
}
