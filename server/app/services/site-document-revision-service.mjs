import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

export class SiteRevisionError extends Error {
  constructor(message, code = "SITE_REVISION_ERROR", status = 409) {
    super(message);
    this.name = "SiteRevisionError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Deterministic canonical serialization.
 *
 * Object keys are emitted in sorted order at every depth so that two documents
 * that differ only in key insertion order serialise identically. Array order is
 * meaningful and is preserved. The input is never mutated, and nothing —
 * timestamps, ids, runtime metadata — is added for the sake of hashing.
 */
export function canonicalDocumentString(value) {
  const write = (node) => {
    if (node === null) return "null";
    if (Array.isArray(node)) return `[${node.map(write).join(",")}]`;
    if (typeof node === "object") {
      const keys = Object.keys(node).filter((key) => node[key] !== undefined).sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${write(node[key])}`).join(",")}}`;
    }
    if (typeof node === "number" && !Number.isFinite(node)) return "null";
    if (node === undefined) return "null";
    return JSON.stringify(node);
  };
  return write(value ?? null);
}

/** SHA-256 of the canonical form, as lowercase hex. */
export const documentHash = (value) =>
  crypto.createHash("sha256").update(canonicalDocumentString(value)).digest("hex");

const key = (value) => {
  const next = String(value ?? "").trim();
  if (!next || next.length > 200) {
    throw new SiteRevisionError("An idempotency key is required.", "SITE_REVISION_IDEMPOTENCY_KEY_REQUIRED", 400);
  }
  return next;
};

/**
 * The append-only draft revision log.
 *
 * Every function here runs INSIDE a transaction owned by the caller (the site
 * project repository), so a draft write and its revision either both land or
 * neither does. Nothing in this module opens its own transaction.
 */
export function createSiteDocumentRevisionService({ db, clock = () => new Date().toISOString() } = {}) {
  if (!db) throw new SiteRevisionError("Database is required.", "SITE_REVISION_DATABASE_REQUIRED", 500);

  const map = (row) => row && ({
    id: row.id,
    workspaceId: row.workspace_id,
    siteProjectId: row.site_project_id,
    revision: row.revision,
    parentRevisionId: row.parent_revision_id,
    document: JSON.parse(row.document_json),
    documentHash: row.document_hash,
    actorUserId: row.actor_user_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  });

  const latest = (siteProjectId, workspaceId) => db.prepare(
    "SELECT * FROM site_document_revisions WHERE workspace_id=? AND site_project_id=? ORDER BY revision DESC LIMIT 1"
  ).get(workspaceId, siteProjectId) || null;

  const byKey = (siteProjectId, workspaceId, idempotencyKey) => db.prepare(
    "SELECT * FROM site_document_revisions WHERE workspace_id=? AND site_project_id=? AND idempotency_key=?"
  ).get(workspaceId, siteProjectId, idempotencyKey) || null;

  /**
   * Append the next revision for this site. Returns the recorded revision, or
   * the existing one when the same key already produced the same document.
   * Caller must already hold a transaction.
   */
  function append({ siteProjectId, document, idempotencyKey, actorUserId = null }) {
    const workspaceId = requireWorkspaceId();
    const idempotency = key(idempotencyKey);
    const hash = documentHash(document);

    // Same key, same document -> converge on what is already recorded.
    // Same key, different document -> a deterministic conflict, never a
    // silent overwrite and never a second revision.
    const existing = byKey(siteProjectId, workspaceId, idempotency);
    if (existing) {
      if (existing.document_hash === hash) return { revision: map(existing), created: false };
      throw new SiteRevisionError(
        "This idempotency key was already used for a different document.",
        "SITE_REVISION_IDEMPOTENCY_CONFLICT",
        409
      );
    }

    const parent = latest(siteProjectId, workspaceId);
    const at = clock();
    const id = crypto.randomUUID();
    // MAX(revision)+1 is computed inside the caller's transaction, and the
    // UNIQUE(workspace, site, revision) constraint remains the final guard.
    db.prepare(`
      INSERT INTO site_document_revisions(id,workspace_id,site_project_id,revision,parent_revision_id,document_json,document_hash,actor_user_id,idempotency_key,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, workspaceId, siteProjectId, (parent?.revision || 0) + 1, parent?.id || null,
      JSON.stringify(document ?? {}), hash, actorUserId || null, idempotency, at
    );

    return { revision: map(db.prepare("SELECT * FROM site_document_revisions WHERE id=?").get(id)), created: true };
  }

  return Object.freeze({
    append,
    canonicalDocumentString,
    documentHash,
    current(siteProjectId) { return map(latest(siteProjectId, requireWorkspaceId())); },
    list(siteProjectId) {
      return db.prepare(
        "SELECT * FROM site_document_revisions WHERE workspace_id=? AND site_project_id=? ORDER BY revision"
      ).all(requireWorkspaceId(), siteProjectId).map(map);
    },
    get(siteProjectId, revision) {
      return map(db.prepare(
        "SELECT * FROM site_document_revisions WHERE workspace_id=? AND site_project_id=? AND revision=?"
      ).get(requireWorkspaceId(), siteProjectId, Number(revision)));
    },
    getById(revisionId) {
      return map(db.prepare(
        "SELECT * FROM site_document_revisions WHERE workspace_id=? AND id=?"
      ).get(requireWorkspaceId(), revisionId));
    },
  });
}
