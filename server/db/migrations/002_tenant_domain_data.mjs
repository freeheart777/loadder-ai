export const LEGACY_WORKSPACE_ID = "workspace-legacy-loadder";

const tenantTables = [
  "automations",
  "events",
  "executions",
  "customers",
  "leads",
  "orders",
  "carts",
  "customer_events",
  "marketing_campaigns",
  "campaign_metrics",
  "attribution_touchpoints",
];

function ensureTenantColumn(db, table) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === "workspace_id")) {
    db.exec(`
      ALTER TABLE ${table}
      ADD COLUMN workspace_id TEXT REFERENCES workspaces(id)
    `);
  }
}

function addWorkspaceRequiredTriggers(db, table) {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_${table}_workspace_insert
    BEFORE INSERT ON ${table}
    WHEN NEW.workspace_id IS NULL
    BEGIN
      SELECT RAISE(ABORT, 'workspace_id is required');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_${table}_workspace_update
    BEFORE UPDATE OF workspace_id ON ${table}
    WHEN NEW.workspace_id IS NULL
    BEGIN
      SELECT RAISE(ABORT, 'workspace_id is required');
    END;
  `);
}

export const migration002TenantDomainData = {
  version: 2,
  name: "tenant_domain_data",
  up(db) {
    const timestamp = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO workspaces (
        id, name, slug, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'active', ?, ?)
    `).run(
      LEGACY_WORKSPACE_ID,
      "Loadder Legacy Data",
      "loadder-legacy-data",
      timestamp,
      timestamp
    );

    for (const table of tenantTables) {
      ensureTenantColumn(db, table);
      db.prepare(`
        UPDATE ${table} SET workspace_id = ? WHERE workspace_id IS NULL
      `).run(LEGACY_WORKSPACE_ID);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_${table}_workspace
        ON ${table}(workspace_id)
      `);
      addWorkspaceRequiredTriggers(db, table);
    }

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_leads_customer_workspace
      BEFORE INSERT ON leads
      WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace customer reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_leads_customer_workspace_update
      BEFORE UPDATE OF customer_id, workspace_id ON leads
      WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace customer reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_orders_customer_workspace
      BEFORE INSERT ON orders
      WHEN NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace customer reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_orders_customer_workspace_update
      BEFORE UPDATE OF customer_id, workspace_id ON orders
      WHEN NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace customer reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_carts_customer_workspace
      BEFORE INSERT ON carts
      WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace customer reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_carts_customer_workspace_update
      BEFORE UPDATE OF customer_id, workspace_id ON carts
      WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace customer reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_customer_events_customer_workspace
      BEFORE INSERT ON customer_events
      WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace customer reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_customer_events_customer_workspace_update
      BEFORE UPDATE OF customer_id, workspace_id ON customer_events
      WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace customer reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_campaign_metrics_campaign_workspace
      BEFORE INSERT ON campaign_metrics
      WHEN NOT EXISTS (
        SELECT 1 FROM marketing_campaigns
        WHERE id = NEW.campaign_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace campaign reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_campaign_metrics_campaign_workspace_update
      BEFORE UPDATE OF campaign_id, workspace_id ON campaign_metrics
      WHEN NOT EXISTS (
        SELECT 1 FROM marketing_campaigns
        WHERE id = NEW.campaign_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace campaign reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_executions_event_workspace
      BEFORE INSERT ON executions
      WHEN NEW.event_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM events
        WHERE id = NEW.event_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace event reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_executions_workflow_workspace
      BEFORE INSERT ON executions
      WHEN NEW.workflow_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM automations
        WHERE id = NEW.workflow_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace workflow reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_attribution_customer_workspace
      BEFORE INSERT ON attribution_touchpoints
      WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace customer reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_attribution_lead_workspace
      BEFORE INSERT ON attribution_touchpoints
      WHEN NEW.lead_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM leads
        WHERE id = NEW.lead_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace lead reference'); END;

      CREATE TRIGGER IF NOT EXISTS trg_attribution_campaign_workspace
      BEFORE INSERT ON attribution_touchpoints
      WHEN NEW.campaign_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM marketing_campaigns
        WHERE id = NEW.campaign_id AND workspace_id = NEW.workspace_id
      )
      BEGIN SELECT RAISE(ABORT, 'cross-workspace campaign reference'); END;
    `);
  },
};
