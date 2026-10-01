import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

export class LearningAccessError extends Error {
  constructor(message, status = 400, code = "LEARNING_ACCESS_ERROR") {
    super(message); this.name = "LearningAccessError"; this.status = status; this.code = code;
  }
}

const present = (row) => row && ({
  id: row.id, siteProjectId: row.site_project_id, authProjectId: row.auth_project_id, appUserId: row.app_user_id,
  status: row.status, createdAt: row.created_at, revokedAt: row.revoked_at || null,
});

// Student entitlement = an active enrolment row for the caller's existing
// app-user identity. Workspace membership never grants student access, and the
// storage key never leaves the server.
export function createLearningAccessService({ db, mediaService, now = () => new Date().toISOString() }) {
  const activeEnrollment = (siteProjectId, principal) => {
    if (!principal?.id || !principal.projectId || String(principal.role).toLowerCase() !== "customer") return null;
    return db.prepare("SELECT * FROM site_learning_enrollments WHERE workspace_id=? AND site_project_id=? AND auth_project_id=? AND app_user_id=? AND status='active'")
      .get(requireWorkspaceId(), siteProjectId, principal.projectId, principal.id) || null;
  };

  function requireEntitlement(siteProjectId, principal) {
    mediaService.listLearningResources(siteProjectId); // asserts the site exists in this workspace
    if (!activeEnrollment(siteProjectId, principal)) throw new LearningAccessError("Learning access is not available for this account.", 403, "LEARNING_ENROLLMENT_REQUIRED");
  }

  function enroll(siteProjectId, { authProjectId, appUserId, actorUserId = null }) {
    const workspaceId = requireWorkspaceId(), at = now();
    if (!authProjectId || !appUserId) throw new LearningAccessError("authProjectId and appUserId are required.", 400, "LEARNING_ENROLLMENT_INPUT_INVALID");
    mediaService.listLearningResources(siteProjectId);
    const existing = db.prepare("SELECT * FROM site_learning_enrollments WHERE workspace_id=? AND site_project_id=? AND auth_project_id=? AND app_user_id=?").get(workspaceId, siteProjectId, authProjectId, appUserId);
    if (existing) {
      db.prepare("UPDATE site_learning_enrollments SET status='active',revoked_at=NULL,updated_at=? WHERE id=? AND workspace_id=?").run(at, existing.id, workspaceId);
      return present(db.prepare("SELECT * FROM site_learning_enrollments WHERE id=? AND workspace_id=?").get(existing.id, workspaceId));
    }
    const id = crypto.randomUUID();
    try {
      db.prepare("INSERT INTO site_learning_enrollments(id,workspace_id,site_project_id,auth_project_id,app_user_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?, 'active',?,?,?)").run(id, workspaceId, siteProjectId, authProjectId, appUserId, actorUserId, at, at);
    } catch (error) {
      if (/learning enrollment requires/.test(String(error?.message))) throw new LearningAccessError("Student or education site is not eligible for enrolment.", 422, "LEARNING_ENROLLMENT_TARGET_INVALID");
      throw error;
    }
    return present(db.prepare("SELECT * FROM site_learning_enrollments WHERE id=? AND workspace_id=?").get(id, workspaceId));
  }

  function revoke(siteProjectId, enrollmentId) {
    mediaService.listLearningResources(siteProjectId);
    const at = now();
    const changed = db.prepare("UPDATE site_learning_enrollments SET status='revoked',revoked_at=?,updated_at=? WHERE id=? AND workspace_id=? AND site_project_id=?").run(at, at, enrollmentId, requireWorkspaceId(), siteProjectId).changes;
    if (!changed) throw new LearningAccessError("Enrolment not found.", 404, "LEARNING_ENROLLMENT_NOT_FOUND");
    return present(db.prepare("SELECT * FROM site_learning_enrollments WHERE id=? AND workspace_id=?").get(enrollmentId, requireWorkspaceId()));
  }

  function listEnrollments(siteProjectId) {
    mediaService.listLearningResources(siteProjectId);
    return db.prepare("SELECT * FROM site_learning_enrollments WHERE workspace_id=? AND site_project_id=? ORDER BY created_at DESC").all(requireWorkspaceId(), siteProjectId).map(present);
  }

  function listResourcesFor(siteProjectId, principal) {
    requireEntitlement(siteProjectId, principal);
    return mediaService.listLearningResources(siteProjectId);
  }

  async function readResourceFor(siteProjectId, mediaId, principal) {
    requireEntitlement(siteProjectId, principal);
    return mediaService.readLearningResource(siteProjectId, mediaId);
  }

  return Object.freeze({ enroll, revoke, listEnrollments, listResourcesFor, readResourceFor });
}
