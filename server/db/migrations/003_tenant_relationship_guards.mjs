export const migration003TenantRelationshipGuards = {
  version: 3,
  name: "tenant_relationship_guards",
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_leads_customer_workspace_update
      BEFORE UPDATE OF customer_id, workspace_id ON leads
      WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS (
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

      CREATE TRIGGER IF NOT EXISTS trg_carts_customer_workspace_update
      BEFORE UPDATE OF customer_id, workspace_id ON carts
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

      CREATE TRIGGER IF NOT EXISTS trg_attribution_workspace_update
      BEFORE UPDATE OF customer_id, lead_id, campaign_id, workspace_id
      ON attribution_touchpoints
      WHEN
        (NEW.customer_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM customers
          WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id
        )) OR
        (NEW.lead_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM leads
          WHERE id = NEW.lead_id AND workspace_id = NEW.workspace_id
        )) OR
        (NEW.campaign_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM marketing_campaigns
          WHERE id = NEW.campaign_id AND workspace_id = NEW.workspace_id
        ))
      BEGIN SELECT RAISE(ABORT, 'cross-workspace attribution reference'); END;
    `);
  },
};

