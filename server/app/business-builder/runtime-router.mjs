import express from "express";
import { LoadderDataRuntime } from "./data-adapter.mjs";
import { LoadderSqliteDataAdapter } from "./sqlite-data-adapter.mjs";
import { LoadderWorkflowRuntime } from "./workflow-runtime.mjs";
import { LoadderRuntimeCopilot } from "./runtime-copilot.mjs";
import { buildVerticalIntelligence } from "./vertical-intelligence.mjs";
import { recommendLoadderActions, executeOwnedActionDraft } from "./action-recommender.mjs";
import { LoadderActionLedger } from "./action-ledger.mjs";
import { evaluatePublishReadiness } from "./publish-readiness.mjs";
import { canDecideMembership, normalizeDecision, decideActionState } from "./approval-policy.mjs";
import { createBusinessBuilderRateLimiter } from "./business-builder-rate-limit.mjs";
import { LoadderAppUserAuth } from "./app-user-auth.mjs";
import { createRealtimeAwareAdapter, loadderRealtimeHub } from "./realtime-hub.mjs";
import { appFieldAccess, assertAppPayloadFields, filterDefinitionForRole, redactAppRecord, redactAppRecords } from "./app-field-access.mjs";
import { requireWorkspaceId } from "../tenant-context.mjs";

