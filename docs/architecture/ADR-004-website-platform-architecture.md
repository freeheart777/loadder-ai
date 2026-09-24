# ADR-004 Loadder Website Platform Architecture

## Status

Proposed

## Context

The V16 Website Builder models websites as fixed types:

- Frontend: `SITE_TYPES` / `SiteKind` in `src/components/store-studio-v16/site-types.ts`
- Server: `ARCHETYPE_BY_SITE_TYPE` → `CAPABILITIES_BY_ARCHETYPE` in `server/app/services/website-platform-definition.mjs`

Capabilities already exist and are **already persisted per site**: `ensureWebsitePlatformContent()` writes `content.websitePlatform.capabilities`, seeded from the archetype at creation and preserved afterwards. Frontend helpers (`SiteCapability`, `hasCapability()`, `allowsSectionType()`) exist too.

The gap is that **the runtime ignores them**: rendering dispatches by `siteType` + section types (`isCorporateV16` / `isStoreV16` in `server/app/routes/public-sites.mjs`), and commerce is gated by `siteType === "STORE"`.

The public server constructs `createEcommerceService()` eagerly at startup, though it only queries it for STORE sites.

Verified against source on 2026-09-24 (see "Verification Findings").

Loadder must serve many business domains without a new site type per industry.

## Decision

A website is **Website Core + enabled Capabilities + selected Sections + Theme**.

Site types are removed as a runtime concept. They are replaced by **experience presets**.

### Experience Presets

A preset is a starting point, not a type:

```
Preset = { capabilities[], starter pages + section lists, theme defaults }
```

- Presets are applied once, at creation (e.g. "Online store", "Clinic", "Music academy", "Law firm", "Corporate").
- One preset may offer several starter layouts (e.g. two store homepages from the same "Online store" preset).
- After creation, the site's own capability list, sections and theme are the only truth. Changing a preset later never changes existing sites.
- Existing `siteType` / archetype values act as legacy presets through the resolver (see Capability Storage Decision).

## 1. Capability-First Model

Capabilities are stored data, owned by the site, not derived from a type.

```
Website = Core + [capability, capability, ...]
```

Rules:

- A site may enable any combination of capabilities.
- Capabilities declare dependencies (`commerce` requires `payments`; `booking` optionally uses `payments`).
- Enabling a capability never modifies Core.
- Disabling a capability hides its sections and routes; its data is retained.
- Presets (`store`, `clinic`, `academy`, …) are creation templates only. After creation, the site's capability list is the only truth.

Capability catalogue and mapping from existing names (`CAPABILITIES_BY_ARCHETYPE`):

| ADR capability | Existing name(s) | Owns |
|---|---|---|
| `payments` | — (new) | provider activation, payment attempts (existing 086/087) |
| `commerce` | `commerce`, `catalog` | products, cart, orders, ledger (existing 049/072) |
| `campaigns` | — (new); **requires `commerce`** | flash sales, scheduled promos, discount pricing |
| `forms` | `forms`, `lead` | forms, submissions (generalizes `site-lead-service`) |
| `crm` | `lead` (contact side) | contact linkage for forms / bookings / orders |
| `blog` | `content` | posts, categories |
| `people` | `team` | staff profiles (doctor, instructor, lawyer, team member) |
| `booking` | `booking` | services, availability, appointments |
| `courses` | — (new) | courses, lessons, enrollments |
| `seo` | — (new) | sitemaps, structured data; basic SEO stays in Core |
| Core (not a capability) | `landing`, `location` | landing pages; location = a core section (Map/Contact) |
| Out of website runtime | `analytics`, `ads` | integrations; never loaded by the public runtime |

The resolver normalizes existing names to ADR names on read. Stored documents are not rewritten.

### Capability Storage Decision

V1 storage is the existing `content.websitePlatform.capabilities` array. No new table, no migration.

Resolution order (`resolveCapabilities(project, content)`):

1. `content.websitePlatform.capabilities` (normalized via the mapping above)
2. otherwise archetype defaults from `siteType`
3. always: `siteType === "STORE"` ⇒ `commerce` (preserves current behavior)

A dedicated `site_capabilities` table is **deferred** until per-capability config or cross-site querying is actually needed.

`people` is shared: DoctorProfile, InstructorProfile and LawyerProfile are sections over one entity, not separate domains.

Brand storytelling (`story.*`: brandStory, values, lifestyleCollection, logoWall) is **not a capability**. Story sections have no data or services and belong to Core.

