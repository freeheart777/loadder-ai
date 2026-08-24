import { decodeCursor } from "../query/cursor-pagination.mjs";
import {
  LANDING_VERSIONS,
  landingHash,
  validateLandingBlueprint,
} from "../landing/landing-contracts.mjs";
import {
  createWebsiteVisualBindings,
  splitWebsiteBlueprint,
  validateWebsiteVisualBindings,
  WEBSITE_VISUAL_DESCRIPTOR_FIELD,
} from "../website/website-visual-revision.mjs";
import {
  assertCustomerVisualSelection,
  customerVisualCatalog,
} from "../website/website-visual-selection.mjs";
import { recommendWebsiteVisual } from "../website/website-visual-recommendation.mjs";
const roles = new Set(["owner", "admin", "member"]),
  types = new Set([
    "CORPORATE",
    "PROFESSIONAL_SERVICE",
    "MEDICAL",
    "LEGAL",
    "SERVICE",
    "CATALOG",
  ]),
  pageTypes = new Set([
    "HOME",
    "ABOUT",
    "SERVICES",
    "SERVICE_DETAIL",
    "CONTACT",
    "FAQ",
    "BLOG_INDEX",
    "CUSTOM_PAGE",
  ]),
  plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  safeTheme = (v) =>
    plain(v) &&
    Object.keys(v).every((k) =>
      [
        "font",
        "primaryColor",
        "secondaryColor",
        "backgroundColor",
        "foregroundColor",
        "mutedColor",
        "radius",
        "spacingDensity",
        "buttonStyle",
        "containerWidth",
      ].includes(k),
    ) &&
    [
      "primaryColor",
      "secondaryColor",
      "backgroundColor",
      "foregroundColor",
      "mutedColor",
    ].every((k) => /^#[0-9a-fA-F]{6}$/.test(v[k])) &&
    ["brand", "sans", "serif"].includes(v.font) &&
    ["compact", "comfortable", "spacious"].includes(v.spacingDensity) &&
    ["solid", "outline", "soft"].includes(v.buttonStyle) &&
    ["narrow", "standard", "wide"].includes(v.containerWidth) &&
    ["sm", "md", "lg", "pill"].includes(v.radius);
export class WebsiteError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
const fail = (c, s) => {
    throw new WebsiteError(c, s);
  },
  key = (v) => {
    if (typeof v !== "string" || !v.trim() || v.length > 200)
      fail("WEBSITE_INVALID");
    return v.trim();
  },
  permission = (a) => {
    if (!a?.userId || !roles.has(a.role))
      fail("WEBSITE_PERMISSION_DENIED", 403);
  },
  strict = (v, allowed) =>
    plain(v) && Object.keys(v).every((k) => allowed.includes(k)),
  slug = (v) =>
    typeof v === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) &&
    v.length <= 80,
  path = (v) =>
    typeof v === "string" &&
    /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)?$/.test(v) &&
    v.length <= 160;
