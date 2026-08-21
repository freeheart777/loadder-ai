import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("Phase 1B migration and workspace isolation", async (t) => {
  const testDirectory = mkdtempSync(join(tmpdir(), "loadder-tenant-"));
  process.env.DATABASE_PATH = join(testDirectory, "tenant.sqlite");

  const raw = await import("../db/database.mjs");
  const { runMigrations } = await import("../db/migrate.mjs");
  const { migration001Identity } = await import(
    "../db/migrations/001_identity.mjs"
  );
  const { LEGACY_WORKSPACE_ID, migration002TenantDomainData } = await import(
    "../db/migrations/002_tenant_domain_data.mjs"
  );
  const { migration003TenantRelationshipGuards } = await import(
    "../db/migrations/003_tenant_relationship_guards.mjs"
  );

  runMigrations(raw.db, [migration001Identity]);
  raw.db.prepare(`
    INSERT INTO customers (
      id, name, status, total_spent, orders_count, lifetime_value,
      risk_score, created_at, updated_at
    ) VALUES ('legacy-customer', 'Legacy', 'active', 0, 0, 0, 0, ?, ?)
  `).run(new Date().toISOString(), new Date().toISOString());

  runMigrations(raw.db, [
    migration001Identity,
    migration002TenantDomainData,
    migration003TenantRelationshipGuards,
  ]);
  runMigrations(raw.db, [
    migration001Identity,
    migration002TenantDomainData,
    migration003TenantRelationshipGuards,
  ]);

  const scoped = await import("../db/workspace-database.mjs");
  const { runWithWorkspace } = await import("../app/tenant-context.mjs");
  const timestamp = new Date().toISOString();
  const workspaceA = "workspace-a";
  const workspaceB = "workspace-b";

  for (const [id, slug] of [
    [workspaceA, "workspace-a"],
    [workspaceB, "workspace-b"],
  ]) {
    raw.db.prepare(`
      INSERT INTO workspaces (id, name, slug, status, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).run(id, id, slug, timestamp, timestamp);
  }

  await t.test("legacy data is preserved and backfilled", () => {
    const legacy = raw.db
      .prepare("SELECT workspace_id FROM customers WHERE id = 'legacy-customer'")
      .get();
    assert.equal(legacy.workspace_id, LEGACY_WORKSPACE_ID);
    assert.equal(
      raw.db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()
        .count,
      3
    );
  });

  let customerA;
  await t.test("CRM records are isolated by workspace", () => {
    customerA = runWithWorkspace(workspaceA, () =>
      scoped.createCustomer({ name: "Customer A" })
    );
    runWithWorkspace(workspaceB, () =>
      scoped.createCustomer({ name: "Customer B" })
    );

    const namesA = runWithWorkspace(workspaceA, () =>
      scoped.getCustomers().map((customer) => customer.name)
    );
    const namesB = runWithWorkspace(workspaceB, () =>
      scoped.getCustomers().map((customer) => customer.name)
    );
    assert.deepEqual(namesA, ["Customer A"]);
    assert.deepEqual(namesB, ["Customer B"]);
    assert.equal(
      runWithWorkspace(workspaceB, () =>
        scoped.getCustomerById(customerA.id)
      ),
      null
    );
  });

  await t.test("cross-workspace customer relationships are rejected", () => {
    assert.throws(() =>
      runWithWorkspace(workspaceB, () =>
        scoped.createOrder({
          customerId: customerA.id,
          totalAmount: 100,
        })
      )
    );
  });

  await t.test("automation, events, and executions are isolated", () => {
    const automationA = runWithWorkspace(workspaceA, () =>
      scoped.createAutomation({ title: "A", trigger: "test.a" })
    );
    runWithWorkspace(workspaceB, () =>
      scoped.createAutomation({ title: "B", trigger: "test.b" })
    );
    assert.equal(
      runWithWorkspace(workspaceB, () =>
        scoped.getAutomationById(automationA.id)
      ),
      null
    );

    runWithWorkspace(workspaceA, () => {
      scoped.saveEvent({
        id: "event-a",
        type: "test",
        payload: {},
        createdAt: timestamp,
      });
      scoped.saveExecution({
        id: "execution-a",
        eventId: "event-a",
        eventType: "test",
        actionType: "noop",
        status: "success",
        timestamp,
      });
    });
    assert.equal(
      runWithWorkspace(workspaceB, () => scoped.getExecutions()).length,
      0
    );
  });

  await t.test("campaigns, metrics, and attribution are isolated", () => {
    raw.db.prepare(`
      INSERT INTO marketing_channels
        (id, name, name_fa, type, enabled, created_at, updated_at)
      VALUES ('channel', 'Channel', 'Channel', 'test', 1, ?, ?)
    `).run(timestamp, timestamp);
    raw.db.prepare(`
      INSERT INTO marketing_platforms
        (id, channel_id, name, name_fa, provider_key, enabled, created_at, updated_at)
      VALUES ('platform', 'channel', 'Platform', 'Platform', 'test', 1, ?, ?)
    `).run(timestamp, timestamp);

    const campaignA = runWithWorkspace(workspaceA, () =>
      scoped.createMarketingCampaign({
        channelId: "channel",
        platformId: "platform",
        name: "Campaign A",
      })
    );
    runWithWorkspace(workspaceA, () =>
      scoped.saveCampaignMetric({ campaignId: campaignA.id, spend: 10 })
    );
    assert.equal(
      runWithWorkspace(workspaceB, () =>
        scoped.getCampaignById(campaignA.id)
      ),
      null
    );
    assert.throws(() =>
      runWithWorkspace(workspaceB, () =>
        scoped.saveCampaignMetric({ campaignId: campaignA.id, spend: 20 })
      )
    );
    assert.throws(() =>
      runWithWorkspace(workspaceB, () =>
        scoped.createAttributionTouchpoint({
          customerId: customerA.id,
          touchType: "cross-tenant",
        })
      )
    );
  });

  await t.test("database remains valid", () => {
    assert.equal(raw.db.pragma("integrity_check", { simple: true }), "ok");
    assert.deepEqual(raw.db.pragma("foreign_key_check"), []);
  });

  raw.db.close();
  delete process.env.DATABASE_PATH;
  rmSync(testDirectory, { recursive: true, force: true });
});
