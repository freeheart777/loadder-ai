import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

const parse = (value) => JSON.parse(value);
const now = () => new Date().toISOString();

function mapProject(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, intent: row.intent, locale: row.locale, status: row.status, activeVersionId: row.active_version_id, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapVersion(row) {
  if (!row) return null;
  return { id: row.id, projectId: row.project_id, versionNumber: row.version_number, definition: parse(row.definition_json), ui: parse(row.ui_json), bundle: parse(row.bundle_json), buildPlan: parse(row.build_plan_json), createdBy: row.created_by, createdAt: row.created_at };
}
function mapPreview(row) {
  if (!row) return null;
  return { id: row.id, projectId: row.project_id, versionId: row.version_id, status: row.status, previewUrl: row.preview_url, runtimeAdapter: row.runtime_adapter, expiresAt: row.expires_at, createdAt: row.created_at };
}

export function createBusinessBuilderRepository(db) {
  const workspaceId = () => requireWorkspaceId();

  function listProjects() {
    return db.prepare("SELECT * FROM business_builder_projects WHERE workspace_id = ? ORDER BY updated_at DESC").all(workspaceId()).map(mapProject);
  }
  function getProject(id) {
    return mapProject(db.prepare("SELECT * FROM business_builder_projects WHERE id = ? AND workspace_id = ?").get(id, workspaceId()));
  }
  function createProject({ name, intent, locale = "fa-IR" }) {
    const id = crypto.randomUUID(), timestamp = now();
    db.prepare(`INSERT INTO business_builder_projects (id, workspace_id, name, intent, locale, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`)
      .run(id, workspaceId(), name, intent, locale, timestamp, timestamp);
    return getProject(id);
  }
  function updateProject(id, values = {}) {
    const project = getProject(id); if (!project) return null;
    const next = { name: values.name ?? project.name, intent: values.intent ?? project.intent, locale: values.locale ?? project.locale, status: values.status ?? project.status };
    db.prepare("UPDATE business_builder_projects SET name=?, intent=?, locale=?, status=?, updated_at=? WHERE id=? AND workspace_id=?")
      .run(next.name, next.intent, next.locale, next.status, now(), id, workspaceId());
    return getProject(id);
  }
  function createVersion(projectId, { definition, ui, bundle, buildPlan, createdBy = null }) {
    if (!getProject(projectId)) return null;
    const nextNumber = db.prepare("SELECT COALESCE(MAX(version_number),0)+1 AS n FROM business_builder_versions WHERE project_id=? AND workspace_id=?").get(projectId, workspaceId()).n;
    const id = crypto.randomUUID(), timestamp = now();
    db.prepare(`INSERT INTO business_builder_versions (id, project_id, workspace_id, version_number, definition_json, ui_json, bundle_json, build_plan_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, workspaceId(), nextNumber, JSON.stringify(definition), JSON.stringify(ui), JSON.stringify(bundle), JSON.stringify(buildPlan), createdBy, timestamp);
    db.prepare("UPDATE business_builder_projects SET active_version_id=?, updated_at=? WHERE id=? AND workspace_id=?").run(id, timestamp, projectId, workspaceId());
    return getVersion(id);
  }
  function getVersion(id) { return mapVersion(db.prepare("SELECT * FROM business_builder_versions WHERE id=? AND workspace_id=?").get(id, workspaceId())); }
  function listVersions(projectId) { return db.prepare("SELECT * FROM business_builder_versions WHERE project_id=? AND workspace_id=? ORDER BY version_number DESC").all(projectId, workspaceId()).map(mapVersion); }
  function getActiveVersion(projectId) {
    const row = db.prepare(`SELECT v.* FROM business_builder_versions v JOIN business_builder_projects p ON p.active_version_id=v.id WHERE p.id=? AND p.workspace_id=?`).get(projectId, workspaceId());
    return mapVersion(row);
  }
  function createPreviewSession({ projectId, versionId, runtimeAdapter, previewUrl, ttlMinutes = 30 }) {
    const id = crypto.randomUUID(), createdAt = now(), expiresAt = new Date(Date.now() + ttlMinutes * 60000).toISOString();
    db.prepare(`INSERT INTO business_builder_preview_sessions (id, project_id, version_id, workspace_id, status, preview_url, runtime_adapter, expires_at, created_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`)
      .run(id, projectId, versionId, workspaceId(), previewUrl, runtimeAdapter, expiresAt, createdAt);
    return getPreviewSession(id);
  }
  function getPreviewSession(id) {
    const row = db.prepare("SELECT * FROM business_builder_preview_sessions WHERE id=? AND workspace_id=?").get(id, workspaceId());
    const session = mapPreview(row);
    if (session && Date.parse(session.expiresAt) <= Date.now() && session.status === "active") {
      db.prepare("UPDATE business_builder_preview_sessions SET status='expired' WHERE id=? AND workspace_id=?").run(id, workspaceId());
      return { ...session, status: "expired" };
    }
    return session;
  }
  function latestPreviewSession(projectId,versionId){
    const row=db.prepare("SELECT * FROM business_builder_preview_sessions WHERE project_id=? AND version_id=? AND workspace_id=? ORDER BY created_at DESC LIMIT 1").get(projectId,versionId,workspaceId());
    const session=mapPreview(row);if(!session)return null;
    if(Date.parse(session.expiresAt)<=Date.now()&&session.status==="active"){db.prepare("UPDATE business_builder_preview_sessions SET status='expired' WHERE id=? AND workspace_id=?").run(session.id,workspaceId());return{...session,status:"expired"};}
    return session;
  }
  function recordApproval({ projectId, versionId, stage, decision, decidedBy = null, note = null }) {
    const id = crypto.randomUUID(), timestamp = now();
    db.prepare(`INSERT INTO business_builder_approvals (id, project_id, version_id, workspace_id, stage, decision, decided_by, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, versionId, workspaceId(), stage, decision, decidedBy, note, timestamp);
    return { id, projectId, versionId, stage, decision, decidedBy, note, createdAt: timestamp };
  }
  function latestApproval(projectId, versionId, stage) {
    const row = db.prepare("SELECT * FROM business_builder_approvals WHERE project_id=? AND version_id=? AND workspace_id=? AND stage=? ORDER BY created_at DESC LIMIT 1").get(projectId, versionId, workspaceId(), stage);
    return row ? { id: row.id, decision: row.decision, stage: row.stage, note: row.note, createdAt: row.created_at } : null;
  }

  return { listProjects, getProject, createProject, updateProject, createVersion, getVersion, listVersions, getActiveVersion, createPreviewSession, getPreviewSession, latestPreviewSession, recordApproval, latestApproval };
}
