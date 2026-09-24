import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const testDir = mkdtempSync(join(tmpdir(), "loadder-runtime-capabilities-"));
process.env.DATABASE_PATH = join(testDir, "runtime-capabilities.sqlite");
process.env.NODE_ENV = "test";

const [
  { db }, { createAuthRouter }, { createPublicSitesRouter }, { createSiteProjectRepository }, { createSiteProjectService },
  { createEcommerceService }, { runWithWorkspace }, { runMigrations }, { migrations },
  { publishedCapabilityContext, draftCapabilityContext, commerceEnabled }, { resolveCapabilities },
] = await Promise.all([
  import("../db/workspace-database.mjs"),
  import("../app/routes/auth.mjs"),
  import("../app/routes/public-sites.mjs"),
  import("../app/repositories/site-project-repository.mjs"),
  import("../app/services/site-project-service.mjs"),
  import("../app/services/ecommerce-service.mjs"),
  import("../app/tenant-context.mjs"),
  import("../db/migrate.mjs"),
  import("../db/migrations/index.mjs"),
  import("../app/site-platform/runtime-capabilities.mjs"),
  import("../app/site-platform/capability-resolver.mjs"),
]);
runMigrations(db, migrations);

const WS = "ws-runtime";
const now = "2026-09-25T00:00:00.000Z";
db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)").run(WS, WS, WS, now, now);

const repository = createSiteProjectRepository(db);
const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: null, isStale: false }) } });

