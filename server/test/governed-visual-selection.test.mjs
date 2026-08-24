import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { runMigrations } from "../db/migrate.mjs";
import { migration058WebsiteBuilderFoundation } from "../db/migrations/058_website_builder_foundation.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createWebsiteRepository } from "../app/repositories/website-repository.mjs";
import { createWebsiteService } from "../app/services/website-service.mjs";
import { landingComponentRegistry } from "../app/landing/landing-component-registry.mjs";
import { createLandingPublisher } from "../app/landing/landing-publisher.mjs";
import { createWebsitePublisher } from "../app/website/website-publisher.mjs";
import { websitePresetRegistry } from "../app/website/website-preset-registry.mjs";
import {
  createVisualComponentRegistry,
  gradientFieldManifest,
  visualComponentRegistry,
} from "../app/visual-components/visual-component-registry.mjs";
import { customerVisualCatalog } from "../app/website/website-visual-selection.mjs";

const W = "workspace",
  actor = { userId: "user", role: "member" },
  theme = {
    font: "brand",
    primaryColor: "#6633ff",
    secondaryColor: "#111122",
    backgroundColor: "#050510",
    foregroundColor: "#ffffff",
    mutedColor: "#aaaabb",
    radius: "lg",
    spacingDensity: "comfortable",
    buttonStyle: "solid",
    containerWidth: "standard",
  };
const cta = {
  label: "رزرو",
  type: "BOOKING",
  target: "https://example.com/book",
};
const section = (id, componentId) => {
  const contract = {
    HERO: {
      variant: "CENTERED",
      props: { headline: id, body: "متن معتبر", primaryCta: cta },
    },
    FEATURES: { variant: "GRID", props: { heading: id, items: ["مورد اول"] } },
    CTA: {
      variant: "CENTERED",
      props: { heading: id, body: "متن معتبر", primaryCta: cta },
    },
    FOOTER: { variant: "MINIMAL", props: { body: "پایان", items: ["پیوند"] } },
  }[componentId];
  return {
    id,
    componentId,
    version: 1,
    ...contract,
    contentBindings: [],
    assetBindings: [],
    trackingBindings: [],
  };
};
const pageBlueprint = () => ({
  goal: "حضور پایدار",
  offer: "معرفی خدمات",
  audienceSummary: "مخاطب",
  primaryCta: cta,
  secondaryCta: null,
  seo: { title: "خانه", description: "توضیح معتبر" },
  socialPreview: { title: "خانه", description: "معرفی", imageAssetId: null },
  sections: [
    section("hero", "HERO"),
    section("features", "FEATURES"),
    section("cta", "CTA"),
    section("footer", "FOOTER"),
  ],
  designTokens: theme,
  tracking: { enabledActions: ["LANDING_VISIT"] },
  accessibility: { mainLabel: "خانه" },
});
const within = (fn) => runWithWorkspace(W, fn);
function fixture(registry = visualComponentRegistry) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  db.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE workspaces(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,role TEXT,status TEXT);CREATE TABLE business_context_versions(id TEXT PRIMARY KEY,workspace_id TEXT);CREATE TABLE creative_placements(id TEXT PRIMARY KEY,workspace_id TEXT);CREATE TABLE content_assets(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT);CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,applied_at TEXT);INSERT INTO users VALUES('user','active');INSERT INTO workspaces VALUES('workspace','active'),('other','active');INSERT INTO workspace_memberships VALUES('m','workspace','user','member','active');INSERT INTO business_context_versions VALUES('context','workspace');",
  );
  runMigrations(db, [migration058WebsiteBuilderFoundation]);
  const repository = createWebsiteRepository(db),
    landingPublisher = createLandingPublisher({ nodeEnv: "test" }),
    publisher = createWebsitePublisher({
      landingPublisher,
      visualRegistry: registry,
    }),
    service = createWebsiteService({
      repository,
      contextRepository: {
        getVersion: (id) => (id === "context" ? { id } : null),
      },
      placementRepository: { findById: () => null },
      assetRepository: { findById: () => null },
      componentRegistry: landingComponentRegistry,
      presetRegistry: websitePresetRegistry,
      visualRegistry: registry,
      publisher,
      now: () => new Date("2026-08-24T16:00:00.000Z"),
    });
  const project = within(() =>
      service.createProject(
        {
          name: "سایت",
          slug: "governed-site",
          websiteType: "MEDICAL",
          presetId: "CLINIC",
          businessContextVersionId: "context",
          locale: "fa-IR",
          direction: "rtl",
          theme,
        },
        actor,
        "site",
      ),
    ).website,
    page = within(() =>
      service.createPage(
        project.id,
        {
          pageType: "HOME",
          name: "خانه",
          path: "/",
          navigationVisible: true,
          navigationOrder: 0,
        },
        actor,
        "page",
      ),
    ).page,
    revision = within(() =>
      service.createBlueprint(
        page.id,
        { blueprint: pageBlueprint() },
        actor,
        "base",
      ),
    ).blueprint;
  return { db, service, publisher, project, page, revision };
}
const change = (f, revision, sectionId, action, componentId, props, key) =>
  within(() =>
    f.service.changeSectionVisual(
      f.project.id,
      f.page.id,
      sectionId,
      {
        action,
        baseRevisionId: revision.id,
        ...(componentId ? { componentId, componentVersion: 1, props } : {}),
      },
      actor,
      key,
    ),
  ).blueprint;