## 2. Core Website Engine

Core is always present and has zero dependency on any capability or on AI.

| Concern | Owner |
|---|---|
| Pages, slugs, navigation, basic SEO | `site-page-model.mjs` (existing) |
| Sections (core set) | Core capability manifest |
| Theme | Theme tokens (colors, fonts, radius, spacing), split out of `DesignConfig` |
| Assets | Site media library (existing 046) |
| Editing | V16 patch engine + document revisions (existing 090/091) |
| Publishing | Site project service / repository `publish()` (existing 043) |
| Domains, preview | Existing 044 / 045 |
| Public runtime | `public-site-server.mjs` (existing, refactored per §6) |

Site document shape:

```
theme:   { tokens }
chrome:  { utilityBar, header, categoryNav, footer }
nav, seo
pages[]: { id, slug, seo, sections[] }
sections[]: { id, type: "<capability>.<section>", variant, props, data, style, visibility }
```

### Site Chrome vs Page Sections

Site chrome (utility bar, header, category nav, footer) is **separate from page sections**:

- One instance per site, rendered on every page; not draggable, not part of `pages[].sections`.
- Edited through site settings (Header / Footer), not the section palette.
- Capabilities contribute **slots** to chrome instead of sections (e.g. `commerce` adds the cart slot to the header; `forms` adds a newsletter slot to the footer).
- Current `header` / `footer` config under `content.storeBuilderV16` maps to chrome; no document rewrite.

## 3. Capability Registry

Every capability is a self-contained module implementing one contract:

```
defineCapability({
  key,
  requires: [],
  optional: [],
  sections: [ ...section definitions ],
  server: { services, publicRoutes, merchantRoutes, loaders },
  client: { editors, islands },
  migrations: [ ... ]
})
```

Layout:

```
shared:  site-capabilities/<key>/manifest.mjs     (contract; importable by server and Vite)
server:  server/app/site-capabilities/<key>/      render, services, routes, loaders
client:  src/site-capabilities/<key>/             inspector editors, interactive islands
```

Rules:

- Capability services follow the existing `createXService({ db })` pattern and call `requireWorkspaceId()`.
- Capability tables carry `workspace_id` and are created by the capability's own migrations, registered in `server/db/migrations/index.mjs` at the next free number.
- A capability may depend on another only through that capability's service contract, never its tables.
- Paid capabilities (booking, courses, subscriptions) create normal orders and reuse the existing attempt → verification → ledger path. No parallel payment flows.
- Existing commerce/payments code is wrapped as capabilities; it is not rewritten.

Site ↔ capability persistence: see "Capability Storage Decision" (§1). Future table, when needed:

```
site_capabilities (site_id, workspace_id, capability_key, enabled, config_json, version)
UNIQUE (site_id, capability_key)
```

## 4. Section Registry

Capabilities contribute sections. The registry is the union of sections from enabled capabilities.

```
defineSection({
  type: "<capability>.<name>",
  schema,        // props validation (used by patch engine and AI)
  defaults,
  variants,      // layout options; responsive by construction
  interactive,   // true → requires a client island
  render,        // server HTML renderer
})
```

Registry operations:

- `allowedSections(site)` → section types of enabled capabilities (editor palette)
- `renderSection(section, ctx)` → HTML
- `validateSection(section)` → used by the patch engine for every edit

Section catalogue (initial):

| Capability | Sections |
|---|---|
| core | Hero, BannerGroup, CategoryGrid, FeatureList, Trust, RichText, Gallery, FAQ, Contact, CTA, Testimonials, Map |
| core (story) | BrandStory, Values, LifestyleCollection, LogoWall |
| commerce | ProductShelf, CategoryShelf, ProductDetail, Cart★, Checkout★ |
| campaigns | FlashSale★, PromoBanner |
| blog | PostList, PostDetail, Categories |
| people | StaffProfile (Doctor / Instructor / Lawyer variants), StaffGrid |
| booking | ServiceList, AppointmentCalendar★ |
| courses | CourseList, CourseDetail, InstructorProfile |
| forms | FormBlock★ |

★ interactive (client island).

The existing corporate and store `sectionHtml()` renderers become the `core` and `commerce` section renderers.

Existing section types are plain strings (`about`, `services`, `team`, `portfolio`, `text-image`, `cta`, `contact`, `spacer`) under `content.storeBuilderV16`. Namespaced types are **aliases**: `about` ≡ `core.about`. Stored and published documents are never rewritten (rollback copies old content verbatim).

