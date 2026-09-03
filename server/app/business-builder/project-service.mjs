import { loadderBusinessBuilderService } from "./business-builder-service.mjs";

export function createBusinessBuilderProjectService({ repository, builder = loadderBusinessBuilderService, previewAdapter }) {
  if (!repository) throw new TypeError("repository is required");

  function listProjects() { return repository.listProjects(); }
  function getProject(id) {
    const project = repository.getProject(id);
    if (!project) return null;
    return { ...project, versions: repository.listVersions(id) };
  }
  function createProject(input, actorId = null) {
    const plan = builder.preview(input);
    const project = repository.createProject({ name: plan.definition.name, intent: input.intent, locale: input.locale || "fa-IR" });
    const version = repository.createVersion(project.id, { definition: plan.definition, ui: plan.ui, bundle: plan.sourceBundle, buildPlan: plan, createdBy: actorId });
    return { project: repository.getProject(project.id), version };
  }
  function saveProject(id, input, actorId = null) {
    const current = repository.getProject(id); if (!current) return null;
    const nextInput = { intent: input.intent ?? current.intent, name: input.name ?? current.name, locale: input.locale ?? current.locale };
    const plan = builder.preview(nextInput);
    repository.updateProject(id, nextInput);
    const version = repository.createVersion(id, { definition: plan.definition, ui: plan.ui, bundle: plan.sourceBundle, buildPlan: plan, createdBy: actorId });
    return { project: repository.getProject(id), version };
  }
  function restoreVersion(projectId, versionId, actorId = null) {
    const version = repository.getVersion(versionId); if (!version || version.projectId !== projectId) return null;
    const project = repository.getProject(projectId); if (!project) return null;
    const restored = repository.createVersion(projectId, { ...version, createdBy: actorId });
    return { project: repository.getProject(projectId), version: restored, restoredFrom: versionId };
  }
  async function startPreview(projectId) {
    const version = repository.getActiveVersion(projectId); if (!version) return null;
    const approval = repository.latestApproval(projectId, version.id, "preview");
    if (approval?.decision === "rejected") { const error = new Error("Preview rejected by approval gate."); error.code = "PREVIEW_REJECTED"; throw error; }
    const execution = previewAdapter ? await previewAdapter.start({ projectId, version }) : { adapter: "loadder-contract-preview", url: `/dashboard/business-builder?project=${projectId}&version=${version.id}` };
    const session = repository.createPreviewSession({ projectId, versionId: version.id, runtimeAdapter: execution.adapter, previewUrl: execution.url });
    return { session, version };
  }
  function decide({ projectId, versionId, stage, decision, actorId = null, note = null }) {
    return repository.recordApproval({ projectId, versionId, stage, decision, decidedBy: actorId, note });
  }
  function canDeployProduction(projectId) {
    const version = repository.getActiveVersion(projectId); if (!version) return false;
    return repository.latestApproval(projectId, version.id, "production")?.decision === "approved";
  }

  return { listProjects, getProject, createProject, saveProject, restoreVersion, startPreview, decide, canDeployProduction };
}
