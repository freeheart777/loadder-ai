import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { runWithWorkspace } from "../tenant-context.mjs";
import { createBusinessBuilderRepository } from "../repositories/business-builder-repository.mjs";
import { LoadderAppUserAuth } from "./app-user-auth.mjs";
import { LoadderSqliteDataAdapter } from "./sqlite-data-adapter.mjs";
import { LoadderDataRuntime } from "./data-adapter.mjs";
import { appFieldAccess, assertAppPayloadFields, filterDefinitionForRole, filterUiForRole, redactAppRecord, redactAppRecords } from "./app-field-access.mjs";

const tokenFrom = (req) => String(req.get("X-Loadder-App-Token") || "").trim();
const limited = (limit) => rateLimit({
  windowMs: 60_000,
  limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || "unknown")}:${String(req.params.projectId || "unknown").slice(0, 128)}`,
  handler: (_req, res) => res.status(429).json({ success: false, code: "PUBLIC_APP_RATE_LIMITED" }),
});

export function createPublicBusinessAppRouter({ db }) {
  const router = express.Router();
  const repo = createBusinessBuilderRepository(db);
  const auth = new LoadderAppUserAuth(db);
  const adapter = new LoadderSqliteDataAdapter(db);
  const runtime = new LoadderDataRuntime({ adapter });
  const readLimit = limited(120);
  const writeLimit = limited(30);

  function locate(projectId) {
    return db.prepare("SELECT id,workspace_id AS workspaceId,name,locale,active_version_id AS activeVersionId,status FROM business_builder_projects WHERE id=? AND status='ready'").get(projectId) || null;
  }
  async function scoped(projectId, fn) {
    const project = locate(projectId);
    if (!project) return { status: 404, body: { success: false, code: "PUBLIC_APP_NOT_FOUND" } };
    return runWithWorkspace(project.workspaceId, () => fn(project));
  }
  function principal(req, projectId) {
    const token = tokenFrom(req);
    return token ? auth.resolve(token, projectId) : null;
  }
  function role(req, projectId, definition) {
    return principal(req, projectId)?.role || definition.accessPolicy?.defaultRole || "public";
  }
  function access(req, projectId, definition, resource, action) {
    return appFieldAccess({ definition, role: role(req, projectId, definition), resource, action });
  }

  router.post("/public/apps/:projectId/invite/exchange", writeLimit, express.json({ limit: "32kb" }), async (req, res) => {
    const out = await scoped(req.params.projectId, () => {
      const session = auth.consumeInvite(req.params.projectId, req.body?.token);
      return session
        ? { status: 201, body: { success: true, session } }
        : { status: 401, body: { success: false, code: "APP_INVITE_INVALID" } };
    });
    return res.status(out.status).json(out.body);
  });

  router.get("/public/apps/:projectId/bootstrap", readLimit, async (req, res) => {
    const out = await scoped(req.params.projectId, (project) => {
      const version = repo.getActiveVersion(project.id);
      if (!version) return { status: 404, body: { success: false, code: "ACTIVE_VERSION_NOT_FOUND" } };
      const appPrincipal = principal(req, project.id);
      const effectiveRole = appPrincipal?.role || version.definition.accessPolicy?.defaultRole || "public";
      if (!appPrincipal && effectiveRole !== "public") return { status: 401, body: { success: false, code: "APP_SESSION_REQUIRED" } };
      const filtered = filterDefinitionForRole(version.definition, effectiveRole);
      const definition = {
        id: filtered.id,
        name: filtered.name,
        vertical: filtered.vertical,
        locale: filtered.locale,
        entities: (filtered.entities || []).map((entity) => ({ id: entity.id, name: entity.name, fields: entity.fields || [] })),
        workflows: (filtered.workflows || []).map((workflow) => ({ id: workflow.id, name: workflow.name })),
      };
      const safeUi = filterUiForRole(version.ui, version.definition, effectiveRole);
      return { status: 200, body: { success: true, project: { id: project.id, name: project.name, locale: project.locale }, definition, ui: safeUi, principal: appPrincipal } };
    });
    return res.status(out.status).json(out.body);
  });

  async function data(req, res, action) {
    const out = await scoped(req.params.projectId, async (project) => {
      const version = repo.getActiveVersion(project.id);
      if (!version) return { status: 404, body: { success: false, code: "ACTIVE_VERSION_NOT_FOUND" } };
      const accessAction = action === "list" || action === "get" ? "read" : action;
      const operationAccess = access(req, project.id, version.definition, req.params.entityId, accessAction);
      if (!operationAccess.allowed) return { status: 403, body: { success: false, code: "APP_ACCESS_FORBIDDEN" } };
      try {
        if (action === "create" || action === "update") assertAppPayloadFields(req.body || {}, operationAccess);
        const result = await runtime.execute({
          definition: version.definition,
          action,
          entityId: req.params.entityId,
          recordId: req.params.recordId || null,
          payload: req.body || {},
          query: req.query || {},
        });
        if (action === "list") {
          return { status: 200, body: { success: true, records: redactAppRecords(result, operationAccess), total: await adapter.count({ appId: version.definition.id, entityId: req.params.entityId, query: req.query || {} }) } };
        }
        if (action === "delete") return { status: 200, body: { success: true, result } };
        const readAccess = access(req, project.id, version.definition, req.params.entityId, "read");
        const safe = readAccess.allowed ? redactAppRecord(result, readAccess) : { id: result?.id };
        return { status: action === "create" ? 201 : 200, body: { success: true, result: safe, record: safe } };
      } catch (error) {
        return { status: 400, body: { success: false, code: error?.code || "PUBLIC_RUNTIME_FAILED", message: error?.message, fields: error?.fields || undefined } };
      }
    });
    return res.status(out.status).json(out.body);
  }

  router.get("/public/apps/:projectId/data/:entityId", readLimit, (req, res) => data(req, res, "list"));
  router.get("/public/apps/:projectId/data/:entityId/:recordId", readLimit, (req, res) => data(req, res, "get"));
  router.post("/public/apps/:projectId/data/:entityId", writeLimit, express.json({ limit: "256kb" }), (req, res) => data(req, res, "create"));
  router.patch("/public/apps/:projectId/data/:entityId/:recordId", writeLimit, express.json({ limit: "256kb" }), (req, res) => data(req, res, "update"));
  router.delete("/public/apps/:projectId/data/:entityId/:recordId", writeLimit, (req, res) => data(req, res, "delete"));
  return router;
}