## 5. Publish Manifest

Publishing produces an immutable snapshot plus a manifest.

```
Builder → Publish → Snapshot + Manifest → Public Runtime → Domain → Customer
```

`site_publish_versions.manifest_json` **already exists**. Current content (written by `repository.publish()`):

```
{ projectId, slug, siteType, contextVersionId, publishedAt, assetIds }
```

The manifest is **extended additively** (no migration):

```
{
  ...existing fields,
  manifestVersion: 2,
  capabilities: ["core", "blog", "booking", "payments"],
  sectionTypes: ["core.hero", "booking.appointmentCalendar", ...],
  islands:      ["booking.appointmentCalendar"],
  themeHash,
  pages: [{ slug, sectionTypes }]
}
```

Manifests without `manifestVersion: 2` (all versions published before this change) are resolved at runtime via `resolveCapabilities()`.

Rules:

- The public runtime serves published versions, never drafts (drafts only via preview token, 045).
- The manifest is computed at publish time from the document; it is never edited by hand.
- Publishing validates that every section type belongs to an enabled capability.

### Rollback Model

Rollback is **copy-forward**, not re-pointing. `rollbackPublishVersion()` creates a new version whose content copies the target, with `manifest.rollbackOfVersionId`. The live version is always the highest `version`. The v2 manifest fields are recomputed for the new version.

### Asset Snapshot Limitation

Content is snapshotted; **assets are not**. `getPublishedPublic()` loads all current `site_assets` for the project and ignores `manifest.assetIds`. Effects:

- Legacy renderers (`storefront`, `genericSite`) display current assets, not published ones.
- V16 renderers use URLs embedded in content, so they are unaffected unless an asset is deleted from storage.
- Store products are always live (`ecommerceService.listProducts`); this is intended.

Accepted for V1. Freezing assets (filtering by `manifest.assetIds`, retaining referenced storage objects) is a later phase.

## 6. Public Runtime Architecture

```
request(host)
  → normalizeHost → site_domains (044) → live publish version
  → runWithWorkspace(workspace)
  → load manifest
  → loadCapabilities(manifest.capabilities)   // dynamic import(), cached per process
  → mount only those capabilities' public routes
  → render page: registry.renderSection() per section → HTML
  → attach only the islands listed for this page
```

Rules:

- **Capability-based loading.** A site without `commerce` never imports commerce services, routes or client code.
- `public-site-server.mjs` stops constructing `createEcommerceService()` eagerly; it is imported on the first commerce-site request.
- The commerce gate changes from `siteType === "STORE"` to "resolved capabilities include `commerce`". The resolver guarantees today's STORE behavior is preserved.
- Core rendering must not depend on store modules. `renderCorporateSite` currently uses `projectPublicStorePresentation(..., { includeCommerce: false })`; this is replaced by a neutral presentation function.
- Legacy renderers (`storefront`, `genericSite`) remain as fallbacks for projects with no V16 document; they are not moved into the registry.
- **One renderer.** Server HTML is the single source of truth. The editor preview renders the same output (iframe + preview token). The unused `server/app/services/site-public-runtime.mjs` is removed.
- Interactive features (cart, checkout, booking calendar, forms) are client islands, lazy-loaded per page.
- Public process has no builder and no AI imports.
- Tenant isolation via `runWithWorkspace()` on every request.

## 7. Drag and Drop Editor Architecture

Built on the V16 studio (`StoreWebsiteStudioPageV16Core`, `StudioCanvas`, `InspectorPanel`). Other studio versions (V1/V2/V3/V15, Visual, SiteProject) are retired.

```
┌──────────────────────────────────────────────┐
│  Live preview (iframe, real public renderer) │
│    ┌───────────────┐                         │
│    │ Floating panel│  Tabs: Sections │ Style │ Page
│    │  - palette    │                         │
│    │  - inspector  │                         │
│    │  - Ask Loadder│                         │
│    └───────────────┘                         │
│  Device toggle: desktop / tablet / mobile    │
└──────────────────────────────────────────────┘
```

Rules:

- Users drag **sections**, not pixels. Drop targets are slots between sections.
- Palette = `allowedSections(site)`; enabling a capability extends the palette.
- Every interaction (add, move, edit, delete) becomes a structured patch validated by the patch engine and section schema; revisions provide undo.
- Responsive by default: layout comes from section variants and theme tokens. No per-breakpoint editing.
- Inspector forms are generated from section schema, with optional custom editors per capability.
- **AI-assisted editing is an optional layer.** It lives in a separate module (existing `v16-instruction-translator`), emits patches only, and every patch is previewed before applying. The editor is fully functional without AI.

