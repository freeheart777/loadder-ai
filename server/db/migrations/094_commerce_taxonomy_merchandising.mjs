import crypto from "crypto";

const stamp = () => new Date().toISOString();
const text = (value) => String(value ?? "").trim();
const key = (value) => text(value).toLocaleLowerCase("en-US");
const slug = (value) => text(value).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "item";
const stableId = (kind, workspaceId, name) => `${kind}_${crypto.createHash("sha256").update(`${workspaceId}:${key(name)}`).digest("hex").slice(0, 24)}`;

// Legacy product.category and product.brand remain compatibility display fields.
// category_id and brand_id become the authoritative assignment after this migration.
export const migration094CommerceTaxonomyMerchandising = {
  version: 94,
  name: "commerce_taxonomy_merchandising",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS ecommerce_categories(
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, slug TEXT NOT NULL, parent_id TEXT,
  status TEXT NOT NULL CHECK(status IN('ACTIVE','ARCHIVED')) DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, normalized_name), UNIQUE(workspace_id, slug),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(parent_id) REFERENCES ecommerce_categories(id)
);
CREATE TABLE IF NOT EXISTS ecommerce_brands(
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, slug TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('ACTIVE','ARCHIVED')) DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, normalized_name), UNIQUE(workspace_id, slug),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);
CREATE TABLE IF NOT EXISTS ecommerce_collections(
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, site_project_id TEXT NOT NULL,
  name TEXT NOT NULL, slug TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN('ACTIVE','ARCHIVED')) DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, site_project_id, slug),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id), FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ecommerce_collection_products(
  workspace_id TEXT NOT NULL, collection_id TEXT NOT NULL, product_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0), created_at TEXT NOT NULL,
  PRIMARY KEY(collection_id, product_id), UNIQUE(collection_id, position),
  FOREIGN KEY(collection_id) REFERENCES ecommerce_collections(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES ecommerce_products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_categories_workspace ON ecommerce_categories(workspace_id,status,name);
CREATE INDEX IF NOT EXISTS idx_ecommerce_brands_workspace ON ecommerce_brands(workspace_id,status,name);
CREATE INDEX IF NOT EXISTS idx_ecommerce_collections_store ON ecommerce_collections(workspace_id,site_project_id,status,name);
CREATE INDEX IF NOT EXISTS idx_ecommerce_collection_products ON ecommerce_collection_products(workspace_id,collection_id,position);
`);
    const columns = db.prepare("PRAGMA table_info(ecommerce_products)").all().map((column) => column.name);
    if (!columns.includes("category_id")) db.exec("ALTER TABLE ecommerce_products ADD COLUMN category_id TEXT");
    if (!columns.includes("brand_id")) db.exec("ALTER TABLE ecommerce_products ADD COLUMN brand_id TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_ecommerce_products_taxonomy ON ecommerce_products(workspace_id,site_project_id,category_id,brand_id,status)");

    const findOrCreate = (table, kind, workspaceId, raw) => {
      const name = text(raw); if (!name) return null;
      const normalized = key(name);
      const found = db.prepare(`SELECT id FROM ${table} WHERE workspace_id=? AND normalized_name=?`).get(workspaceId, normalized);
      if (found) return found.id;
      const id = stableId(kind, workspaceId, name), createdAt = stamp();
      let candidate = slug(name), suffix = 2;
      while (db.prepare(`SELECT 1 FROM ${table} WHERE workspace_id=? AND slug=?`).get(workspaceId, candidate)) candidate = `${slug(name).slice(0, 90)}-${suffix++}`;
      db.prepare(`INSERT OR IGNORE INTO ${table}(id,workspace_id,name,normalized_name,slug,status,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE',?,?)`)
        .run(id, workspaceId, name, normalized, candidate, createdAt, createdAt);
      return db.prepare(`SELECT id FROM ${table} WHERE workspace_id=? AND normalized_name=?`).get(workspaceId, normalized).id;
    };
    const rows = db.prepare("SELECT id,workspace_id,category,brand,category_id,brand_id FROM ecommerce_products").all();
    const backfill = db.transaction(() => rows.forEach((product) => {
      const categoryId = product.category_id || findOrCreate("ecommerce_categories", "cat", product.workspace_id, product.category);
      const brandId = product.brand_id || findOrCreate("ecommerce_brands", "brand", product.workspace_id, product.brand);
      if (categoryId !== product.category_id || brandId !== product.brand_id) db.prepare("UPDATE ecommerce_products SET category_id=?,brand_id=? WHERE id=? AND workspace_id=?").run(categoryId, brandId, product.id, product.workspace_id);
    }));
    backfill();
    db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_product_category_guard_insert BEFORE INSERT ON ecommerce_products WHEN NEW.category_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_categories c WHERE c.id=NEW.category_id AND c.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce category workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_product_brand_guard_insert BEFORE INSERT ON ecommerce_products WHEN NEW.brand_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_brands b WHERE b.id=NEW.brand_id AND b.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce brand workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_product_taxonomy_guard_update BEFORE UPDATE OF category_id,brand_id ON ecommerce_products BEGIN
 SELECT CASE WHEN NEW.category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ecommerce_categories c WHERE c.id=NEW.category_id AND c.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce category workspace mismatch') END;
 SELECT CASE WHEN NEW.brand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ecommerce_brands b WHERE b.id=NEW.brand_id AND b.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce brand workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_collection_product_guard BEFORE INSERT ON ecommerce_collection_products BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_collections c WHERE c.id=NEW.collection_id AND c.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'ecommerce collection workspace mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ecommerce_products p JOIN ecommerce_collections c ON c.id=NEW.collection_id WHERE p.id=NEW.product_id AND p.workspace_id=NEW.workspace_id AND p.site_project_id=c.site_project_id) THEN RAISE(ABORT,'ecommerce collection product mismatch') END;
END;
`);
  },
};
