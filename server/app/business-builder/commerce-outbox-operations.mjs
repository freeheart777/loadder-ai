import express from "express";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { LO_ADDRESSER_COMMERCE_CONSUMERS } from "./commerce-event-processor.mjs";

const now = () => new Date().toISOString();
const clampLimit = (value, fallback = 100) => Math.min(Math.max(Number(value) || fallback, 1), 200);

function operationalState(row) {
  if (row.status === "delivered") return "delivered";
  if (row.last_error) return "retrying";
  return "pending";
}

function parsePayload(value) {
  try { return JSON.parse(value || "{}"); }
  catch { return null; }
}

export class CommerceOutboxOperations {
  constructor(db) { this.db = db; }

  get(id) {
    return this.db.prepare("SELECT * FROM business_builder_commerce_outbox WHERE id=? AND workspace_id=?").get(id, requireWorkspaceId()) || null;
  }

  list({ state = "all", projectId = null, limit = 100 } = {}) {
    const workspaceId = requireWorkspaceId();
    const normalizedState = ["all", "pending", "retrying", "delivered"].includes(state) ? state : "all";
    const where = ["workspace_id=?"];
    const params = [workspaceId];
    if (projectId) { where.push("business_builder_project_id=?"); params.push(projectId); }
    if (normalizedState === "pending") where.push("status='pending' AND last_error IS NULL");
    if (normalizedState === "retrying") where.push("status='pending' AND last_error IS NOT NULL");
    if (normalizedState === "delivered") where.push("status='delivered'");
    params.push(clampLimit(limit));
    return this.db.prepare(`SELECT * FROM business_builder_commerce_outbox WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).all(...params).map((row) => ({
      ...row,
      operational_state: operationalState(row),
      payload: parsePayload(row.payload_json),
    }));
  }

  summary() {
    const workspaceId = requireWorkspaceId();
    const row = this.db.prepare(`SELECT
      COUNT(*) total,
      SUM(CASE WHEN status='pending' AND last_error IS NULL THEN 1 ELSE 0 END) pending,
      SUM(CASE WHEN status='pending' AND last_error IS NOT NULL THEN 1 ELSE 0 END) retrying,
      SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) delivered,
      MAX(CASE WHEN status='pending' AND last_error IS NOT NULL THEN attempts ELSE 0 END) max_attempts
      FROM business_builder_commerce_outbox WHERE workspace_id=?`).get(workspaceId) || {};
    return {
      total: Number(row.total || 0),
      pending: Number(row.pending || 0),
      retrying: Number(row.retrying || 0),
      delivered: Number(row.delivered || 0),
      maxAttempts: Number(row.max_attempts || 0),
    };
  }

  reconcile(id) {
    const event = this.get(id);
    if (!event) return null;
    const receipts = this.db.prepare("SELECT consumer,status,details_json,processed_at FROM business_builder_commerce_event_receipts WHERE workspace_id=? AND project_id=? AND event_id=? ORDER BY processed_at ASC").all(requireWorkspaceId(), event.business_builder_project_id, event.event_id);
    const byConsumer = new Map(receipts.map((receipt) => [receipt.consumer, receipt]));
    const consumers = LO_ADDRESSER_COMMERCE_CONSUMERS.map((consumer) => {
      const receipt = byConsumer.get(consumer) || null;
      return {
        consumer,
        status: receipt ? "processed" : "missing",
        processedAt: receipt?.processed_at || null,
      };
    });
    return {
      event: { ...event, operational_state: operationalState(event), payload: parsePayload(event.payload_json) },
      consumers,
      processed: consumers.filter((consumer) => consumer.status === "processed").length,
      missing: consumers.filter((consumer) => consumer.status === "missing").map((consumer) => consumer.consumer),
      complete: consumers.every((consumer) => consumer.status === "processed"),
    };
  }

  retry(id) {
    const event = this.get(id);
    if (!event) return { ok: false, code: "COMMERCE_OUTBOX_EVENT_NOT_FOUND" };
    if (event.status === "delivered") return { ok: false, code: "COMMERCE_OUTBOX_ALREADY_DELIVERED", event };
    this.db.prepare("UPDATE business_builder_commerce_outbox SET available_at=? WHERE id=? AND workspace_id=? AND status='pending'").run(now(), id, requireWorkspaceId());
    return { ok: true, event: this.get(id) };
  }
}

export function createCommerceOutboxOperationsRouter({ db, isAdmin }) {
  const router = express.Router();
  const operations = new CommerceOutboxOperations(db);
  const requireAdmin = (req, res) => isAdmin(req) ? true : (res.status(403).json({ success: false, code: "ADMIN_FORBIDDEN" }), false);

  router.get("/business-builder/commerce/outbox", (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      return res.json({ success: true, summary: operations.summary(), events: operations.list({ state: req.query.state, projectId: req.query.projectId || null, limit: req.query.limit }) });
    } catch (error) {
      return res.status(400).json({ success: false, code: "COMMERCE_OUTBOX_QUERY_FAILED", message: error?.message });
    }
  });

  router.get("/business-builder/commerce/outbox/:id/reconciliation", (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const reconciliation = operations.reconcile(req.params.id);
      return reconciliation ? res.json({ success: true, reconciliation }) : res.status(404).json({ success: false, code: "COMMERCE_OUTBOX_EVENT_NOT_FOUND" });
    } catch (error) {
      return res.status(400).json({ success: false, code: "COMMERCE_OUTBOX_RECONCILIATION_FAILED", message: error?.message });
    }
  });

  router.post("/business-builder/commerce/outbox/:id/retry", (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const result = operations.retry(req.params.id);
      if (!result.ok) return res.status(result.code === "COMMERCE_OUTBOX_EVENT_NOT_FOUND" ? 404 : 409).json({ success: false, ...result });
      return res.json({ success: true, ...result });
    } catch (error) {
      return res.status(400).json({ success: false, code: "COMMERCE_OUTBOX_RETRY_FAILED", message: error?.message });
    }
  });

  return router;
}