const section = (id, type, title) => ({ id, type, enabled: true, title, subtitle: "", backgroundColor: "#fff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32 });
const storeDoc = () => ({ storeBuilderV16: { version: 16, sections: [section("p", "products", "محصولات"), section("t", "trust", "ضمانت")] } });
const corporateDoc = () => ({ storeBuilderV16: { version: 16, header: { storeName: "شرکت" }, hero: { enabled: true, title: "خانه", subtitle: "" }, sections: [section("a", "about", "درباره ما"), section("c", "contact", "تماس")] } });

const publish = (name, siteType, content) => runWithWorkspace(WS, () => {
  const project = service.create({ name, siteType, content });
  service.publish(project.id);
  return project.id;
});
const catalog = (siteProjectId, suffix) => {
  db.prepare("INSERT INTO ecommerce_products(id,workspace_id,site_project_id,name,slug,status,currency,base_price_minor,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE','IRT',10000,'{}',?,?)")
    .run(`product-${suffix}`, WS, siteProjectId, `Product ${suffix}`, `product-${suffix}`, now, now);
  db.prepare("INSERT INTO ecommerce_variants(id,workspace_id,product_id,sku,title,price_minor,inventory_quantity,inventory_policy,options_json,image_url,active,created_at,updated_at) VALUES(?,?,?,?,?,10000,10,'DENY','{}',?,1,?,?)")
    .run(`variant-${suffix}`, WS, `product-${suffix}`, `SKU-${suffix}`, "Default", `https://cdn.example.test/${suffix}.png`, now, now);
};

const storeId = publish("فروشگاه", "STORE", storeDoc());
catalog(storeId, "store");
const businessId = publish("شرکت", "BUSINESS", corporateDoc());
const medicalId = publish("مطب", "MEDICAL", corporateDoc());
// Published as STORE (v2 manifest records commerce), later changed to BUSINESS.
const convertedId = publish("تبدیل‌شده", "STORE", storeDoc());
catalog(convertedId, "converted");
db.prepare("UPDATE site_projects SET site_type='BUSINESS' WHERE id=?").run(convertedId);
// Published before PR 2: a manifest without v2 metadata.
const legacyId = publish("قدیمی", "STORE", storeDoc());
catalog(legacyId, "legacy");
const legacyManifest = JSON.stringify({ projectId: legacyId, slug: "legacy", siteType: "STORE", publishedAt: now, assetIds: [] });
db.prepare("UPDATE site_publish_versions SET manifest_json=? WHERE site_project_id=?").run(legacyManifest, legacyId);

// Public-sites router with a counting, lazily created real ecommerce service.
const lazy = { created: 0, listCalls: [] };
const countingEcommerce = () => {
  lazy.created += 1;
  const real = createEcommerceService({ db });
  return { ...real, listProducts: (id) => { lazy.listCalls.push(id); return real.listProducts(id); } };
};
const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter({ authService: {}, nodeEnv: "test", exposeDevelopmentOtp: false }));
app.use(createPublicSitesRouter({ repository, createEcommerceService: countingEcommerce }));
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const get = async (path) => { const res = await fetch(base + path); return { status: res.status, html: await res.text() }; };
const published = (id) => repository.getPublishedPublic(id);

// --- A) capability context per site type -----------------------------------

test("A: runtime capability context per site type; booking/courses stay unregistered", () => {
  const expected = {
    [storeId]: ["core", "commerce", "payments", "forms"],
    [businessId]: ["core", "forms", "blog", "people"],
    [medicalId]: ["core", "forms", "blog"],
  };
  for (const [id, capabilities] of Object.entries(expected)) {
    const context = publishedCapabilityContext(published(id));
    assert.equal(context.source, "manifest");
    assert.deepEqual(context.capabilities, capabilities);
    assert.deepEqual(draftCapabilityContext(published(id).project).capabilities, capabilities, "draft context agrees");
  }
  assert.deepEqual(publishedCapabilityContext(published(storeId)).sectionTypes, ["commerce.productShelf", "core.trust"]);
  assert.equal(draftCapabilityContext(published(storeId).project).source, "draft");

  const pending = resolveCapabilities({ siteType: "MEDICAL" }, { websitePlatform: { capabilities: ["booking", "courses", "lead"] } });
  assert.deepEqual(pending.unregistered, ["booking", "courses"]);
  for (const id of [storeId, businessId, medicalId]) {
    const { capabilities } = publishedCapabilityContext(published(id));
    assert.ok(!capabilities.includes("booking") && !capabilities.includes("courses"));
  }
});

test("A: the commerce decision is STORE-only for every site type", () => {
  for (const siteType of ["STORE", "store", "BUSINESS", "MEDICAL", "LEGAL", "NEWS", undefined]) {
    assert.equal(commerceEnabled({ siteType }), String(siteType || "").toUpperCase() === "STORE", String(siteType));
  }
  assert.equal(commerceEnabled(null), false);
});

// --- E) lazy commerce (runs first: counts start at zero) --------------------

test("E: no ecommerce at startup or for non-STORE sites; created once on the first STORE request", async () => {
  assert.equal(lazy.created, 0, "router construction creates no ecommerce service");
  for (const id of [businessId, medicalId, convertedId]) assert.equal((await get(`/sites/${id}`)).status, 200);
  assert.equal(lazy.created, 0, "BUSINESS/MEDICAL (and a store converted to BUSINESS) never create it");
  assert.deepEqual(lazy.listCalls, []);

  await get(`/sites/${storeId}`);
  await get(`/sites/${storeId}`);
  assert.equal(lazy.created, 1, "created once and reused");
  assert.deepEqual(lazy.listCalls, [storeId, storeId]);
});

// --- B) published STORE later changed to BUSINESS ------------------------------

test("B: a store changed to BUSINESS after publishing loads no products on either route", async () => {
  const live = published(convertedId);
  assert.ok(live.version.manifest.capabilities.includes("commerce"), "the stored manifest still says commerce");
  assert.equal(commerceEnabled(live.project), false, "the current siteType wins");

  const before = lazy.listCalls.length;
  const direct = await get(`/sites/${convertedId}`);
  assert.equal(direct.status, 200);
  assert.equal(lazy.listCalls.length, before, "public-sites made no ecommerce call");
  assert.doesNotMatch(direct.html, /Product converted/);

  // listProducts throws NOT_STORE_PROJECT for a non-STORE project and sendLegacySite
  // does not catch it, so a 200 proves no ecommerce call was made.
  const viaAuth = await get(`/api/auth/sites/${convertedId}`);
  assert.equal(viaAuth.status, 200);
  assert.doesNotMatch(viaAuth.html, /Product converted/);
});

// --- C) pre-v2 manifest ---------------------------------------------------------

test("C: a pre-v2 manifest resolves by fallback and the row is never rewritten", async () => {
  const live = published(legacyId);
  assert.equal(live.version.manifest.manifestVersion, undefined);
  assert.deepEqual(publishedCapabilityContext(live), { capabilities: ["core", "commerce", "payments", "forms"], sectionTypes: ["commerce.productShelf", "core.trust"], source: "derived" });

  const before = lazy.listCalls.length;
  const direct = await get(`/sites/${legacyId}`);
  const viaAuth = await get(`/api/auth/sites/${legacyId}`);
  assert.equal(direct.status, 200);
  assert.equal(viaAuth.status, 200);
  assert.deepEqual(lazy.listCalls.slice(before), [legacyId], "the STORE catalog still loads");
  assert.match(direct.html, /Product legacy/);
  assert.match(viaAuth.html, /Product legacy/);
  assert.equal(db.prepare("SELECT manifest_json FROM site_publish_versions WHERE site_project_id=?").get(legacyId).manifest_json, legacyManifest);
});

// --- D) entry parity ------------------------------------------------------------

test("D: public-sites and auth.sendLegacySite make the same capability and commerce decisions with the same renderer inputs", async () => {
  const normalize = (html) => html.replaceAll("/api/auth/sites/", "/sites/");
  for (const id of [storeId, businessId, medicalId, convertedId, legacyId]) {
    const direct = await get(`/sites/${id}`);
    const viaAuth = await get(`/api/auth/sites/${id}`);
    assert.equal(direct.status, 200, id);
    assert.equal(viaAuth.status, 200, id);
    // Same project, version, assets, slug and products reach renderPublishedSite on
    // both routes; only basePath differs by design.
    assert.equal(normalize(viaAuth.html), normalize(direct.html), `renderer inputs match for ${id}`);
    const loadsCatalog = commerceEnabled(published(id).project);
    assert.equal(/Product (store|legacy)/.test(direct.html), loadsCatalog && id !== convertedId);
  }
});

// --- error behavior ----------------------------------------------------------------

test("public-sites keeps catalog failure => [] (listing or lazy creation)", async () => {
  const failing = express();
  failing.use(createPublicSitesRouter({ repository, ecommerceService: { listProducts: () => { throw new Error("catalog down"); } } }));
  failing.use("/factory", createPublicSitesRouter({ repository, createEcommerceService: () => { throw new Error("init failed"); } }));
  const srv = failing.listen(0, "127.0.0.1");
  await once(srv, "listening");
  const url = `http://127.0.0.1:${srv.address().port}`;
  const originalError = console.error;
  console.error = () => {};
  try {
    for (const path of [`/sites/${storeId}`, `/factory/sites/${storeId}`]) {
      const res = await fetch(url + path);
      assert.equal(res.status, 200, path);
      assert.doesNotMatch(await res.text(), /Product store/);
    }
  } finally {
    console.error = originalError;
    srv.close();
  }
});
