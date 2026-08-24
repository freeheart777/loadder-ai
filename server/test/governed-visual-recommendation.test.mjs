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
import { createVisualPublicationDescriptor } from "../app/visual-publishing/visual-publisher-contract.mjs";
import {
  recommendWebsiteVisual,
  VISUAL_RECOMMENDATION_POLICY_VERSION,
} from "../app/website/website-visual-recommendation.mjs";

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
const section = (id, componentId) => ({
  id,
  componentId,
  version: 1,
  variant:
    componentId === "HERO"
      ? "CENTERED"
      : componentId === "CTA"
        ? "CENTERED"
        : componentId === "FOOTER"
          ? "MINIMAL"
          : "GRID",
  props:
    componentId === "HERO"
      ? {
          headline: id,
          body: "متن",
          primaryCta: {
            label: "رزرو",
            type: "BOOKING",
            target: "https://example.com/book",
          },
        }
      : componentId === "CTA"
        ? {
            heading: id,
            body: "متن",
            primaryCta: {
              label: "رزرو",
              type: "BOOKING",
              target: "https://example.com/book",
            },
          }
        : componentId === "FOOTER"
          ? { body: "پایان", items: ["پیوند"] }
          : { heading: id, items: ["مورد"] },
  contentBindings: [],
  assetBindings: [],
  trackingBindings: [],
});
const descriptor = (componentId, props = {}) =>
  createVisualPublicationDescriptor({
    componentId,
    componentVersion: 1,
    props,
    assetRefs: [],
  });
const blueprint = (sectionType = "HERO", bindings = []) => ({
  sections: [section("target", sectionType)],
  websiteVisualDescriptors: bindings,
  designTokens: theme,
});
const binding = (componentId, sectionId = "target", props = {}) => ({
  sectionId,
  descriptor: descriptor(componentId, props),
});
const input = (value, registry = visualComponentRegistry) => ({
  websiteId: "website",
  pageId: "page",
  sectionId: "target",
  baseRevisionId: "revision",
  blueprint: value,
  registry,
  generatedAt: "2026-08-24T19:00:00.000Z",
});
const recommend = (value, registry) =>
  recommendWebsiteVisual(input(value, registry));