## 8. Multi-Domain Examples

Domains are capability combinations plus a preset. No domain-specific code in Core.

| Domain | Capabilities | Typical sections |
|---|---|---|
| Ecommerce (retail store) | core, commerce, payments, blog, crm, seo (+ campaigns) | Hero, BannerGroup, ProductShelf, BrandStory, Trust, FlashSale, Cart, Checkout, PostList |
| Medical (clinic) | core, people, booking, forms, payments, blog | Hero, StaffGrid (Doctor), AppointmentCalendar, FormBlock (intake), FAQ |
| Legal (law firm) | core, people, booking, forms, crm, blog | Hero, StaffProfile (Lawyer), ServiceList, AppointmentCalendar (consultation), FormBlock (case intake) |
| Education (music academy) | core, courses, people, booking, commerce, payments, blog | CourseList, InstructorProfile, AppointmentCalendar (trial lesson), ProductGrid, PostList |
| Corporate | core, forms, blog, seo | Hero, RichText, Testimonials, PostList, Contact, FormBlock |

A corporate site loads no commerce, booking or payment code at runtime.

## Consequences

Positive:

- New domains require no new site type and usually no new code: only a preset.
- New capabilities are additive and isolated.
- Public sites load only what they use.
- Editor preview and public output cannot drift.

Negative / costs:

- Renderer migration (type dispatch → registry) touches public output; requires HTML snapshot tests of existing sites.
- No backfill needed: existing sites already carry `websitePlatform.capabilities`; old manifests are handled by the resolver.
- Retiring older studio versions requires confirming none are still routed.

## Verification Findings

Verified against `public-sites.mjs`, `website-platform-definition.mjs`, `site-project-repository.mjs`, `public-site-server.mjs`, `corporate-site-html.mjs`.

Confirmed: type-based dispatch; eager commerce construction; standalone host-routed public process (`site_domains.status='ACTIVE'`); transactional content snapshot on publish; hashed, non-cached preview tokens; domain-neutral page model; no builder/AI imports in the public process.

Corrected in this ADR: capability storage already exists; `manifest_json` already exists; rollback is copy-forward; assets are not snapshotted; capability names differ; core renderer depends on store presentation.

Open issue (outside this ADR): `/preview/sites/:id` on the public server calls `getPreviewByToken()` → `requireWorkspaceId()` without `runWithWorkspace`. Likely returns 500 on the standalone public server; confirm in `tenant-context.mjs`.

## Implementation Order

Gated PRs. Phases 1–6 need **no database migration**.

1. **Capability resolver.** Pure `resolveCapabilities(project, content)` + name mapping + STORE ⇒ commerce rule. Unit tests only.
2. **Manifest v2.** `publish()` and `rollbackPublishVersion()` write `manifestVersion`, `capabilities`, `sectionTypes`. Additive JSON.
3. **Capability-gated commerce.** Public router gates on resolved capabilities; `public-site-server.mjs` lazy-imports `ecommerce-service`. Test: a corporate site loads no commerce module.
4. **Section registry (corporate first).** HTML snapshot tests of existing published versions first; then `sectionHtml()` if-chain → `{ type: render }` map with namespaced aliases; byte-identical output. Then store renderer.
5. **Neutral core presentation.** Remove the corporate renderer's dependency on `projectPublicStorePresentation`.
6. **Cleanup.** Single studio (V16Core); remove unused `site-public-runtime.mjs`.
7. **Editor.** Registry palette, drag and drop, floating panel, iframe preview.
8. **New capabilities.** forms → blog → people + booking → courses (these introduce migrations; numbers assigned at implementation time, coordinated with ADR-003).
9. **Asset freezing.** Serve only `manifest.assetIds`.
10. **AI-assisted editing layer.**

The preview workspace-context issue is fixed independently, before phase 1 if confirmed.

## Related

- ADR-002 Subscription Payments
- ADR-003 Subscription Domain Model
- `docs/architecture/WEBSITE_COMPONENT_ARCHITECTURE.md` (component registry, section schema, builder UX)
- `docs/design-references/ecommerce-pattern-analysis.md`
- `docs/WEBSITE_BUILDER_V16_AUDIT.md`
