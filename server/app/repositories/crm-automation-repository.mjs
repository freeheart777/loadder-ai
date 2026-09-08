import crypto from "crypto";
import { db } from "../../db/workspace-database.mjs";
import { requireWorkspaceId } from "../tenant-context.mjs";

let initialized = false;

function ensureSchema() {
  if (initialized) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_automation_outbox (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      deal_id TEXT NOT NULL,
      deal_version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      last_error TEXT,
      UNIQUE(workspace_id, event_type, deal_id, deal_version)
    );
    CREATE INDEX IF NOT EXISTS idx_crm_automation_outbox_pending
      ON crm_automation_outbox(workspace_id, status, created_at);

    CREATE TABLE IF NOT EXISTS crm_automation_actions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      deal_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(workspace_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_crm_automation_actions_workspace
      ON crm_automation_actions(workspace_id, created_at DESC);
  `);
  initialized = true;
}

function nowIso() { return new Date().toISOString(); }

export function enqueueCrmAutomationEvent({ workspaceId, eventType, dealId, dealVersion, payload, createdAt = nowIso() }) {
  ensureSchema();
  const id = crypto.randomUUID();
  const result = db.prepare(`
    INSERT OR IGNORE INTO crm_automation_outbox (
      id, workspace_id, event_type, deal_id, deal_version, payload_json, status, attempts, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)
  `).run(id, workspaceId, eventType, dealId, dealVersion, JSON.stringify(payload || {}), createdAt);
  return result.changes === 1 ? id : null;
}

export function enqueueStuckEvents({ thresholdIso, occurredAt = nowIso() }) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  const deals = db.prepare(`
    SELECT id, title, stage, owner_name, amount_minor, currency, version, updated_at
    FROM crm_deals
    WHERE workspace_id = ?
      AND stage IN ('new','hot','qualified','negotiating')
      AND updated_at <= ?
  `).all(workspaceId, thresholdIso);
  let queued = 0;
  const transaction = db.transaction(() => {
    for (const deal of deals) {
      const id = enqueueCrmAutomationEvent({
        workspaceId,
        eventType: 'deal.stuck',
        dealId: deal.id,
        dealVersion: deal.version,
        createdAt: occurredAt,
        payload: {
          dealId: deal.id,
          title: deal.title,
          stage: deal.stage,
          owner: deal.owner_name,
          amount: deal.amount_minor,
          currency: deal.currency,
          lastActivityAt: deal.updated_at,
        },
      });
      if (id) queued += 1;
    }
  });
  transaction();
  return { scanned: deals.length, queued };
}

export function listPendingOutbox(limit = 50) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  return db.prepare(`
    SELECT * FROM crm_automation_outbox
    WHERE workspace_id = ? AND status = 'pending'
    ORDER BY created_at ASC, rowid ASC
    LIMIT ?
  `).all(workspaceId, limit).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    dealId: row.deal_id,
    dealVersion: row.deal_version,
    payload: JSON.parse(row.payload_json || '{}'),
    attempts: row.attempts,
    createdAt: row.created_at,
  }));
}

export function markOutboxProcessed(id, processedAt = nowIso()) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  db.prepare(`
    UPDATE crm_automation_outbox
    SET status = 'processed', processed_at = ?, attempts = attempts + 1, last_error = NULL
    WHERE id = ? AND workspace_id = ?
  `).run(processedAt, id, workspaceId);
}

export function markOutboxFailed(id, errorMessage) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  db.prepare(`
    UPDATE crm_automation_outbox
    SET attempts = attempts + 1, last_error = ?
    WHERE id = ? AND workspace_id = ?
  `).run(String(errorMessage || 'automation processing failed').slice(0, 1000), id, workspaceId);
}

export function createAutomationAction({ dealId, actionType, title, payload, idempotencyKey, status = 'pending', createdAt = nowIso() }) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  const id = crypto.randomUUID();
  const result = db.prepare(`
    INSERT OR IGNORE INTO crm_automation_actions (
      id, workspace_id, deal_id, action_type, status, title, payload_json, idempotency_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, workspaceId, dealId, actionType, status, title, JSON.stringify(payload || {}), idempotencyKey, createdAt, createdAt);
  return result.changes === 1;
}

export function listAutomationActions(limit = 100) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  return db.prepare(`
    SELECT id, deal_id, action_type, status, title, payload_json, idempotency_key, created_at, updated_at
    FROM crm_automation_actions
    WHERE workspace_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
  `).all(workspaceId, limit).map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    actionType: row.action_type,
    status: row.status,
    title: row.title,
    payload: JSON.parse(row.payload_json || '{}'),
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function automationSummary() {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  const pendingEvents = db.prepare(`SELECT COUNT(*) AS count FROM crm_automation_outbox WHERE workspace_id = ? AND status = 'pending'`).get(workspaceId).count;
  const actions = db.prepare(`SELECT action_type, status, COUNT(*) AS count FROM crm_automation_actions WHERE workspace_id = ? GROUP BY action_type, status`).all(workspaceId);
  return { pendingEvents, actions: actions.map((row) => ({ actionType: row.action_type, status: row.status, count: row.count })) };
}