test("Governed Visual Selection Workflow v1", async (t) => {
  await t.test(
    "customer catalog exposes exactly three safe production primitives",
    () => {
      const items = customerVisualCatalog();
      assert.deepEqual(
        items.map((x) => x.componentId),
        [
          "LOADDER_GRADIENT_FIELD",
          "LOADDER_GLOW_BANDS",
          "LOADDER_GEOMETRIC_PATTERN",
        ],
      );
      assert.equal(JSON.stringify(items).includes("fingerprint"), false);
      assert.equal(JSON.stringify(items).includes("LOADDER_DOT_MATRIX"), false);
    },
  );
  await t.test(
    "catalog is authenticated and tenant scoped through Website authority",
    () => {
      const f = fixture();
      assert.equal(
        within(() => f.service.visualCatalog(f.project.id, actor)).components
          .length,
        3,
      );
      assert.throws(
        () =>
          runWithWorkspace("other", () =>
            f.service.visualCatalog(f.project.id, actor),
          ),
        (e) => e.code === "WEBSITE_NOT_FOUND",
      );
      assert.throws(
        () =>
          within(() =>
            f.service.visualCatalog(f.project.id, {
              userId: "user",
              role: "viewer",
            }),
          ),
        (e) => e.code === "WEBSITE_PERMISSION_DENIED",
      );
    },
  );
  await t.test(
    "APPLY creates one immutable child revision with canonical defaults",
    () => {
      const f = fixture(),
        next = change(
          f,
          f.revision,
          "hero",
          "APPLY",
          "LOADDER_GRADIENT_FIELD",
          {},
          "apply",
        );
      assert.equal(next.supersedesBlueprintId, f.revision.id);
      assert.equal(next.version, 2);
      assert.equal(
        next.blueprint.websiteVisualDescriptors[0].descriptor.props.variant,
        "AURORA",
      );
      assert.equal(f.revision.blueprint.websiteVisualDescriptors, undefined);
    },
  );
  await t.test("REPLACE is explicit and preserves semantic content", () => {
    const f = fixture(),
      a = change(
        f,
        f.revision,
        "hero",
        "APPLY",
        "LOADDER_GRADIENT_FIELD",
        {},
        "a",
      ),
      b = change(
        f,
        a,
        "hero",
        "REPLACE",
        "LOADDER_GLOW_BANDS",
        {
          orientation: "HORIZONTAL",
          accentToken: "SECONDARY",
          intensity: "BALANCED",
        },
        "b",
      );
    assert.equal(b.blueprint.websiteVisualDescriptors.length, 1);
    assert.equal(
      b.blueprint.websiteVisualDescriptors[0].descriptor.componentId,
      "LOADDER_GLOW_BANDS",
    );
    assert.deepEqual(b.blueprint.sections, a.blueprint.sections);
    assert.equal(
      a.blueprint.websiteVisualDescriptors[0].descriptor.componentId,
      "LOADDER_GRADIENT_FIELD",
    );
  });
  await t.test(
    "REMOVE creates one child revision and clean zero-visual state",
    () => {
      const f = fixture(),
        a = change(
          f,
          f.revision,
          "hero",
          "APPLY",
          "LOADDER_GRADIENT_FIELD",
          {},
          "a",
        ),
        b = change(f, a, "hero", "REMOVE", null, null, "remove");
      assert.deepEqual(b.blueprint.websiteVisualDescriptors, []);
      assert.equal(a.blueprint.websiteVisualDescriptors.length, 1);
    },
  );
  await t.test("action-state mismatches fail before write", () => {
    const f = fixture();
    assert.throws(
      () =>
        change(
          f,
          f.revision,
          "hero",
          "REPLACE",
          "LOADDER_GRADIENT_FIELD",
          {},
          "bad",
        ),
      (e) => e.code === "VISUAL_ACTION_STATE_INVALID",
    );
    assert.equal(
      within(() => f.service.listBlueprints(f.page.id, actor)).blueprints
        .length,
      1,
    );
  });
  await t.test("section compatibility is conservative", () => {
    const f = fixture();
    assert.throws(
      () =>
        change(
          f,
          f.revision,
          "footer",
          "APPLY",
          "LOADDER_GRADIENT_FIELD",
          {},
          "bad",
        ),
      (e) => e.code === "VISUAL_SECTION_INCOMPATIBLE",
    );
  });
  await t.test(
    "same-component and one-per-section restrictions cannot be bypassed",
    () => {
      const f = fixture(),
        a = change(
          f,
          f.revision,
          "hero",
          "APPLY",
          "LOADDER_GRADIENT_FIELD",
          {},
          "a",
        );
      assert.throws(
        () =>
          change(
            f,
            a,
            "features",
            "APPLY",
            "LOADDER_GRADIENT_FIELD",
            {},
            "duplicate",
          ),
        (e) => e.code === "VISUAL_RESTRICTION_VIOLATION",
      );
      assert.throws(
        () => change(f, a, "hero", "APPLY", "LOADDER_GLOW_BANDS", {}, "stack"),
        (e) => e.code === "VISUAL_ACTION_STATE_INVALID",
      );
    },
  );
  await t.test(
    "bounded props and brand tokens reject unknown or injection payloads",
    () => {
      for (const props of [
        { accentToken: "UNKNOWN" },
        { intensity: "999" },
        { style: "url(https://evil.test)" },
        { variant: "<script>" },
      ]) {
        const f = fixture();
        assert.throws(() =>
          change(
            f,
            f.revision,
            "hero",
            "APPLY",
            "LOADDER_GRADIENT_FIELD",
            props,
            crypto.randomUUID(),
          ),
        );
      }
    },
  );
  await t.test(
    "direct pilot, fixture, LIGHT-like unknown, and forged versions stay unavailable",
    () => {
      for (const [id, version] of [
        ["LOADDER_DOT_MATRIX", 1],
        ["LOADDER_STATIC_DOT_FIELD", 1],
        ["LOADDER_LIGHT_FIELD", 1],
        ["LOADDER_GRADIENT_FIELD", 999],
      ]) {
        const f = fixture();
        assert.throws(
          () =>
            within(() =>
              f.service.changeSectionVisual(
                f.project.id,
                f.page.id,
                "hero",
                {
                  action: "APPLY",
                  baseRevisionId: f.revision.id,
                  componentId: id,
                  componentVersion: version,
                  props: {},
                },
                actor,
                crypto.randomUUID(),
              ),
            ),
          (e) => e.code === "VISUAL_COMPONENT_NOT_AVAILABLE",
        );
      }
    },
  );
  await t.test(
    "client descriptor authority and raw CSS keys are rejected",
    () => {
      const f = fixture();
      for (const extra of [
        { manifestFingerprint: "forged" },
        { runtimeTier: "STATIC" },
        { css: "body{}" },
      ])
        assert.throws(
          () =>
            within(() =>
              f.service.changeSectionVisual(
                f.project.id,
                f.page.id,
                "hero",
                {
                  action: "APPLY",
                  baseRevisionId: f.revision.id,
                  componentId: "LOADDER_GRADIENT_FIELD",
                  componentVersion: 1,
                  props: {},
                  ...extra,
                },
                actor,
                crypto.randomUUID(),
              ),
            ),
          (e) => e.code === "WEBSITE_INVALID",
        );
    },
  );
  await t.test("stale revision and foreign page identities fail closed", () => {
    const f = fixture(),
      a = change(
        f,
        f.revision,
        "hero",
        "APPLY",
        "LOADDER_GRADIENT_FIELD",
        {},
        "a",
      );
    assert.throws(
      () =>
        change(
          f,
          f.revision,
          "features",
          "APPLY",
          "LOADDER_GEOMETRIC_PATTERN",
          {},
          "stale",
        ),
      (e) => e.code === "VISUAL_REVISION_CONFLICT",
    );
    assert.throws(
      () =>
        runWithWorkspace("other", () =>
          f.service.changeSectionVisual(
            f.project.id,
            f.page.id,
            "hero",
            { action: "REMOVE", baseRevisionId: a.id },
            actor,
            "foreign",
          ),
        ),
      (e) => e.code === "WEBSITE_NOT_FOUND",
    );
  });
  await t.test(
    "normal semantic save preserves visuals and section deletion cleans bindings",
    () => {
      const f = fixture(),
        a = change(
          f,
          f.revision,
          "hero",
          "APPLY",
          "LOADDER_GRADIENT_FIELD",
          {},
          "a",
        ),
        edited = structuredClone(a.blueprint);
      edited.sections[0].props.heading = "عنوان تازه";
      delete edited.websiteVisualDescriptors;
      const b = within(() =>
        f.service.createBlueprint(
          f.page.id,
          { blueprint: edited, supersedesBlueprintId: a.id },
          actor,
          "edit",
        ),
      ).blueprint;
      assert.equal(b.blueprint.websiteVisualDescriptors.length, 1);
      const withoutHero = structuredClone(b.blueprint);
      delete withoutHero.websiteVisualDescriptors;
      withoutHero.sections = withoutHero.sections.filter(
        (x) => x.id !== "hero",
      );
      const c = within(() =>
        f.service.createBlueprint(
          f.page.id,
          { blueprint: withoutHero, supersedesBlueprintId: b.id },
          actor,
          "delete",
        ),
      ).blueprint;
      assert.equal(c.blueprint.websiteVisualDescriptors, undefined);
    },
  );
  await t.test(
    "publisher revalidates customer selection and emits deterministic static output",
    () => {
      const f = fixture(),
        a = change(
          f,
          f.revision,
          "hero",
          "APPLY",
          "LOADDER_GRADIENT_FIELD",
          { variant: "HALO", intensity: "BALANCED", accentToken: "PRIMARY" },
          "a",
        ),
        first = f.publisher.publish({
          project: f.project,
          pages: [{ page: f.page, blueprint: a }],
        }),
        second = f.publisher.publish({
          project: f.project,
          pages: [{ page: f.page, blueprint: a }],
        });
      assert.equal(first.manifestHash, second.manifestHash);
      assert.equal(first.manifest.pages[0].visualDescriptors.length, 1);
    },
  );
  await t.test(
    "current policy is re-resolved and revoked components disappear",
    () => {
      const revoked = createVisualComponentRegistry([
          {
            ...gradientFieldManifest,
            securityPosture: {
              ...gradientFieldManifest.securityPosture,
              remoteCode: true,
            },
          },
        ]),
        f = fixture(revoked);
      assert.deepEqual(
        within(() => f.service.visualCatalog(f.project.id, actor)).components,
        [],
      );
      assert.throws(
        () =>
          change(
            f,
            f.revision,
            "hero",
            "APPLY",
            "LOADDER_GRADIENT_FIELD",
            {},
            "blocked",
          ),
        (e) => e.code === "VISUAL_COMPONENT_NOT_AVAILABLE",
      );
    },
  );
  await t.test(
    "10,000 catalog projections and selection validations stay deterministic",
    () => {
      const start = performance.now();
      for (let i = 0; i < 10_000; i++) customerVisualCatalog();
      const elapsed = performance.now() - start;
      assert.ok(elapsed < 5000);
      assert.equal(customerVisualCatalog().length, 3);
      t.diagnostic(
        JSON.stringify({
          evaluations: 10_000,
          totalMs: Number(elapsed.toFixed(3)),
          meanMs: Number((elapsed / 10_000).toFixed(6)),
        }),
      );
    },
  );
  await t.test(
    "customer UI remains Persian-first, bounded, explicit, and pilot-free",
    () => {
      const selector = readFileSync(
          new URL(
            "../../src/components/website/VisualStyleSelector.tsx",
            import.meta.url,
          ),
          "utf8",
        ),
        builder = readFileSync(
          new URL("../../src/pages/WebsiteBuilderPage.tsx", import.meta.url),
          "utf8",
        );
      for (const text of [
        "سبک بصری",
        "اعمال سبک",
        "جایگزینی سبک",
        "حذف سبک",
        'role="radiogroup"',
        "aria-checked",
      ])
        assert.match(selector, new RegExp(text));
      assert.doesNotMatch(selector, /LOADDER_DOT_MATRIX|canvas|WebGL|raw CSS/i);
      assert.match(builder, /VISUAL_REVISION_CONFLICT/);
      assert.match(builder, /dir="rtl"/);
    },
  );
});
