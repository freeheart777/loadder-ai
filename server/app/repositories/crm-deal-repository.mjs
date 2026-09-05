import crypto from "crypto";
import { db } from "../../db/workspace-database.mjs";
import { requireWorkspaceId } from "../tenant-context.mjs";

let initialized = false;

function nowIso() {
  return new Date().toISOString();
}

function ensureSchema() {
  if (initialized) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_deals (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      lead_id TEXT,
      title TEXT NOT NULL,
      company TEXT,
      amount_minor INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IRT',
      stage TEXT NOT NULL DEFAULT 'new',
      owner_id TEXT,
      owner_name TEXT NOT NULL DEFAULT 'تیم فروش',
      next_action TEXT,
      next_action_due_at TEXT,
      probability_override REAL,
      lost_reason TEXT,
      won_at TEXT,
      lost_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(workspace_id, lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_crm_deals_workspace_stage
      ON crm_deals(workspace_id, stage);

    CREATE TABLE IF NOT EXISTS crm_deal_stage_history (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      deal_id TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      reason TEXT,
      actor_type TEXT NOT NULL DEFAULT 'user',
      actor_id TEXT,
      occurred_at TEXT NOT NULL,
      version INTEGER NOT NULL,
      FOREIGN KEY (deal_id) REFERENCES crm_deals(id)
    );

    CREATE INDEX IF NOT EXISTS idx_crm_deal_history_workspace_deal
      ON crm_deal_stage_history(workspace_id, deal_id, occurred_at);

    CREATE TRIGGER IF NOT EXISTS crm_deal_stage_history_no_update
    BEFORE UPDATE ON crm_deal_stage_history
    BEGIN
      SELECT RAISE(ABORT, 'CRM_STAGE_HISTORY_IMMUTABLE');
    END;

    CREATE TRIGGER IF NOT EXISTS crm_deal_stage_history_no_delete
    BEFORE DELETE ON crm_deal_stage_history
    BEGIN
      SELECT RAISE(ABORT, 'CRM_STAGE_HISTORY_IMMUTABLE');
    END;
  `);

  initialized = true;
}

function mapDeal(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id,
    title: row.title,
    company: row.company,
    amount: row.amount_minor,
    currency: row.currency,
    stage: row.stage,
    ownerId: row.owner_id,
    owner: row.owner_name,
    nextAction: row.next_action,
    nextActionDueAt: row.next_action_due_at,
    probabilityOverride: row.probability_override,
    lostReason: row.lost_reason,
    wonAt: row.won_at,
    lostAt: row.lost_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bootstrapLegacyLeads(workspaceId) {
  const leads = db.prepare(`
    SELECT id, name, company, opportunity_value, status, created_at, updated_at
    FROM leads
    WHERE workspace_id = ?
  `).all(workspaceId);

  const insertDeal = db.prepare(`
    INSERT OR IGNORE INTO crm_deals (
      id, workspace_id, lead_id, title, company, amount_minor, currency,
      stage, owner_name, next_action, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'IRT', ?, 'تیم فروش', NULL, 1, ?, ?)
  `);
  const insertHistory = db.prepare(`
    INSERT OR IGNORE INTO crm_deal_stage_history (
      id, workspace_id, deal_id, from_stage, to_stage, reason,
      actor_type, actor_id, occurred_at, version
    ) VALUES (?, ?, ?, NULL, ?, 'legacy_bootstrap', 'system', NULL, ?, 1)
  `);

  const transaction = db.transaction(() => {
    for (const lead of leads) {
      const created = insertDeal.run(
        lead.id,
        workspaceId,
        lead.id,
        lead.name,
        lead.company,
        Number(lead.opportunity_value) || 0,
        lead.status || 'new',
        lead.created_at,
        lead.updated_at
      );
      if (created.changes > 0) {
        insertHistory.run(
          `deal-history-bootstrap-${lead.id}`,
          workspaceId,
          lead.id,
          lead.status || 'new',
          lead.updated_at || lead.created_at || nowIso()
        );
      }
    }
  });

  transaction();
}

export function getDeals() {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  bootstrapLegacyLeads(workspaceId);
  return db.prepare(`
    SELECT * FROM crm_deals
    WHERE workspace_id = ?
    ORDER BY updated_at DESC
  `).all(workspaceId).map(mapDeal);
}

export function getDealById(id) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  bootstrapLegacyLeads(workspaceId);
  return mapDeal(db.prepare(`
    SELECT * FROM crm_deals WHERE id = ? AND workspace_id = ?
  `).get(id, workspaceId));
}

export function getDealStageHistory(dealId) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  return db.prepare(`
    SELECT id, deal_id, from_stage, to_stage, reason, actor_type, actor_id, occurred_at, version
    FROM crm_deal_stage_history
    WHERE workspace_id = ? AND deal_id = ?
    ORDER BY occurred_at ASC, rowid ASC
  `).all(workspaceId, dealId).map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    reason: row.reason,
    actorType: row.actor_type,
    actorId: row.actor_id,
    occurredAt: row.occurred_at,
    version: row.version,
  }));
}

export function updateDealMetadata(id, { ownerId, owner, nextAction, nextActionDueAt, expectedVersion }) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  const current = getDealById(id);
  if (!current) return { kind: 'not_found' };
  if (expectedVersion !== current.version) return { kind: 'stale', current };

  const timestamp = nowIso();
  const nextVersion = current.version + 1;
  const result = db.prepare(`
    UPDATE crm_deals
    SET owner_id = ?, owner_name = ?, next_action = ?, next_action_due_at = ?,
        version = ?, updated_at = ?
    WHERE id = ? AND workspace_id = ? AND version = ?
  `).run(
    ownerId ?? current.ownerId,
    owner ?? current.owner,
    nextAction ?? current.nextAction,
    nextActionDueAt ?? current.nextActionDueAt,
    nextVersion,
    timestamp,
    id,
    workspaceId,
    current.version
  );

  if (result.changes !== 1) return { kind: 'stale', current: getDealById(id) };
  return { kind: 'ok', deal: getDealById(id) };
}

export function transitionDeal(id, { toStage, reason = null, expectedVersion, actorType = 'user', actorId = null }) {
  ensureSchema();
  const workspaceId = requireWorkspaceId();
  const current = getDealById(id);
  if (!current) return { kind: 'not_found' };
  if (expectedVersion !== current.version) return { kind: 'stale', current };

  const timestamp = nowIso();
  const nextVersion = current.version + 1;
  const wonAt = toStage === 'converted' ? timestamp : current.wonAt;
  const lostAt = toStage === 'lost' ? timestamp : current.lostAt;
  const lostReason = toStage === 'lost' ? reason : null;

  const transaction = db.transaction(() => {
    const updated = db.prepare(`
      UPDATE crm_deals
      SET stage = ?, lost_reason = ?, won_at = ?, lost_at = ?, version = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ? AND version = ?
    `).run(
      toStage,
      lostReason,
      wonAt,
      lostAt,
      nextVersion,
      timestamp,
      id,
      workspaceId,
      current.version
    );
    if (updated.changes !== 1) return false;

    db.prepare(`
      INSERT INTO crm_deal_stage_history (
        id, workspace_id, deal_id, from_stage, to_stage, reason,
        actor_type, actor_id, occurred_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      workspaceId,
      id,
      current.stage,
      toStage,
      reason,
      actorType,
      actorId,
      timestamp,
      nextVersion
    );
    return true;
  });

  if (!transaction()) return { kind: 'stale', current: getDealById(id) };
  return { kind: 'ok', deal: getDealById(id) };
}