function fixture() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  db.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE workspaces(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,role TEXT,status TEXT);CREATE TABLE business_context_versions(id TEXT PRIMARY KEY,workspace_id TEXT);CREATE TABLE creative_placements(id TEXT PRIMARY KEY,workspace_id TEXT);CREATE TABLE content_assets(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT);CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,applied_at TEXT);INSERT INTO users VALUES('user','active');INSERT INTO workspaces VALUES('workspace','active'),('other','active');INSERT INTO workspace_memberships VALUES('m','workspace','user','member','active');INSERT INTO business_context_versions VALUES('context','workspace');",
  );
  runMigrations(db, [migration058WebsiteBuilderFoundation]);
  const repository = createWebsiteRepository(db),
    publisher = createWebsitePublisher({
      landingPublisher: createLandingPublisher({ nodeEnv: "test" }),
      visualRegistry: visualComponentRegistry,
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
      visualRegistry: visualComponentRegistry,
      publisher,
      now: () => new Date("2026-08-24T19:00:00.000Z"),
    }),
    within = (fn) => runWithWorkspace(W, fn),
    project = within(() =>
      service.createProject(
        {
          name: "سایت",
          slug: "recommend-site",
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
    base = {
      goal: "حضور",
      offer: "معرفی",
      audienceSummary: "مخاطب",
      primaryCta: {
        label: "رزرو",
        type: "BOOKING",
        target: "https://example.com/book",
      },
      secondaryCta: null,
      seo: { title: "خانه", description: "توضیح" },
      socialPreview: {
        title: "خانه",
        description: "معرفی",
        imageAssetId: null,
      },
      sections: [section("target", "HERO")],
      designTokens: theme,
      tracking: { enabledActions: ["LANDING_VISIT"] },
      accessibility: { mainLabel: "خانه" },
    },
    revision = within(() =>
      service.createBlueprint(page.id, { blueprint: base }, actor, "base"),
    ).blueprint;
  return { db, service, within, project, page, revision };
}

test("Governed Visual Recommendation v1", async (t) => {
  await t.test(
    "policy is deterministic, versioned, code-owned, and AI-free",
    () => {
      assert.equal(
        VISUAL_RECOMMENDATION_POLICY_VERSION,
        "VISUAL_RECOMMENDATION_POLICY_V1",
      );
      const source = readFileSync(
        new URL(
          "../app/website/website-visual-recommendation.mjs",
          import.meta.url,
        ),
        "utf8",
      );
      assert.doesNotMatch(
        source,
        /OpenAI|embedding|vector|Math\.random|provider call/i,
      );
    },
  );
  await t.test("empty HERO recommends stable bounded Gradient ADD", () => {
    const r = recommend(blueprint());
    assert.equal(r.action, "ADD");
    assert.equal(r.candidate.componentId, "LOADDER_GRADIENT_FIELD");
    assert.deepEqual(r.candidate.props, {
      accentToken: "PRIMARY",
      intensity: "SUBTLE",
      variant: "HALO",
    });
    assert.match(r.recommendationFingerprint, /^[0-9a-f]{64}$/);
  });
  await t.test("CONTENT and FEATURES prefer structured Geometry", () => {
    for (const type of ["CONTENT", "FEATURES"]) {
      const r = recommend(blueprint(type));
      assert.equal(r.candidate.componentId, "LOADDER_GEOMETRIC_PATTERN");
      assert.equal(r.candidate.fitPosture, "STRONG");
    }
  });
  await t.test("CTA recommends only compatible Glow", () => {
    const r = recommend(blueprint("CTA"));
    assert.equal(r.action, "ADD");
    assert.equal(r.candidate.componentId, "LOADDER_GLOW_BANDS");
    assert.deepEqual(r.candidate.props, {
      accentToken: "PRIMARY",
      intensity: "BALANCED",
      orientation: "HORIZONTAL",
    });
  });
  await t.test("FORM and FOOTER return non-coercive NO_RECOMMENDATION", () => {
    for (const type of ["FORM_OR_ACTION", "FOOTER"]) {
      const r = recommend(blueprint(type));
      assert.equal(r.action, "NO_RECOMMENDATION");
      assert.equal(r.candidate, null);
    }
  });
  await t.test(
    "current strong visual yields KEEP and no write authority",
    () => {
      const r = recommend(
        blueprint("HERO", [
          binding("LOADDER_GRADIENT_FIELD", undefined, {
            variant: "HALO",
            intensity: "SUBTLE",
            accentToken: "PRIMARY",
          }),
        ]),
      );
      assert.equal(r.action, "KEEP");
      assert.equal(r.candidate.componentId, "LOADDER_GRADIENT_FIELD");
    },
  );
  await t.test("materially weak current visual yields REPLACE", () => {
    const r = recommend(
      blueprint("HERO", [
        binding("LOADDER_GEOMETRIC_PATTERN", undefined, {
          pattern: "DIAMONDS",
          density: "SPARSE",
          intensity: "SUBTLE",
          accentToken: "MUTED",
        }),
      ]),
    );
    assert.equal(r.action, "REPLACE");
    assert.equal(r.candidate.componentId, "LOADDER_GRADIENT_FIELD");
  });
  await t.test("marginal or tied advantage keeps current choice", () => {
    const r = recommend(
      blueprint("HERO", [
        binding("LOADDER_GLOW_BANDS", undefined, {
          orientation: "DIAGONAL",
          intensity: "SUBTLE",
          accentToken: "SECONDARY",
        }),
      ]),
    );
    assert.equal(r.action, "KEEP");
  });
  await t.test(
    "current component made ineligible yields REMOVE with factual reasons",
    () => {
      const r = recommend(
        blueprint("FOOTER", [binding("LOADDER_GRADIENT_FIELD")]),
      );
      assert.equal(r.action, "REMOVE");
      assert.ok(r.reasonCodes.includes("CURRENT_VISUAL_NO_LONGER_ELIGIBLE"));
    },
  );
  await t.test("page density is bounded and at-limit state never ADDs", () => {
    const bindings = [
        binding("LOADDER_GRADIENT_FIELD", "a"),
        binding("LOADDER_GLOW_BANDS", "b"),
        binding("LOADDER_GEOMETRIC_PATTERN", "c"),
        binding("LOADDER_GRADIENT_FIELD", "d"),
      ],
      r = recommend(blueprint("HERO", bindings));
    assert.equal(r.constraints.visualDensity, "AT_LIMIT");
    assert.notEqual(r.action, "ADD");
  });
  await t.test(
    "already-used components are hard-filtered before ranking",
    () => {
      const r = recommend(
        blueprint("HERO", [binding("LOADDER_GRADIENT_FIELD", "other")]),
      );
      assert.notEqual(r.candidate?.componentId, "LOADDER_GRADIENT_FIELD");
      assert.equal(
        r.alternatives.some((x) => x.componentId === "LOADDER_GRADIENT_FIELD"),
        false,
      );
    },
  );
  await t.test("revoked catalog produces no eligible recommendation", () => {
    const revoked = createVisualComponentRegistry([
        {
          ...gradientFieldManifest,
          securityPosture: {
            ...gradientFieldManifest.securityPosture,
            remoteCode: true,
          },
        },
      ]),
      r = recommend(blueprint(), revoked);
    assert.equal(r.action, "NO_RECOMMENDATION");
    assert.equal(r.candidate, null);
  });
  await t.test(
    "all primary and alternative props pass the current manifest validator",
    () => {
      for (const type of ["HERO", "CONTENT", "FEATURES", "CTA"]) {
        const r = recommend(blueprint(type));
        for (const item of [r.candidate, ...r.alternatives].filter(Boolean))
          assert.doesNotThrow(() => descriptor(item.componentId, item.props));
      }
    },
  );
  await t.test(
    "alternatives are bounded, eligible, stable, and never include pilot",
    () => {
      const a = recommend(blueprint()),
        b = recommend(blueprint());
      assert.ok(a.alternatives.length <= 2);
      assert.deepEqual(a.alternatives, b.alternatives);
      assert.equal(JSON.stringify(a).includes("LOADDER_DOT_MATRIX"), false);
    },
  );
  await t.test(
    "same canonical input has stable action, candidate, reasons, alternatives, fingerprint",
    () => {
      const first = recommend(blueprint());
      for (let i = 0; i < 100; i++) {
        const next = recommend(blueprint());
        for (const key of [
          "action",
          "candidate",
          "alternatives",
          "reasonCodes",
          "recommendationFingerprint",
        ])
          assert.deepEqual(next[key], first[key]);
      }
    },
  );
  await t.test(
    "stable priority resolves equal HERO fit without randomness",
    () => {
      const r = recommend(blueprint("HERO"));
      assert.equal(r.candidate.componentId, "LOADDER_GRADIENT_FIELD");
      assert.equal(r.alternatives[0].componentId, "LOADDER_GLOW_BANDS");
    },
  );
  await t.test(
    "service derives canonical context, rejects forged fields, and creates no row",
    () => {
      const f = fixture(),
        before = f.db
          .prepare("SELECT count(*) count FROM website_page_blueprint_versions")
          .get().count,
        out = f.within(() =>
          f.service.visualRecommendation(
            f.project.id,
            f.page.id,
            "target",
            { baseRevisionId: f.revision.id },
            actor,
          ),
        ).recommendation;
      assert.equal(out.action, "ADD");
      assert.equal(
        f.db
          .prepare("SELECT count(*) count FROM website_page_blueprint_versions")
          .get().count,
        before,
      );
      assert.throws(
        () =>
          f.within(() =>
            f.service.visualRecommendation(
              f.project.id,
              f.page.id,
              "target",
              { baseRevisionId: f.revision.id, sectionType: "CTA" },
              actor,
            ),
          ),
        (e) => e.code === "WEBSITE_INVALID",
      );
    },
  );
  await t.test("tenant, role, section, and stale revision fail closed", () => {
    const f = fixture();
    assert.throws(
      () =>
        runWithWorkspace("other", () =>
          f.service.visualRecommendation(
            f.project.id,
            f.page.id,
            "target",
            { baseRevisionId: f.revision.id },
            actor,
          ),
        ),
      (e) => e.code === "WEBSITE_NOT_FOUND",
    );
    assert.throws(
      () =>
        f.within(() =>
          f.service.visualRecommendation(
            f.project.id,
            f.page.id,
            "target",
            { baseRevisionId: f.revision.id },
            { userId: "user", role: "viewer" },
          ),
        ),
      (e) => e.code === "WEBSITE_PERMISSION_DENIED",
    );
    assert.throws(
      () =>
        f.within(() =>
          f.service.visualRecommendation(
            f.project.id,
            f.page.id,
            "missing",
            { baseRevisionId: f.revision.id },
            actor,
          ),
        ),
      (e) => e.code === "WEBSITE_SECTION_NOT_FOUND",
    );
    const newer = f.within(() =>
      f.service.createBlueprint(
        f.page.id,
        {
          blueprint: f.revision.blueprint,
          supersedesBlueprintId: f.revision.id,
        },
        actor,
        "newer",
      ),
    ).blueprint;
    assert.throws(
      () =>
        f.within(() =>
          f.service.visualRecommendation(
            f.project.id,
            f.page.id,
            "target",
            { baseRevisionId: f.revision.id },
            actor,
          ),
        ),
      (e) => e.code === "VISUAL_REVISION_CONFLICT",
    );
    assert.ok(newer.id);
  });
  await t.test(
    "recommendation apply still uses governed selection and stale/revoked apply fails",
    () => {
      const f = fixture(),
        r = f.within(() =>
          f.service.visualRecommendation(
            f.project.id,
            f.page.id,
            "target",
            { baseRevisionId: f.revision.id },
            actor,
          ),
        ).recommendation,
        applied = f.within(() =>
          f.service.changeSectionVisual(
            f.project.id,
            f.page.id,
            "target",
            {
              action: "APPLY",
              baseRevisionId: r.baseRevisionId,
              componentId: r.candidate.componentId,
              componentVersion: r.candidate.componentVersion,
              props: r.candidate.props,
            },
            actor,
            "apply",
          ),
        ).blueprint;
      assert.equal(applied.version, 2);
      assert.throws(
        () =>
          f.within(() =>
            f.service.changeSectionVisual(
              f.project.id,
              f.page.id,
              "target",
              {
                action: "APPLY",
                baseRevisionId: r.baseRevisionId,
                componentId: r.candidate.componentId,
                componentVersion: r.candidate.componentVersion,
                props: r.candidate.props,
              },
              actor,
              "stale",
            ),
          ),
        (e) => e.code === "VISUAL_REVISION_CONFLICT",
      );
    },
  );
  await t.test(
    "frontend card is optional Persian RTL-safe and calls existing mutation path",
    () => {
      const card = readFileSync(
          new URL(
            "../../src/components/website/VisualRecommendationCard.tsx",
            import.meta.url,
          ),
          "utf8",
        ),
        page = readFileSync(
          new URL("../../src/pages/WebsiteBuilderPage.tsx", import.meta.url),
          "utf8",
        );
      for (const text of [
        "پیشنهاد طراحی",
        "انتخاب فعلی مناسب است",
        "نادیده گرفتن",
        "اعمال پیشنهاد",
      ])
        assert.match(card, new RegExp(text));
      assert.match(page, /changeVisual/);
      assert.doesNotMatch(
        page,
        /recommendation\/apply|AI recommendation|هوش مصنوعی پیشنهاد/,
      );
    },
  );
  await t.test(
    "100,000 bounded evaluations remain deterministic and cheap",
    () => {
      const value = blueprint(),
        start = performance.now();
      let last;
      for (let i = 0; i < 100_000; i++) last = recommend(value);
      const elapsed = performance.now() - start;
      assert.ok(elapsed < 10_000);
      assert.equal(last.action, "ADD");
      t.diagnostic(
        JSON.stringify({
          evaluations: 100_000,
          totalMs: Number(elapsed.toFixed(3)),
          meanMs: Number((elapsed / 100_000).toFixed(6)),
          contextBytes: last.contextBytes,
        }),
      );
    },
  );
});
