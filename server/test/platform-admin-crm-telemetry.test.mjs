import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createPlatformAdminCrmTelemetry } from '../app/repositories/platform-admin-crm-telemetry.mjs';

function baseDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT, slug TEXT, status TEXT, created_at TEXT);
    INSERT INTO workspaces VALUES
      ('w1','Alpha','alpha','active','2026-01-01T00:00:00.000Z'),
      ('w2','Beta','beta','active','2026-01-02T00:00:00.000Z');
  `);
  return db;
}

test('returns unavailable instead of fabricated zeroes before CRM initialization', () => {
  const db = baseDb();
  const telemetry = createPlatformAdminCrmTelemetry(db).crmTelemetry();
  assert.equal(telemetry.status, 'unavailable');
  assert.equal(telemetry.totals, null);
  assert.deepEqual(telemetry.workspaces, []);
  db.close();
});

test('aggregates CRM, automation, win rate and workspace attention from persisted evidence', () => {
  const db = baseDb();
  db.exec(`
    CREATE TABLE crm_deals (
      id TEXT PRIMARY KEY, workspace_id TEXT, stage TEXT, amount_minor INTEGER, updated_at TEXT
    );
    CREATE TABLE crm_automation_outbox (
      id TEXT PRIMARY KEY, workspace_id TEXT, status TEXT
    );
    CREATE TABLE crm_automation_actions (
      id TEXT PRIMARY KEY, workspace_id TEXT, status TEXT
    );

    INSERT INTO crm_deals VALUES
      ('d1','w1','qualified',1000,'2026-08-20T00:00:00.000Z'),
      ('d2','w1','negotiating',2000,'2026-08-21T00:00:00.000Z'),
      ('d3','w1','converted',3000,'2026-08-22T00:00:00.000Z'),
      ('d4','w1','lost',4000,'2026-08-23T00:00:00.000Z'),
      ('d5','w2','converted',5000,'2026-09-08T00:00:00.000Z');
    INSERT INTO crm_automation_outbox VALUES ('e1','w1','pending'),('e2','w1','processed');
    INSERT INTO crm_automation_actions VALUES ('a1','w1','pending'),('a2','w1','completed');
  `);

  const telemetry = createPlatformAdminCrmTelemetry(db, {
    now: () => Date.parse('2026-09-09T00:00:00.000Z'),
  }).crmTelemetry();

  assert.equal(telemetry.status, 'available');
  assert.equal(telemetry.totals.dealCount, 5);
  assert.equal(telemetry.totals.openDealCount, 2);
  assert.equal(telemetry.totals.wonCount, 2);
  assert.equal(telemetry.totals.lostCount, 1);
  assert.equal(telemetry.totals.winRate, 66.7);
  assert.equal(telemetry.totals.pipelineValue, 3000);
  assert.equal(telemetry.automation.pendingEvents, 1);
  assert.equal(telemetry.automation.actionCount, 2);
  assert.equal(telemetry.automation.pendingActionCount, 1);

  const alpha = telemetry.workspaces.find((item) => item.id === 'w1');
  assert.equal(alpha.openDealCount, 2);
  assert.equal(alpha.stuckDealCount, 2);
  assert.equal(alpha.pendingAutomationEvents, 1);
  assert.equal(alpha.engagement.status, 'attention');
  assert.equal(alpha.engagement.reason, 'at least half of open deals are stuck');

  const beta = telemetry.workspaces.find((item) => item.id === 'w2');
  assert.equal(beta.winRate, 100);
  assert.equal(beta.engagement.status, 'healthy');
  db.close();
});
