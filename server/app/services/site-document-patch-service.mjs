import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { evaluatePatch, patchHash, OUTCOME } from "./v16-patch-engine.mjs";
import { LIMITS } from "./v16-patch-policy.mjs";

export class SitePatchError extends Error {
  constructor(message, code = "SITE_PATCH_ERROR", status = 409) {
    super(message);
    this.name = "SitePatchError";
    this.code = code;
    this.status = status;
  }
}

const key = (value) => {
  const next = String(value ?? "").trim();
  if (!next || next.length > 200) throw new SitePatchError("An idempotency key is required.", "SITE_PATCH_IDEMPOTENCY_KEY_REQUIRED", 400);
  return next;
};

/**
 * Structured patch persistence.
 *
 * Proposal and preview are side-effect free with respect to the document: they
 * record the patch and its validation, and never touch content_json, revisions
 * or publish state. Only apply mutates, and it does so through the repository's
 * transaction so patch state, revision and content_json commit together.
 */
export function createSiteDocumentPatchService({ db, clock = () => new Date().toISOString() } = {}) {
  if (!db) throw new SitePatchError("Database is required.", "SITE_PATCH_DATABASE_REQUIRED", 500);

  const map = (row) => row && ({
    id: row.id,
    workspaceId: row.workspace_id,
    siteProjectId: row.site_project_id,
    baseRevision: row.base_revision,
    idempotencyKey: row.idempotency_key,
    patchHash: row.patch_hash,
    operations: JSON.parse(row.operations_json),
    validation: JSON.parse(row.validation_json),
    previewHash: row.preview_hash,
    status: row.status,
    appliedRevisionId: row.applied_revision_id,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const byKey = (siteProjectId, idempotencyKey) => db.prepare(
    "SELECT * FROM site_document_patches WHERE workspace_id=? AND site_project_id=? AND idempotency_key=?"
  ).get(requireWorkspaceId(), siteProjectId, idempotencyKey) || null;

  const byId = (patchId) => db.prepare(
    "SELECT * FROM site_document_patches WHERE workspace_id=? AND id=?"
  ).get(requireWorkspaceId(), patchId) || null;

  /**
   * Record a patch proposal and its validation against the current document.
   * Writes only to site_document_patches. Caller supplies the current document
   * and revision so this stays independent of how they were loaded.
   */
  function propose({ siteProjectId, document, baseRevision, operations, idempotencyKey, actorUserId = null }) {
    const workspaceId = requireWorkspaceId();
    const idempotency = key(idempotencyKey);
    if (!Array.isArray(operations) || !operations.length) {
      throw new SitePatchError("A patch needs at least one operation.", "SITE_PATCH_EMPTY", 400);
    }
    if (operations.length > LIMITS.maxOperations) {
      throw new SitePatchError(`A patch supports at most ${LIMITS.maxOperations} operations.`, "SITE_PATCH_TOO_MANY_OPERATIONS", 400);
    }
    const hash = patchHash(operations);

    // Same key + same patch converges; same key + different patch conflicts.
    const existing = byKey(siteProjectId, idempotency);
    if (existing) {
      if (existing.patch_hash === hash) return { patch: map(existing), created: false };
      throw new SitePatchError("This idempotency key was already used for a different patch.", "SITE_PATCH_IDEMPOTENCY_CONFLICT", 409);
    }

    const evaluation = evaluatePatch(document, operations);
    const accepted = evaluation.accepted;
    const status = accepted === 0 ? "REJECTED" : "VALIDATED";
    const at = clock();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO site_document_patches(id,workspace_id,site_project_id,base_revision,idempotency_key,patch_hash,operations_json,validation_json,preview_hash,status,applied_revision_id,actor_user_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,NULL,?,NULL,?,?,?)
    `).run(id, workspaceId, siteProjectId, Number(baseRevision) || 0, idempotency, hash,
      JSON.stringify(operations), JSON.stringify(evaluation.results), status, actorUserId || null, at, at);

    return { patch: map(db.prepare("SELECT * FROM site_document_patches WHERE id=?").get(id)), created: true, evaluation };
  }

  /**
   * Compute the proposed document. Side-effect free with respect to the V16
   * document: it only records the preview hash on the patch row so a later
   * apply can be compared against what the user actually saw.
   */
  function preview({ patchId, document }) {
    const row = byId(patchId);
    if (!row) return null;
    const evaluation = evaluatePatch(document, JSON.parse(row.operations_json));
    if (!["APPLIED", "PARTIALLY_APPLIED", "REJECTED"].includes(row.status)) {
      const at = clock();
      db.prepare("UPDATE site_document_patches SET preview_hash=?,validation_json=?,status='PREVIEWED',updated_at=? WHERE id=? AND workspace_id=?")
        .run(evaluation.proposedHash, JSON.stringify(evaluation.results), at, row.id, requireWorkspaceId());
    }
    return {
      patch: map(byId(patchId)),
      proposed: evaluation.proposed,
      proposedHash: evaluation.proposedHash,
      results: evaluation.results,
      accepted: evaluation.accepted,
    };
  }

  const markConflicted = (patchId, at) => {
    const row = byId(patchId);
    if (row && !["APPLIED", "PARTIALLY_APPLIED", "REJECTED"].includes(row.status)) {
      db.prepare("UPDATE site_document_patches SET status='CONFLICTED',updated_at=? WHERE id=? AND workspace_id=?")
        .run(at, patchId, requireWorkspaceId());
    }
  };

  const markApplied = (patchId, { status, appliedRevisionId, validation, previewHash, at }) => {
    db.prepare("UPDATE site_document_patches SET status=?,applied_revision_id=?,validation_json=?,preview_hash=?,updated_at=? WHERE id=? AND workspace_id=?")
      .run(status, appliedRevisionId, JSON.stringify(validation), previewHash, at, patchId, requireWorkspaceId());
  };

  return Object.freeze({
    propose,
    preview,
    markConflicted,
    markApplied,
    evaluate: evaluatePatch,
    get(patchId) { return map(byId(patchId)); },
    getByKey(siteProjectId, idempotencyKey) { return map(byKey(siteProjectId, key(idempotencyKey))); },
    list(siteProjectId) {
      return db.prepare("SELECT * FROM site_document_patches WHERE workspace_id=? AND site_project_id=? ORDER BY created_at, id")
        .all(requireWorkspaceId(), siteProjectId).map(map);
    },
    OUTCOME,
  });
}
