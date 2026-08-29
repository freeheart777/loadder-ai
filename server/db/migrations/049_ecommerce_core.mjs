export const migration049EcommerceCore = {
  version: 49,
  name: "ecommerce_core",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS ecommerce_products(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name))>0),
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT,
  brand TEXT,
  status TEXT NOT NULL CHECK(status IN('DRAFT','ACTIVE','ARCHIVED')) DEFAULT 'DRAFT',
  currency TEXT NOT NULL DEFAULT 'USD',
  base_price_minor INTEGER NOT NULL DEFAULT 0 CHECK(base_price_minor>=0),
  compare_at_price_minor INTEGER CHECK(compare_at_price_minor IS NULL OR compare_at_price_minor>=0),
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN(0,1)),
  seo_title TEXT,
  seo_description TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  UNIQUE(workspace_id,site_project_id,slug)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_products_project ON ecommerce_products(workspace_id,site_project_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS ecommerce_variants(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Default',
  price_minor INTEGER,
  inventory_quantity INTEGER NOT NULL DEFAULT 0 CHECK(inventory_quantity>=0),
  inventory_policy TEXT NOT NULL CHECK(inventory_policy IN('DENY','CONTINUE')) DEFAULT 'DENY',
  options_json TEXT NOT NULL DEFAULT '{}',
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(product_id) REFERENCES ecommerce_products(id) ON DELETE CASCADE,
  UNIQUE(workspace_id,sku)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_variants_product ON ecommerce_variants(workspace_id,product_id,active);

CREATE TABLE IF NOT EXISTS ecommerce_carts(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  customer_id TEXT,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK(status IN('ACTIVE','ABANDONED','CONVERTED')) DEFAULT 'ACTIVE',
  coupon_code TEXT,
  subtotal_minor INTEGER NOT NULL DEFAULT 0,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  shipping_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_carts_project ON ecommerce_carts(workspace_id,site_project_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS ecommerce_cart_items(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  cart_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity>0),
  unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor>=0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(cart_id) REFERENCES ecommerce_carts(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES ecommerce_products(id),
  FOREIGN KEY(variant_id) REFERENCES ecommerce_variants(id),
  UNIQUE(cart_id,variant_id)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_cart_items_cart ON ecommerce_cart_items(workspace_id,cart_id);

CREATE TABLE IF NOT EXISTS ecommerce_orders(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  cart_id TEXT,
  customer_id TEXT,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK(status IN('PENDING','CONFIRMED','FULFILLING','SHIPPED','COMPLETED','CANCELLED','REFUNDED')) DEFAULT 'PENDING',
  payment_status TEXT NOT NULL CHECK(payment_status IN('UNPAID','AUTHORIZED','PAID','PARTIALLY_REFUNDED','REFUNDED','FAILED')) DEFAULT 'UNPAID',
  fulfillment_status TEXT NOT NULL CHECK(fulfillment_status IN('UNFULFILLED','PARTIAL','FULFILLED','RETURNED')) DEFAULT 'UNFULFILLED',
  payment_provider TEXT,
  payment_reference TEXT,
  shipping_method TEXT,
  shipping_address_json TEXT NOT NULL DEFAULT '{}',
  subtotal_minor INTEGER NOT NULL DEFAULT 0,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  shipping_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(cart_id) REFERENCES ecommerce_carts(id),
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_project ON ecommerce_orders(workspace_id,site_project_id,created_at DESC);

CREATE TABLE IF NOT EXISTS ecommerce_order_items(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity>0),
  unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor>=0),
  line_total_minor INTEGER NOT NULL CHECK(line_total_minor>=0),
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(order_id) REFERENCES ecommerce_orders(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES ecommerce_products(id),
  FOREIGN KEY(variant_id) REFERENCES ecommerce_variants(id)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_order_items_order ON ecommerce_order_items(workspace_id,order_id);

CREATE TABLE IF NOT EXISTS ecommerce_coupons(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK(discount_type IN('PERCENT','FIXED')),
  discount_value INTEGER NOT NULL CHECK(discount_value>=0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  starts_at TEXT,
  ends_at TEXT,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  UNIQUE(workspace_id,site_project_id,code)
);

CREATE TABLE IF NOT EXISTS ecommerce_shipping_methods(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'MANUAL',
  currency TEXT NOT NULL DEFAULT 'USD',
  price_minor INTEGER NOT NULL DEFAULT 0 CHECK(price_minor>=0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ecommerce_payment_providers(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('DISCONNECTED','PENDING','CONNECTED','ERROR')) DEFAULT 'DISCONNECTED',
  config_json TEXT NOT NULL DEFAULT '{}',
  credential_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  UNIQUE(workspace_id,site_project_id,provider_key)
);

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_product_workspace_guard BEFORE INSERT ON ecommerce_products BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects p WHERE p.id=NEW.site_project_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce product workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_variant_workspace_guard BEFORE INSERT ON ecommerce_variants BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_products p WHERE p.id=NEW.product_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce variant workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_cart_workspace_guard BEFORE INSERT ON ecommerce_carts BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects p WHERE p.id=NEW.site_project_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce cart workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_cart_item_workspace_guard BEFORE INSERT ON ecommerce_cart_items BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_carts c WHERE c.id=NEW.cart_id AND c.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce cart item workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_variants v JOIN ecommerce_products p ON p.id=v.product_id WHERE v.id=NEW.variant_id AND p.id=NEW.product_id AND v.workspace_id=NEW.workspace_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce cart product mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_order_workspace_guard BEFORE INSERT ON ecommerce_orders BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects p WHERE p.id=NEW.site_project_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce order workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_order_item_workspace_guard BEFORE INSERT ON ecommerce_order_items BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_orders o WHERE o.id=NEW.order_id AND o.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce order item workspace mismatch') END;
END;
`);
  },
};