export function createBusinessAppRuntimeRouter({ db, projects }) {
  const router = express.Router();
  const writeLimit = createBusinessBuilderRateLimiter("write");
  const operatorLimit = createBusinessBuilderRateLimiter("operator");
  const baseAdapter = new LoadderSqliteDataAdapter(db);
  const adapter = createRealtimeAwareAdapter(baseAdapter);
  const dataRuntime = new LoadderDataRuntime({ adapter });
  const workflowRuntime = new LoadderWorkflowRuntime();
  const copilot = new LoadderRuntimeCopilot({ dataAdapter: adapter });
  const ledger = new LoadderActionLedger(db);
  const appAuth = new LoadderAppUserAuth(db);

  function activeVersion(id) {
    const project = projects.getProject(id);
    return project?.activeVersionId ? project.versions.find((version) => version.id === project.activeVersionId) || null : null;
  }
  function membership(userId) {
    if (!userId) return null;
    return db.prepare("SELECT role,status FROM workspace_memberships WHERE workspace_id=? AND user_id=?").get(requireWorkspaceId(), userId) || null;
  }
  function canDecide(req) { return canDecideMembership(membership(req.user?.id)); }
  function principal(req, projectId) {
    if (req.appPrincipal) return req.appPrincipal;
    const token = String(req.get("X-Loadder-App-Token") || "").trim();
    req.appPrincipal = token ? appAuth.resolve(token, projectId) : null;
    return req.appPrincipal;
  }
  function appRole(req, projectId) { return principal(req, projectId)?.role || "public"; }
  function fieldAccess(req, definition, projectId, resource, action) {
    return appFieldAccess({ definition, role: appRole(req, projectId), resource, action });
  }
  function forbidden(res, code = "APP_ACCESS_FORBIDDEN", extra = {}) {
    return res.status(403).json({ success: false, code, ...extra });
  }

  async function snapshot(req, definition, projectId) {
    const filtered = filterDefinitionForRole(definition, appRole(req, projectId));
    const output = {};
    for (const entity of filtered.entities || []) {
      const access = fieldAccess(req, definition, projectId, entity.id, "read");
      const records = await adapter.list({ appId: definition.id, entityId: entity.id, query: { limit: 100 } });
      output[entity.id] = redactAppRecords(records, access);
    }
    return { definition: filtered, records: output };
  }
  async function intelligence(req, version) {
    const scoped = await snapshot(req, version.definition, req.params.id);
    return buildVerticalIntelligence({ definition: scoped.definition, snapshot: scoped.records });
  }

  async function execute(req, res, action) {
    try {
      const version = activeVersion(req.params.id);
      if (!version) return res.status(404).json({ success: false, code: "ACTIVE_VERSION_NOT_FOUND" });
      const accessAction = action === "list" || action === "get" ? "read" : action;
      const access = fieldAccess(req, version.definition, req.params.id, req.params.entityId, accessAction);
      if (!access.allowed) return forbidden(res);
      if (action === "create" || action === "update") assertAppPayloadFields(req.body || {}, access);

      const result = await dataRuntime.execute({
        definition: version.definition,
        action,
        entityId: req.params.entityId,
        recordId: req.params.recordId || null,
        payload: req.body || {},
        query: req.query || {},
      });

      const readAccess = fieldAccess(req, version.definition, req.params.id, req.params.entityId, "read");
      if (action === "list") {
        const records = redactAppRecords(result, readAccess);
        return res.json({ success: true, records, total: await adapter.count({ appId: version.definition.id, entityId: req.params.entityId, query: req.query || {} }), result: records, principal: principal(req, req.params.id) });
      }
      if (action === "delete") return res.json({ success: true, result });
      const record = readAccess.allowed ? redactAppRecord(result, readAccess) : redactAppRecord(result, { fields: new Set(), systemFields: new Set(["id", "createdAt", "updatedAt"]) });
      if (action === "create") return res.status(201).json({ success: true, record, result: record });
      return res.json({ success: true, record, result: record });
    } catch (error) {
      const status = error?.code === "APP_FIELD_ACCESS_FORBIDDEN" ? 403 : 400;
      return res.status(status).json({ success: false, code: error?.code || "RUNTIME_DATA_FAILED", message: error?.message, fields: error?.fields || undefined });
    }
  }

  router.get("/business-builder/projects/:id/app-session", (req, res) => res.json({ success: true, principal: principal(req, req.params.id) }));
  router.get("/business-builder/projects/:id/data/:entityId", (req, res) => execute(req, res, "list"));
  router.get("/business-builder/projects/:id/data/:entityId/:recordId", (req, res) => execute(req, res, "get"));
  router.post("/business-builder/projects/:id/data/:entityId", writeLimit, (req, res) => execute(req, res, "create"));
  router.patch("/business-builder/projects/:id/data/:entityId/:recordId", writeLimit, (req, res) => execute(req, res, "update"));
  router.delete("/business-builder/projects/:id/data/:entityId/:recordId", writeLimit, (req, res) => execute(req, res, "delete"));

  router.get("/business-builder/projects/:id/events/:entityId", (req, res) => {
    const version = activeVersion(req.params.id);
    if (!version) return res.status(404).json({ success: false, code: "ACTIVE_VERSION_NOT_FOUND" });
    const access = fieldAccess(req, version.definition, req.params.id, req.params.entityId, "read");
    if (!access.allowed) return forbidden(res);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ appId: version.definition.id, entityId: req.params.entityId })}\n\n`);
    const unsubscribe = loadderRealtimeHub.subscribe({ appId: version.definition.id, entityId: req.params.entityId }, (event) => {
      const safeEvent = { ...event, payload: redactAppRecord(event.payload, access) };
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(safeEvent)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(`: heartbeat ${Date.now()}\n\n`), 25000);
    req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
  });

  router.get("/business-builder/projects/:id/intelligence", async (req, res) => {
    try {
      const version = activeVersion(req.params.id);
      if (!version) return res.status(404).json({ success: false, code: "ACTIVE_VERSION_NOT_FOUND" });
      const result = await intelligence(req, version);
      return res.json({ success: true, intelligence: result, actions: recommendLoadderActions({ intelligence: result }) });
    } catch (error) {
      return res.status(400).json({ success: false, code: "INTELLIGENCE_FAILED", message: error?.message });
    }
  });

  router.post("/business-builder/projects/:id/actions/:actionId/draft", operatorLimit, async (req, res) => {
    try {
      const version = activeVersion(req.params.id);
      if (!version) return res.status(404).json({ success: false, code: "ACTIVE_VERSION_NOT_FOUND" });
      const intel = await intelligence(req, version);
      const action = recommendLoadderActions({ intelligence: intel }).find((item) => item.id === req.params.actionId);
      if (!action) return res.status(404).json({ success: false, code: "ACTION_NOT_FOUND" });
      const access = fieldAccess(req, version.definition, req.params.id, action.target.entityId, "read");
      if (!access.allowed) return forbidden(res);
      const rawRecord = await adapter.get({ appId: version.definition.id, entityId: action.target.entityId, recordId: action.target.recordId });
      const record = redactAppRecord(rawRecord, access);
      const draft = executeOwnedActionDraft({ action, record });
      const entry = ledger.create({ projectId: req.params.id, versionId: version.id, actionKey: action.id, actionType: action.executor, payload: { action, draft }, idempotencyKey: String(req.get("Idempotency-Key") || `${req.params.id}:${version.id}:${action.id}`), actorId: req.user?.id || principal(req, req.params.id)?.id || null, status: "drafted" });
      return res.status(201).json({ success: true, draft, action, ledger: entry });
    } catch (error) {
      return res.status(400).json({ success: false, code: error?.code || "ACTION_DRAFT_FAILED", message: error?.message });
    }
  });

  router.get("/business-builder/projects/:id/actions", (req, res) => {
    try { return res.json({ success: true, actions: ledger.list({ projectId: req.params.id, status: req.query.status, limit: req.query.limit }) }); }
    catch (error) { return res.status(400).json({ success: false, code: error?.code || "ACTION_HISTORY_FAILED", message: error?.message }); }
  });
  router.get("/business-builder/projects/:id/actions/:ledgerId/history", (req, res) => {
    try {
      const action = ledger.get(req.params.ledgerId);
      if (!action || action.projectId !== req.params.id) return res.status(404).json({ success: false, code: "ACTION_NOT_FOUND" });
      return res.json({ success: true, action, history: ledger.history(action.id) });
    } catch (error) { return res.status(400).json({ success: false, code: error?.code || "ACTION_HISTORY_FAILED", message: error?.message }); }
  });
  router.get("/business-builder/projects/:id/approval-center", (req, res) => {
    try {
      const member = membership(req.user?.id);
      const actions = ledger.list({ projectId: req.params.id, limit: 200 });
      return res.json({ success: true, role: member?.role || "member", canDecide: canDecideMembership(member), pending: actions.filter((action) => action.status === "drafted"), recent: actions.slice(0, 50) });
    } catch (error) { return res.status(400).json({ success: false, code: "APPROVAL_CENTER_FAILED", message: error?.message }); }
  });
  router.post("/business-builder/projects/:id/actions/:ledgerId/decision", operatorLimit, (req, res) => {
    try {
      if (!canDecide(req)) return res.status(403).json({ success: false, code: "APPROVAL_FORBIDDEN", message: "Only workspace owners and admins can approve or reject actions." });
      const action = ledger.get(req.params.ledgerId);
      if (action && action.projectId !== req.params.id) return res.status(404).json({ success: false, code: "ACTION_NOT_FOUND" });
      const decision = normalizeDecision(req.body?.decision);
      const state = decideActionState(action, decision);
      if (!state.ok) return res.status(state.status).json({ success: false, code: state.code });
      if (state.idempotent) return res.json({ success: true, idempotent: true, action, history: ledger.history(action.id) });
      const next = ledger.transition(action.id, state.nextStatus, { actorId: req.user?.id || null, result: { decision: state.nextStatus, note: String(req.body?.note || "").slice(0, 1000) } });
      return res.json({ success: true, idempotent: false, action: next, history: ledger.history(next.id) });
    } catch (error) { return res.status(400).json({ success: false, code: error?.code || "ACTION_DECISION_FAILED", message: error?.message }); }
  });

  router.post("/business-builder/projects/:id/workflows/:workflowId/run", operatorLimit, async (req, res) => {
    try {
      const version = activeVersion(req.params.id);
      if (!version) return res.status(404).json({ success: false, code: "ACTIVE_VERSION_NOT_FOUND" });
      const workflowAccess = appFieldAccess({ definition: version.definition, role: appRole(req, req.params.id), resource: `workflow:${req.params.workflowId}`, action: "execute" });
      if (version.definition.accessPolicy && !workflowAccess.allowed) return forbidden(res);
      const appPrincipal = principal(req, req.params.id);
      return res.status(201).json({ success: true, result: await workflowRuntime.execute({ definition: version.definition, workflowId: req.params.workflowId, input: req.body || {}, context: { projectId: req.params.id, userId: req.user?.id || appPrincipal?.id || null, appRole: appPrincipal?.role || "public" } }) });
    } catch (error) { return res.status(400).json({ success: false, code: error?.code || "WORKFLOW_RUN_FAILED", message: error?.message }); }
  });

  router.post("/business-builder/projects/:id/copilot", operatorLimit, async (req, res) => {
    try {
      const version = activeVersion(req.params.id);
      if (!version) return res.status(404).json({ success: false, code: "ACTIVE_VERSION_NOT_FOUND" });
      const filteredDefinition = filterDefinitionForRole(version.definition, appRole(req, req.params.id));
      return res.json({ success: true, result: await copilot.summarize({ definition: filteredDefinition, projectId: req.params.id, message: req.body?.message || "", context: { userId: req.user?.id || principal(req, req.params.id)?.id || null, appRole: appRole(req, req.params.id) } }) });
    } catch (error) { return res.status(400).json({ success: false, code: error?.code || "COPILOT_FAILED", message: error?.message }); }
  });

  router.get("/business-builder/projects/:id/deployment-readiness", (req, res) => {
    const version = activeVersion(req.params.id);
    if (!version) return res.status(404).json({ success: false, code: "ACTIVE_VERSION_NOT_FOUND" });
    const readiness = evaluatePublishReadiness({ version, productionApproved: projects.canDeployProduction(req.params.id), providerConfigured: false });
    return res.json({ success: true, readiness: { ...readiness, canaryPercent: 5, healthCheckRequired: true, rollbackSupported: true } });
  });
  return router;
}
