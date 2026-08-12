import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databasePath = path.join(
  __dirname,
  "loadder.sqlite"
);

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    trigger TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    conditions_json TEXT NOT NULL DEFAULT '[]',
    actions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    event_type TEXT NOT NULL,
    workflow_id TEXT,
    workflow_title TEXT,
    action_type TEXT NOT NULL,
    channel TEXT,
    template TEXT,
    recipient TEXT,
    status TEXT NOT NULL,
    result_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
`);

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapAutomation(row) {
  return {
    id: row.id,
    title: row.title,
    trigger: row.trigger,
    enabled: Boolean(row.enabled),
    delayMinutes: row.delay_minutes,
    conditions: parseJson(
      row.conditions_json,
      []
    ),
    actions: parseJson(
      row.actions_json,
      []
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExecution(row) {
  return {
    id: row.id,
    timestamp: row.created_at,
    eventId: row.event_id,
    eventType: row.event_type,
    workflowId: row.workflow_id,
    workflowTitle: row.workflow_title,
    actionType: row.action_type,
    channel: row.channel,
    template: row.template,
    recipient: row.recipient,
    status: row.status,
    result: parseJson(
      row.result_json,
      {}
    ),
  };
}

export function getAutomations() {
  const rows = db
    .prepare(`
      SELECT *
      FROM automations
      ORDER BY created_at DESC
    `)
    .all();

  return rows.map(mapAutomation);
}

export function getAutomationById(id) {
  const row = db
    .prepare(`
      SELECT *
      FROM automations
      WHERE id = ?
    `)
    .get(id);

  return row ? mapAutomation(row) : null;
}

export function createAutomation({
  id = crypto.randomUUID(),
  title,
  trigger,
  enabled = true,
  delayMinutes = 0,
  conditions = [],
  actions = [],
}) {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO automations (
      id,
      title,
      trigger,
      enabled,
      delay_minutes,
      conditions_json,
      actions_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    title,
    trigger,
    enabled ? 1 : 0,
    Number(delayMinutes) || 0,
    JSON.stringify(conditions),
    JSON.stringify(actions),
    now,
    now
  );

  return getAutomationById(id);
}

export function updateAutomation(
  id,
  updates
) {
  const current =
    getAutomationById(id);

  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...updates,
  };

  const now =
    new Date().toISOString();

  db.prepare(`
    UPDATE automations
    SET
      title = ?,
      trigger = ?,
      enabled = ?,
      delay_minutes = ?,
      conditions_json = ?,
      actions_json = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    next.title,
    next.trigger,
    next.enabled ? 1 : 0,
    Number(next.delayMinutes) || 0,
    JSON.stringify(
      next.conditions ?? []
    ),
    JSON.stringify(
      next.actions ?? []
    ),
    now,
    id
  );

  return getAutomationById(id);
}

export function deleteAutomation(id) {
  const result = db
    .prepare(`
      DELETE FROM automations
      WHERE id = ?
    `)
    .run(id);

  return result.changes > 0;
}

export function saveEvent(event) {
  db.prepare(`
    INSERT INTO events (
      id,
      type,
      payload_json,
      created_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    event.id,
    event.type,
    JSON.stringify(
      event.payload ?? {}
    ),
    event.createdAt
  );

  return event;
}

export function saveExecution({
  id,
  eventId,
  eventType,
  workflowId,
  workflowTitle,
  actionType,
  channel,
  template,
  recipient,
  status,
  result,
  timestamp,
}) {
  db.prepare(`
    INSERT INTO executions (
      id,
      event_id,
      event_type,
      workflow_id,
      workflow_title,
      action_type,
      channel,
      template,
      recipient,
      status,
      result_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    eventId ?? null,
    eventType,
    workflowId ?? null,
    workflowTitle ?? null,
    actionType,
    channel ?? null,
    template ?? null,
    recipient ?? null,
    status,
    JSON.stringify(result ?? {}),
    timestamp
  );
}

export function getExecutions(
  limit = 100
) {
  const rows = db
    .prepare(`
      SELECT *
      FROM executions
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(limit);

  return rows.map(mapExecution);
}

export function clearExecutions() {
  db.prepare(`
    DELETE FROM executions
  `).run();
}

export function automationCount() {
  const row = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM automations
    `)
    .get();

  return row.count;
}

export function seedDefaultAutomations(
  automations
) {
  if (automationCount() > 0) {
    return;
  }

  const transaction =
    db.transaction(() => {
      for (const automation of automations) {
        createAutomation(
          automation
        );
      }
    });

  transaction();
}

export default db;