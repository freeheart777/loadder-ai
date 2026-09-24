import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { createSiteDocumentRevisionService } from "../services/site-document-revision-service.mjs";
import { createSiteDocumentPatchService } from "../services/site-document-patch-service.mjs";
import { buildCapabilityManifest } from "../site-platform/publish-manifest.mjs";

const mapProject = (row) => row && ({ id: row.id, workspaceId: row.workspace_id, contextVersionId: row.context_version_id, name: row.name, siteType: row.site_type, slug: row.slug, status: row.status, content: JSON.parse(row.content_json || "{}"), publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at });
const mapAsset = (row) => row && ({ id: row.id, workspaceId: row.workspace_id, siteProjectId: row.site_project_id, kind: row.kind, name: row.name, url: row.url, storageKey: row.storage_key ?? null, altText: row.alt_text, metadata: JSON.parse(row.metadata_json || "{}"), createdAt: row.created_at });
const mapPublishVersion = (row) => row && ({ id: row.id, workspaceId: row.workspace_id, siteProjectId: row.site_project_id, version: row.version, contextVersionId: row.context_version_id, content: JSON.parse(row.content_json || "{}"), manifest: JSON.parse(row.manifest_json || "{}"), publishedAt: row.published_at, createdAt: row.created_at });

export function createSiteProjectRepository(db) {
  const workspace = () => requireWorkspaceId();
  const revisions = createSiteDocumentRevisionService({ db });
  const patches = createSiteDocumentPatchService({ db });
  function list() { return db.prepare("SELECT * FROM site_projects WHERE workspace_id=? ORDER BY updated_at DESC").all(workspace()).map(mapProject); }
  function get(id) { return mapProject(db.prepare("SELECT * FROM site_projects WHERE id=? AND workspace_id=?").get(id, workspace())); }
  function getPublished(id) { const project = get(id); if (!project || project.status !== "PUBLISHED") return null; return { project, version: getLatestPublishVersion(id), assets: listAssets(id) }; }
  function getPublishedPublic(id) { const project = mapProject(db.prepare("SELECT * FROM site_projects WHERE id=? AND status='PUBLISHED'").get(id)); if (!project) return null; const version = mapPublishVersion(db.prepare("SELECT * FROM site_publish_versions WHERE site_project_id=? ORDER BY version DESC LIMIT 1").get(id)); if (!version) return null; const assets = db.prepare("SELECT * FROM site_assets WHERE site_project_id=? ORDER BY created_at DESC").all(id).map(mapAsset); return { project, version, assets }; }
  function getPublishedPublicByDomain(domain) { const row = db.prepare("SELECT site_project_id FROM site_domains WHERE domain=? AND status='ACTIVE'").get(String(domain).trim().toLowerCase()); if (!row) return null; return getPublishedPublic(row.site_project_id); }
  function create({ name, siteType, slug, contextVersionId = null, content = {}, now }) { const id = crypto.randomUUID(); db.prepare("INSERT INTO site_projects(id,workspace_id,context_version_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES(?,?,?,?,?,?, 'DRAFT',?,?,?)").run(id, workspace(), contextVersionId, name, siteType, slug, JSON.stringify(content), now, now); return get(id); }
  function update(id, { name, siteType, slug, contextVersionId, content, status, now }) { const current = get(id); if (!current) return null; db.prepare("UPDATE site_projects SET name=COALESCE(?,name),site_type=COALESCE(?,site_type),slug=COALESCE(?,slug),context_version_id=COALESCE(?,context_version_id),content_json=COALESCE(?,content_json),status=COALESCE(?,status),updated_at=? WHERE id=? AND workspace_id=?").run(name ?? null, siteType ?? null, slug ?? null, contextVersionId ?? null, content === undefined ? null : JSON.stringify(content), status ?? null, now, id, workspace()); return get(id); }
  function publish(id, now) { const current = get(id); if (!current) return null; const ws = workspace(); return db.transaction(() => { const nextVersion = db.prepare("SELECT COALESCE(MAX(version),0)+1 AS version FROM site_publish_versions WHERE site_project_id=? AND workspace_id=?").get(id, ws).version; const versionId = crypto.randomUUID(); const manifest = { projectId: current.id, slug: current.slug, siteType: current.siteType, contextVersionId: current.contextVersionId, publishedAt: now, assetIds: listAssets(id).map((asset) => asset.id), ...buildCapabilityManifest(current, current.content) }; db.prepare("INSERT INTO site_publish_versions(id,workspace_id,site_project_id,version,context_version_id,content_json,manifest_json,published_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(versionId, ws, id, nextVersion, current.contextVersionId, JSON.stringify(current.content), JSON.stringify(manifest), now, now); db.prepare("UPDATE site_projects SET status='PUBLISHED',published_at=COALESCE(published_at,?),updated_at=? WHERE id=? AND workspace_id=?").run(now, now, id, ws); return get(id); })(); }
  // Rolling back a publish version also replaces the CURRENT DRAFT with that
  // historical content, so it is a draft mutation and is recorded as a revision
  // like any other. Publish history itself stays forward-only: a rollback adds a
  // new publish version, it never removes one.
  function rollbackPublishVersion(id, targetVersionId, now) { const ws = workspace(); return db.transaction(() => { const current = get(id); if (!current) return null; const target = mapPublishVersion(db.prepare("SELECT * FROM site_publish_versions WHERE id=? AND site_project_id=? AND workspace_id=?").get(targetVersionId, id, ws)); if (!target) return null; const nextVersion = db.prepare("SELECT COALESCE(MAX(version),0)+1 AS version FROM site_publish_versions WHERE site_project_id=? AND workspace_id=?").get(id, ws).version; const versionId = crypto.randomUUID(); const manifest = { ...target.manifest, projectId: id, contextVersionId: target.contextVersionId, publishedAt: now, rollbackOfVersionId: target.id, ...buildCapabilityManifest(current, target.content) }; db.prepare("INSERT INTO site_publish_versions(id,workspace_id,site_project_id,version,context_version_id,content_json,manifest_json,published_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(versionId, ws, id, nextVersion, target.contextVersionId, JSON.stringify(target.content), JSON.stringify(manifest), now, now); const bootstrapped = ensureBaselineRevision(current); const { revision } = revisions.append({ siteProjectId: id, document: target.content, idempotencyKey: `rollback:${versionId}`, actorUserId: null }); db.prepare("UPDATE site_projects SET context_version_id=?,content_json=?,status='PUBLISHED',published_at=COALESCE(published_at,?),updated_at=? WHERE id=? AND workspace_id=?").run(target.contextVersionId, JSON.stringify(target.content), now, now, id, ws); return { project: get(id), version: getLatestPublishVersion(id), revision, bootstrapped }; })(); }
  // A tracked draft save. This is the single transaction owner for
  // "update the current draft AND record its revision": it reuses the
  // canonical update() above rather than duplicating its SQL, so either both
  // sides land or neither does.
  // A site that predates revision history has no baseline. The first tracked
  // write records the document EXACTLY as it is already stored as revision 1,
  // without rewriting it, so the mutation that follows becomes revision 2 and
  // history is complete from that point on.
  function ensureBaselineRevision(project) {
    if (revisions.current(project.id)) return false;
    revisions.append({
      siteProjectId: project.id,
      document: project.content,
      idempotencyKey: `baseline:${project.id}`,
      actorUserId: null,
    });
    return true;
  }

  const saveDraftWithRevision = db.transaction((id, { content, idempotencyKey, actorUserId = null, expectedRevision = null, now }) => {
    const project = get(id);
    if (!project) return null;
    const bootstrapped = ensureBaselineRevision(project);
    const current = revisions.current(id);

    // Compare-and-set: a save that was composed against an older revision must
    // not silently overwrite newer work.
    if (expectedRevision !== null && expectedRevision !== undefined && Number(expectedRevision) !== current.revision) {
      return { project, revision: current, created: false, applied: false, conflict: true, currentRevision: current.revision, bootstrapped };
    }

    const { revision, created } = revisions.append({ siteProjectId: id, document: content, idempotencyKey, actorUserId });
    // A converged retry must not rewrite the current draft either. It reports
    // the truth about the draft as it stands now.
    if (!created) {
      const superseded = revisions.documentHash(get(id).content) !== revision.documentHash;
      return { project: get(id), revision, created: false, applied: false, conflict: false, superseded, bootstrapped };
    }
    return { project: update(id, { content, now }), revision, created: true, applied: true, conflict: false, superseded: false, bootstrapped };
  });

  // Exact forward restore: the historical revision is replayed as a NEW
  // revision. Nothing is deleted, no pointer moves backward.
  const restoreDocumentRevision = db.transaction((id, { revision: target, idempotencyKey, actorUserId = null, now }) => {
    const project = get(id);
    if (!project) return null;
    const source = revisions.get(id, target);
    if (!source) return null;
    const { revision, created } = revisions.append({ siteProjectId: id, document: source.document, idempotencyKey, actorUserId });
    if (!created) {
      // Idempotency means "this request was already processed" — never "repeat
      // its old side effect against newer state". A replayed key reports the
      // truth about the CURRENT draft: still the restored state, or superseded
      // by later work. Either way nothing is written and no revision is added.
      const superseded = revisions.documentHash(project.content) !== revision.documentHash;
      return superseded
        ? { project, revision, created: false, applied: false, superseded: true, restoredFrom: null }
        : { project, revision, created: false, applied: false, superseded: false, restoredFrom: source.revision };
    }
    return { project: update(id, { content: source.document, now }), revision, created, applied: true, superseded: false, restoredFrom: source.revision };
  });

  // Propose and preview only record the patch and its validation. They are the
  // side-effect-free half of the engine: no content_json, no revision, no
  // publish state changes here.
  const proposePatch = db.transaction((id, { operations, idempotencyKey, actorUserId = null }) => {
    const project = get(id);
    if (!project) return null;
    // A legacy site gets its baseline here, so the revision a patch is composed
    // on is the same one apply will compare against.
    ensureBaselineRevision(project);
    const baseRevision = revisions.current(id).revision;
    return patches.propose({ siteProjectId: id, document: project.content, baseRevision, operations, idempotencyKey, actorUserId });
  });

  function previewPatch(id, patchId) {
    const project = get(id);
    if (!project) return null;
    const patch = patches.get(patchId);
    if (!patch || patch.siteProjectId !== id) return null;
    return patches.preview({ patchId, document: project.content });
  }

  /**
   * Apply a patch. Patch state, the new revision and content_json commit
   * together or not at all.
   */
  const applyPatch = db.transaction((id, { patchId, now }) => {
    const project = get(id);
    if (!project) return null;
    const patch = patches.get(patchId);
    if (!patch || patch.siteProjectId !== id) return null;

    // A patch that already settled returns its stored outcome, truthfully:
    // if later work superseded it, that is reported rather than re-applied.
    if (["APPLIED", "PARTIALLY_APPLIED"].includes(patch.status)) {
      const applied = patch.appliedRevisionId ? revisions.getById(patch.appliedRevisionId) : null;
      const superseded = applied ? revisions.documentHash(project.content) !== applied.documentHash : false;
      return { project, patch, revision: applied, created: false, applied: false, superseded, conflict: false };
    }
    if (patch.status === "REJECTED") return { project, patch, revision: null, created: false, applied: false, rejected: true, conflict: false };

    ensureBaselineRevision(project);
    const current = revisions.current(id);
    // Compare-and-set against the revision the patch was composed on.
    if (patch.baseRevision !== current.revision) {
      patches.markConflicted(patchId, now);
      return { project, patch: patches.get(patchId), revision: null, created: false, applied: false, conflict: true, currentRevision: current.revision };
    }

    // Revalidate against the canonical document at apply time; only the
    // operations still accepted reach the output.
    const evaluation = patches.evaluate(project.content, patch.operations);
    if (evaluation.accepted === 0) {
      patches.markApplied(patchId, { status: "REJECTED", appliedRevisionId: null, validation: evaluation.results, previewHash: evaluation.proposedHash, at: now });
      return { project, patch: patches.get(patchId), revision: null, created: false, applied: false, rejected: true, conflict: false, results: evaluation.results };
    }

    const { revision } = revisions.append({
      siteProjectId: id,
      document: evaluation.proposed,
      idempotencyKey: `patch:${patchId}`,
      actorUserId: patch.actorUserId,
    });
    const next = update(id, { content: evaluation.proposed, now });
    const status = evaluation.accepted === patch.operations.length ? "APPLIED" : "PARTIALLY_APPLIED";
    patches.markApplied(patchId, { status, appliedRevisionId: revision.id, validation: evaluation.results, previewHash: evaluation.proposedHash, at: now });
    return { project: next, patch: patches.get(patchId), revision, created: true, applied: true, conflict: false, superseded: false, results: evaluation.results, status };
  });

  function listDocumentPatches(siteProjectId) { get(siteProjectId); return patches.list(siteProjectId); }
  function getDocumentPatch(siteProjectId, patchId) { get(siteProjectId); const patch = patches.get(patchId); return patch && patch.siteProjectId === siteProjectId ? patch : null; }

  function listDocumentRevisions(siteProjectId) { get(siteProjectId); return revisions.list(siteProjectId); }
  function getDocumentRevision(siteProjectId, revision) { get(siteProjectId); return revisions.get(siteProjectId, revision); }
  function currentDocumentRevision(siteProjectId) { get(siteProjectId); return revisions.current(siteProjectId); }

  function listPublishVersions(siteProjectId) { return db.prepare("SELECT * FROM site_publish_versions WHERE site_project_id=? AND workspace_id=? ORDER BY version DESC").all(siteProjectId, workspace()).map(mapPublishVersion); }
  function getLatestPublishVersion(siteProjectId) { return mapPublishVersion(db.prepare("SELECT * FROM site_publish_versions WHERE site_project_id=? AND workspace_id=? ORDER BY version DESC LIMIT 1").get(siteProjectId, workspace())); }
  function remove(id) { return db.prepare("DELETE FROM site_projects WHERE id=? AND workspace_id=?").run(id, workspace()).changes === 1; }
  function listAssets(siteProjectId) { return db.prepare("SELECT * FROM site_assets WHERE site_project_id=? AND workspace_id=? ORDER BY created_at DESC").all(siteProjectId, workspace()).map(mapAsset); }
  function addAsset(siteProjectId, { kind, name, url, storageKey = null, altText = null, metadata = {}, now }) { if (!get(siteProjectId)) return null; const id = crypto.randomUUID(); db.prepare("INSERT INTO site_assets(id,workspace_id,site_project_id,kind,name,url,storage_key,alt_text,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id, workspace(), siteProjectId, kind, name, url, storageKey, altText, JSON.stringify(metadata), now); return mapAsset(db.prepare("SELECT * FROM site_assets WHERE id=? AND workspace_id=?").get(id, workspace())); }
  function removeAsset(siteProjectId, id) { return db.prepare("DELETE FROM site_assets WHERE id=? AND site_project_id=? AND workspace_id=?").run(id, siteProjectId, workspace()).changes === 1; }
  function createPreviewToken(siteProjectId, tokenHash) { const ws = workspace(); const result = db.prepare("UPDATE site_projects SET preview_token_hash=?,updated_at=updated_at WHERE id=? AND workspace_id=?").run(tokenHash, siteProjectId, ws); return result.changes === 1; }
  function revokePreviewToken(siteProjectId) { const ws = workspace(); return db.prepare("UPDATE site_projects SET preview_token_hash=NULL WHERE id=? AND workspace_id=?").run(siteProjectId, ws).changes === 1; }
  function getPreviewByToken(tokenHash, siteProjectId = null) { const ws = workspace(); const row = siteProjectId ? db.prepare("SELECT * FROM site_projects WHERE id=? AND workspace_id=? AND preview_token_hash=?").get(siteProjectId, ws, tokenHash) : db.prepare("SELECT * FROM site_projects WHERE workspace_id=? AND preview_token_hash=?").get(ws, tokenHash); if (!row) return null; const project = mapProject(row); return { project, assets: db.prepare("SELECT * FROM site_assets WHERE site_project_id=? AND workspace_id=? ORDER BY created_at DESC").all(project.id, project.workspaceId).map(mapAsset) }; }
  return Object.freeze({ list, get, getPublished, getPublishedPublic, getPublishedPublicByDomain, create, update, saveDraftWithRevision: (id, input) => saveDraftWithRevision(id, input), restoreDocumentRevision: (id, input) => restoreDocumentRevision(id, input), proposePatch: (id, input) => proposePatch(id, input), previewPatch, applyPatch: (id, input) => applyPatch(id, input), listDocumentPatches, getDocumentPatch, listDocumentRevisions, getDocumentRevision, currentDocumentRevision, publish, rollbackPublishVersion, listPublishVersions, getLatestPublishVersion, remove, listAssets, addAsset, removeAsset, createPreviewToken, revokePreviewToken, getPreviewByToken });
}
