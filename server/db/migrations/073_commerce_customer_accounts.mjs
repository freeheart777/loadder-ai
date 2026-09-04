export const migration073CommerceCustomerAccounts = {
  version: 73,
  name: "commerce_customer_accounts",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS ecommerce_customer_accounts(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  auth_project_id TEXT NOT NULL,
  app_user_id TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(auth_project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(app_user_id) REFERENCES business_builder_app_users(id) ON DELETE CASCADE,
  UNIQUE(workspace_id,site_project_id,auth_project_id,app_user_id)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_customer_accounts_store ON ecommerce_customer_accounts(workspace_id,site_project_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecommerce_customer_accounts_identity ON ecommerce_customer_accounts(workspace_id,auth_project_id,app_user_id);

CREATE TABLE IF NOT EXISTS ecommerce_customer_addresses(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  customer_account_id TEXT NOT NULL,
  label TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  country TEXT,
  province TEXT,
  city TEXT NOT NULL,
  address1 TEXT NOT NULL,
  address2 TEXT,
  postal_code TEXT,
  is_default_shipping INTEGER NOT NULL DEFAULT 0 CHECK(is_default_shipping IN(0,1)),
  is_default_billing INTEGER NOT NULL DEFAULT 0 CHECK(is_default_billing IN(0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_account_id) REFERENCES ecommerce_customer_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_customer_addresses_account ON ecommerce_customer_addresses(workspace_id,customer_account_id,updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ecommerce_customer_default_shipping ON ecommerce_customer_addresses(customer_account_id) WHERE is_default_shipping=1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ecommerce_customer_default_billing ON ecommerce_customer_addresses(customer_account_id) WHERE is_default_billing=1;

CREATE TABLE IF NOT EXISTS ecommerce_customer_order_links(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  customer_account_id TEXT NOT NULL,
  app_user_id TEXT NOT NULL,
  auth_project_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source='CHECKOUT'),
  linked_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(order_id) REFERENCES ecommerce_orders(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_account_id) REFERENCES ecommerce_customer_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY(app_user_id) REFERENCES business_builder_app_users(id) ON DELETE CASCADE,
  FOREIGN KEY(auth_project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE,
  UNIQUE(order_id)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_customer_order_links_account ON ecommerce_customer_order_links(workspace_id,customer_account_id,linked_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_customer_account_guard BEFORE INSERT ON ecommerce_customer_accounts BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects s WHERE s.id=NEW.site_project_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'customer account site workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.business_builder_project_id=NEW.auth_project_id AND b.status='active') THEN RAISE(ABORT,'customer account commerce binding mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_builder_app_users u WHERE u.id=NEW.app_user_id AND u.workspace_id=NEW.workspace_id AND u.project_id=NEW.auth_project_id AND u.role='customer') THEN RAISE(ABORT,'customer account app user mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_customer_account_identity_immutable BEFORE UPDATE OF workspace_id,site_project_id,auth_project_id,app_user_id ON ecommerce_customer_accounts BEGIN
  SELECT RAISE(ABORT,'customer account identity is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_customer_address_guard BEFORE INSERT ON ecommerce_customer_addresses BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_customer_accounts c WHERE c.id=NEW.customer_account_id AND c.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'customer address account mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_customer_address_update_guard BEFORE UPDATE OF workspace_id,customer_account_id ON ecommerce_customer_addresses BEGIN
  SELECT RAISE(ABORT,'customer address ownership is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_customer_order_link_guard BEFORE INSERT ON ecommerce_customer_order_links BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_customer_accounts c WHERE c.id=NEW.customer_account_id AND c.workspace_id=NEW.workspace_id AND c.site_project_id=NEW.site_project_id AND c.app_user_id=NEW.app_user_id AND c.auth_project_id=NEW.auth_project_id) THEN RAISE(ABORT,'customer order link account mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_orders o WHERE o.id=NEW.order_id AND o.workspace_id=NEW.workspace_id AND o.site_project_id=NEW.site_project_id) THEN RAISE(ABORT,'customer order link order mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_customer_order_link_immutable_update BEFORE UPDATE ON ecommerce_customer_order_links BEGIN SELECT RAISE(ABORT,'customer order link is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_customer_order_link_immutable_delete BEFORE DELETE ON ecommerce_customer_order_links BEGIN SELECT RAISE(ABORT,'customer order link is immutable'); END;
`);
  },
};
