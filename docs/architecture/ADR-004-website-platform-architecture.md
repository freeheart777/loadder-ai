# ADR-004 Loadder Website Platform Architecture

## Status

Proposed

## Context

The V16 Website Builder models websites as fixed types:

- Frontend: `SITE_TYPES` / `SiteKind` in `src/components/store-studio-v16/site-types.ts`
- Server: `ARCHETYPE_BY_SITE_TYPE` → `CAPABILITIES_BY_ARCHETYPE` in `server/app/services/website-platform-definition.mjs`

Capabilities already exist (`SiteCapability`, `hasCapability()`, `allowsSectionType()`) but are derived from the type.

Rendering dispatches by type (`isCorporateV16` / `isStoreV16` in `server/app/routes/public-sites.mjs`).

The public server always constructs `createEcommerceService()`, even for non-commerce sites.

Loadder must serve many business domains without a new site type per industry.

## Decision

A website is **Website Core + a set of enabled Capabilities**.

Site types are removed as a runtime concept. They survive only as **presets** that seed capabilities and default sections at creation time.

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

Capability catalogue (initial):

| Capability | Owns |
|---|---|
| `payments` | provider activation, payment attempts (existing 086/087) |
| `commerce` | products, cart, orders, ledger (existing 049/072) |
| `forms` | forms, submissions → CRM (generalizes `site-lead-service`) |
| `crm` | contacts linkage for forms / bookings / orders |
| `blog` | posts, categories |
| `people` | staff profiles (doctor, instructor, lawyer, team member) |
| `booking` | services, availability, appointments |
| `courses` | courses, lessons, enrollments |
| `seo` | advanced SEO (sitemaps, structured data); basic SEO stays in Core |

`people` is shared: DoctorProfile, InstructorProfile and LawyerProfile are sections over one entity, not separate domains.

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
nav, seo
pages[]: { id, slug, seo, sections[] }
sections[]: { id, type: "<capability>.<section>", props, variant, visibility }
```

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

Site ↔ capability persistence:

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
| core | Hero, RichText, Gallery, FAQ, Contact, CTA, Testimonials, Map |
| commerce | ProductGrid, ProductDetail, Cart★, Checkout★ |
| blog | PostList, PostDetail, Categories |
| people | StaffProfile (Doctor / Instructor / Lawyer variants), StaffGrid |
| booking | ServiceList, AppointmentCalendar★ |
| courses | CourseList, CourseDetail, InstructorProfile |
| forms | FormBlock★ |

★ interactive (client island).

The existing corporate and store `sectionHtml()` renderers become the `core` and `commerce` section renderers.

## 5. Publish Manifest

Publishing produces an immutable snapshot plus a manifest.

```
Builder → Publish → Snapshot + Manifest → Public Runtime → Domain → Customer
```

Manifest (stored with the publish version, 043):

```
{
  siteId, versionId, builtAt,
  capabilities: ["core", "blog", "booking", "payments"],
  sectionTypes: ["core.hero", "booking.appointmentCalendar", ...],
  islands:      ["booking.appointmentCalendar"],
  themeHash,
  pages: [{ slug, sectionTypes }]
}
```

Rules:

- The public runtime serves only published snapshots, never drafts (drafts only via preview token, 045).
- The manifest is computed at publish time from the document; it is never edited by hand.
- Publishing validates that every section type belongs to an enabled capability.
- Rollback = re-pointing the live version to an earlier snapshot.

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
- `public-site-server.mjs` stops constructing `createEcommerceService()` eagerly.
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
| Ecommerce (retail store) | core, commerce, payments, blog, crm, seo | Hero, ProductGrid, ProductDetail, Cart, Checkout, PostList |
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
- Existing sites need a backfill: archetype → `site_capabilities` rows.
- Retiring older studio versions requires confirming none are still routed.

## Migration Strategy

Gated PRs, in order:

1. Decisions and cleanup (single studio, remove unused runtime).
2. Capability + section contract; wrap existing core/commerce sections. No behavior change.
3. `site_capabilities` table; presets seed it; backfill from archetype.
4. Public renderer dispatches through the section registry (HTML snapshot parity tests).
5. Publish manifest + capability-based loading in the public runtime.
6. Editor: registry palette, drag and drop, floating panel, iframe preview.
7. New capabilities: forms → blog → people + booking → courses.
8. AI-assisted editing layer.

Migration numbers are assigned at implementation time (coordinate with ADR-003 subscription migrations).

## Related

- ADR-002 Subscription Payments
- ADR-003 Subscription Domain Model
- `docs/WEBSITE_BUILDER_V16_AUDIT.md`