export function createWebsiteService({
  repository,
  contextRepository,
  placementRepository,
  assetRepository,
  catalogRepository = null,
  componentRegistry,
  presetRegistry,
  publisher,
  visualRegistry,
  now = () => new Date(),
}) {
  const project = (id) =>
      repository.findProject(id) || fail("WEBSITE_NOT_FOUND", 404),
    page = (id) =>
      repository.findPage(id) || fail("WEBSITE_PAGE_NOT_FOUND", 404),
    blueprint = (id) =>
      repository.findBlueprint(id) || fail("WEBSITE_BLUEPRINT_NOT_FOUND", 404),
    hash = landingHash,
    persistBlueprint = (pg, p, value, supersedes, actor, rawKey) => {
      if (JSON.stringify(value.designTokens) !== JSON.stringify(p.theme))
        fail("WEBSITE_THEME_MISMATCH");
      for (const section of value.sections) {
        const catalogId = section.props.catalogId,
          productId = section.props.productId,
          categoryId = section.props.categoryId,
          collectionId = section.props.collectionId;
        if (
          catalogId !== undefined &&
          (!catalogRepository ||
            typeof catalogId !== "string" ||
            !catalogRepository.findCatalog(catalogId))
        )
          fail("COMMERCE_CATALOG_NOT_FOUND", 404);
        if (
          productId !== undefined &&
          (!catalogRepository ||
            typeof productId !== "string" ||
            !catalogRepository.findProduct(productId))
        )
          fail("COMMERCE_PRODUCT_NOT_FOUND", 404);
        if (
          categoryId !== undefined &&
          (!catalogRepository ||
            typeof categoryId !== "string" ||
            !catalogRepository.findCategory(categoryId))
        )
          fail("COMMERCE_CATEGORY_NOT_FOUND", 404);
        if (
          collectionId !== undefined &&
          (!catalogRepository ||
            typeof collectionId !== "string" ||
            !catalogRepository.findCollection(collectionId))
        )
          fail("COMMERCE_COLLECTION_NOT_FOUND", 404);
        for (const b of section.contentBindings)
          if (!placementRepository.findById(b.creativePlacementId))
            fail("CREATIVE_PLACEMENT_NOT_FOUND", 404);
        for (const b of section.assetBindings) {
          const asset = assetRepository.findById(b.contentAssetId);
          if (!asset || asset.status !== "READY")
            fail("CONTENT_ASSET_NOT_FOUND", 404);
        }
      }
      const normalized = {
          websiteProjectId: p.id,
          websitePageId: pg.id,
          blueprint: value,
          supersedesBlueprintId: supersedes,
          ...LANDING_VERSIONS,
        },
        result = repository.createBlueprint({
          ...normalized,
          userId: actor.userId,
          locale: p.locale,
          direction: p.direction,
          key: key(rawKey),
          contentHash: hash(value),
          requestHash: hash(normalized),
          now: now().toISOString(),
        });
      if (!result.created && result.value.requestHash !== hash(normalized))
        fail("WEBSITE_IDEMPOTENCY_CONFLICT", 409);
      return { blueprint: result.value, reusedResult: !result.created };
    };
  return Object.freeze({
    readiness() {
      return Object.freeze({
        websiteAuthoringReady: true,
        websitePreviewReady: true,
        websitePublicationConfigured: publisher.configured,
        websiteAiGenerationReady: false,
        websiteCommerceReady: Boolean(catalogRepository),
      });
    },
    presets() {
      return { presets: presetRegistry.list() };
    },
    createProject(input, actor, rawKey) {
      permission(actor);
      if (
        !strict(input, [
          "name",
          "slug",
          "websiteType",
          "presetId",
          "businessContextVersionId",
          "locale",
          "direction",
          "theme",
        ]) ||
        typeof input.name !== "string" ||
        !input.name.trim() ||
        input.name.length > 200 ||
        !slug(input.slug) ||
        !types.has(input.websiteType) ||
        typeof input.businessContextVersionId !== "string" ||
        !contextRepository.getVersion(input.businessContextVersionId) ||
        !safeTheme(input.theme) ||
        input.locale !== "fa-IR" ||
        input.direction !== "rtl"
      )
        fail("WEBSITE_INVALID");
      const preset = presetRegistry.get(input.presetId);
      if (!preset || preset.websiteType !== input.websiteType)
        fail("WEBSITE_PRESET_INVALID");
      const normalized = {
          name: input.name.trim(),
          slug: input.slug,
          websiteType: input.websiteType,
          presetId: preset.presetId,
          presetVersion: preset.presetVersion,
          businessContextVersionId: input.businessContextVersionId,
          locale: input.locale,
          direction: input.direction,
          theme: input.theme,
        },
        result = repository.createProject({
          ...normalized,
          userId: actor.userId,
          key: key(rawKey),
          requestHash: hash(normalized),
          now: now().toISOString(),
        });
      if (!result.created && result.value.requestHash !== hash(normalized))
        fail("WEBSITE_IDEMPOTENCY_CONFLICT", 409);
      return { website: result.value, reusedResult: !result.created };
    },
    listProjects(query, actor) {
      permission(actor);
      if (
        Object.keys(query || {}).some((k) => !["limit", "cursor"].includes(k))
      )
        fail("WEBSITE_INVALID");
      const limit = query?.limit === undefined ? 20 : Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        fail("WEBSITE_INVALID");
      let cursor;
      try {
        cursor = decodeCursor(query?.cursor, "website_projects", [
          "updatedAt",
          "id",
        ]);
      } catch {
        fail("WEBSITE_INVALID");
      }
      const r = repository.listProjects({ limit, cursor });
      return { websites: r.items, nextCursor: r.nextCursor };
    },
    getProject(id, actor) {
      permission(actor);
      return { website: project(id) };
    },
    createPage(projectId, input, actor, rawKey) {
      permission(actor);
      const p = project(projectId);
      if (
        !strict(input, [
          "pageType",
          "name",
          "path",
          "navigationVisible",
          "navigationOrder",
        ]) ||
        !pageTypes.has(input.pageType) ||
        typeof input.name !== "string" ||
        !input.name.trim() ||
        input.name.length > 160 ||
        !path(input.path) ||
        typeof input.navigationVisible !== "boolean" ||
        !Number.isInteger(input.navigationOrder) ||
        input.navigationOrder < 0 ||
        input.navigationOrder > 1000
      )
        fail("WEBSITE_INVALID");
      const normalized = {
          websiteProjectId: p.id,
          pageType: input.pageType,
          name: input.name.trim(),
          path: input.path,
          navigationVisible: input.navigationVisible,
          navigationOrder: input.navigationOrder,
        },
        result = repository.createPage({
          ...normalized,
          userId: actor.userId,
          key: key(rawKey),
          requestHash: hash(normalized),
          now: now().toISOString(),
        });
      if (!result.created && result.value.requestHash !== hash(normalized))
        fail("WEBSITE_IDEMPOTENCY_CONFLICT", 409);
      return { page: result.value, reusedResult: !result.created };
    },
    listPages(projectId, actor) {
      permission(actor);
      project(projectId);
      return { pages: repository.listPages(projectId) };
    },
    createBlueprint(pageId, input, actor, rawKey) {
      permission(actor);
      const pg = page(pageId),
        p = project(pg.websiteProjectId);
      if (!strict(input, ["blueprint", "supersedesBlueprintId"]))
        fail("WEBSITE_INVALID");
      const supersedes =
        input.supersedesBlueprintId ?? pg.currentDraftBlueprintId ?? null;
      if (supersedes !== null && blueprint(supersedes).websitePageId !== pg.id)
        fail("WEBSITE_BLUEPRINT_NOT_FOUND", 404);
      let value;
      try {
        value = validateLandingBlueprint(input.blueprint, componentRegistry);
      } catch {
        fail("WEBSITE_BLUEPRINT_INVALID");
      }
      if (supersedes) {
        const source = blueprint(supersedes),
          { bindings } = splitWebsiteBlueprint(source.blueprint),
          sectionIds = new Set(value.sections.map((section) => section.id)),
          preserved = bindings.filter((binding) =>
            sectionIds.has(binding.sectionId),
          );
        try {
          validateWebsiteVisualBindings(value, preserved, {
            registry: visualRegistry,
          });
        } catch (error) {
          fail(error?.code || "WEBSITE_BLUEPRINT_INVALID");
        }
        if (preserved.length)
          value = { ...value, [WEBSITE_VISUAL_DESCRIPTOR_FIELD]: preserved };
      }
      return persistBlueprint(pg, p, value, supersedes, actor, rawKey);
    },
    visualCatalog(projectId, actor) {
      permission(actor);
      project(projectId);
      return {
        components: customerVisualCatalog({ registry: visualRegistry }),
      };
    },
    visualRecommendation(projectId, pageId, sectionId, input, actor) {
      permission(actor);
      const p = project(projectId),
        pg = page(pageId);
      if (
        pg.websiteProjectId !== p.id ||
        !strict(input, ["baseRevisionId"]) ||
        typeof input.baseRevisionId !== "string"
      )
        fail("WEBSITE_INVALID");
      if (pg.currentDraftBlueprintId !== input.baseRevisionId)
        fail("VISUAL_REVISION_CONFLICT", 409);
      const source = blueprint(input.baseRevisionId);
      if (source.websitePageId !== pg.id)
        fail("WEBSITE_BLUEPRINT_NOT_FOUND", 404);
      try {
        return {
          recommendation: recommendWebsiteVisual({
            websiteId: p.id,
            pageId: pg.id,
            sectionId,
            baseRevisionId: source.id,
            blueprint: source.blueprint,
            registry: visualRegistry,
            generatedAt: now().toISOString(),
          }),
        };
      } catch (error) {
        fail(
          error?.code || "VISUAL_RECOMMENDATION_UNAVAILABLE",
          error?.code ? 404 : 503,
        );
      }
    },
    changeSectionVisual(projectId, pageId, sectionId, input, actor, rawKey) {
      permission(actor);
      const p = project(projectId),
        pg = page(pageId);
      if (pg.websiteProjectId !== p.id) fail("WEBSITE_PAGE_NOT_FOUND", 404);
      if (
        !strict(input, [
          "action",
          "baseRevisionId",
          "componentId",
          "componentVersion",
          "props",
        ]) ||
        !["APPLY", "REPLACE", "REMOVE"].includes(input.action) ||
        typeof input.baseRevisionId !== "string"
      )
        fail("WEBSITE_INVALID");
      if (pg.currentDraftBlueprintId !== input.baseRevisionId)
        fail("VISUAL_REVISION_CONFLICT", 409);
      const source = blueprint(input.baseRevisionId);
      if (source.websitePageId !== pg.id)
        fail("WEBSITE_BLUEPRINT_NOT_FOUND", 404);
      const { landingBlueprint, bindings } = splitWebsiteBlueprint(
          source.blueprint,
        ),
        section = landingBlueprint.sections.find(
          (item) => item.id === sectionId,
        );
      if (!section) fail("WEBSITE_SECTION_NOT_FOUND", 404);
      const existing = bindings.find((item) => item.sectionId === sectionId),
        rest = bindings.filter((item) => item.sectionId !== sectionId);
      if (input.action === "APPLY" && existing)
        fail("VISUAL_ACTION_STATE_INVALID", 409);
      if (["REPLACE", "REMOVE"].includes(input.action) && !existing)
        fail("VISUAL_ACTION_STATE_INVALID", 409);
      let requests = rest.map((item) => ({
        sectionId: item.sectionId,
        componentId: item.descriptor.componentId,
        componentVersion: item.descriptor.componentVersion,
        props: item.descriptor.props,
        assetRefs: item.descriptor.assetRefs,
      }));
      if (input.action !== "REMOVE") {
        if (
          typeof input.componentId !== "string" ||
          !Number.isInteger(input.componentVersion) ||
          (input.props !== undefined &&
            (!plain(input.props) || Object.keys(input.props).length > 8))
        )
          fail("WEBSITE_INVALID");
        try {
          const policy = assertCustomerVisualSelection(
            input.componentId,
            input.componentVersion,
            section.componentId,
            { registry: visualRegistry },
          );
          requests.push({
            sectionId,
            componentId: input.componentId,
            componentVersion: input.componentVersion,
            props: { ...policy.defaults, ...(input.props ?? {}) },
            assetRefs: [],
          });
        } catch (error) {
          fail(error?.code || "VISUAL_COMPONENT_NOT_AVAILABLE");
        }
      }
      let nextBindings;
      try {
        nextBindings = createWebsiteVisualBindings(landingBlueprint, requests, {
          registry: visualRegistry,
        });
      } catch (error) {
        fail(
          error?.code || "WEBSITE_BLUEPRINT_INVALID",
          error?.code?.includes("BUDGET") ||
            error?.code?.includes("RESTRICTION")
            ? 409
            : 400,
        );
      }
      const result = persistBlueprint(
          pg,
          p,
          {
            ...landingBlueprint,
            [WEBSITE_VISUAL_DESCRIPTOR_FIELD]: nextBindings,
          },
          source.id,
          actor,
          rawKey,
        ),
        binding =
          nextBindings.find((item) => item.sectionId === sectionId) || null;
      return {
        ...result,
        visual: binding && {
          sectionId,
          componentId: binding.descriptor.componentId,
          componentVersion: binding.descriptor.componentVersion,
          props: binding.descriptor.props,
        },
        contentHash: result.blueprint.contentHash,
      };
    },
    createVisualBlueprint(pageId, input, actor, rawKey) {
      permission(actor);
      const pg = page(pageId),
        p = project(pg.websiteProjectId);
      if (
        !strict(input, ["blueprint", "supersedesBlueprintId", "visualRequests"])
      )
        fail("WEBSITE_INVALID");
      const supersedes =
        input.supersedesBlueprintId ?? pg.currentDraftBlueprintId ?? null;
      if (supersedes !== null && blueprint(supersedes).websitePageId !== pg.id)
        fail("WEBSITE_BLUEPRINT_NOT_FOUND", 404);
      let value, bindings;
      try {
        value = validateLandingBlueprint(input.blueprint, componentRegistry);
        bindings = createWebsiteVisualBindings(value, input.visualRequests, {
          registry: visualRegistry,
        });
      } catch (error) {
        fail(error?.code || "WEBSITE_BLUEPRINT_INVALID");
      }
      return persistBlueprint(
        pg,
        p,
        { ...value, [WEBSITE_VISUAL_DESCRIPTOR_FIELD]: bindings },
        supersedes,
        actor,
        rawKey,
      );
    },
    cloneBlueprint(pageId, sourceBlueprintId, actor, rawKey) {
      permission(actor);
      const pg = page(pageId),
        p = project(pg.websiteProjectId),
        source = blueprint(sourceBlueprintId);
      if (source.websitePageId !== pg.id)
        fail("WEBSITE_BLUEPRINT_NOT_FOUND", 404);
      const { landingBlueprint, bindings } = splitWebsiteBlueprint(
        source.blueprint,
      );
      try {
        validateLandingBlueprint(landingBlueprint, componentRegistry);
        validateWebsiteVisualBindings(landingBlueprint, bindings, {
          registry: visualRegistry,
        });
      } catch (error) {
        fail(error?.code || "WEBSITE_BLUEPRINT_INVALID");
      }
      return persistBlueprint(
        pg,
        p,
        structuredClone(source.blueprint),
        source.id,
        actor,
        rawKey,
      );
    },
    listBlueprints(pageId, actor) {
      permission(actor);
      page(pageId);
      return { blueprints: repository.listBlueprints(pageId) };
    },
    publish(projectId, _input, actor, rawKey) {
      permission(actor);
      const p = project(projectId),
        pages = repository.listPages(p.id);
      if (!pages.length) fail("WEBSITE_PAGES_REQUIRED");
      const lineage = pages.map((pg) => {
          if (!pg.currentDraftBlueprintId) fail("WEBSITE_BLUEPRINT_REQUIRED");
          return { page: pg, blueprint: blueprint(pg.currentDraftBlueprintId) };
        }),
        artifact = publisher.publish({ project: p, pages: lineage }),
        normalized = {
          websiteProjectId: p.id,
          pageBlueprintIds: lineage.map((x) => x.blueprint.id),
        },
        requestHash = hash(normalized),
        at = now().toISOString(),
        result = repository.publish({
          websiteProjectId: p.id,
          userId: actor.userId,
          manifest: artifact.available
            ? artifact.manifest
            : { schemaVersion: 1, pages: [] },
          manifestHash: artifact.available
            ? artifact.manifestHash
            : hash({ schemaVersion: 1, pages: [] }),
          host: artifact.available ? artifact.host : null,
          basePath: artifact.available ? artifact.basePath : null,
          status: artifact.available ? "PUBLISHED" : "FAILED",
          failureCode: artifact.available ? null : artifact.failureCode,
          key: key(rawKey),
          requestHash,
          now: at,
        });
      if (!result.created && result.value.requestHash !== requestHash)
        fail("WEBSITE_IDEMPOTENCY_CONFLICT", 409);
      if (!artifact.available) fail("WEBSITE_PUBLICATION_UNAVAILABLE", 503);
      return {
        publication: result.value,
        publicUrl: publisher.publicUrl(result.value),
        reusedResult: !result.created,
      };
    },
  });
}
