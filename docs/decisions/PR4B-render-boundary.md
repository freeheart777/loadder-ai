# PR4B — Render Boundary

## Status

Accepted (2026-09-25). Implements ADR-004 phase 4 for dispatch only. Builds on PR4A (`server/app/site-platform/section-runtime.mjs`, commit `661dba4`).

## Current rendering architecture

```
renderPublishedSite(project, version, assets, page, products)      routes/public-sites.mjs
  ├─ isCorporateV16(project, content)  → renderCorporateSite()       services/corporate-site-html.mjs
  ├─ isStoreV16(project, content)      → renderStoreSite()           services/store-site-html.mjs
  └─ else siteType === "STORE" ? storefront() : genericSite()        legacy, in public-sites.mjs
```

| Concern | Corporate | Store | Legacy |
|---|---|---|---|
| Selected when | `BUSINESS` + any corporate type in top-level or page sections | `STORE` + non-empty top-level `sections` | everything else |
| Section source | `projectPublicStorePresentation(content, { preserveSectionIds: true, includeCommerce: false })` → `readPages()` → one page by slug | `projectPublicStorePresentation(content)` → top-level `sections` only; pages ignored | no sections (assets + `content.sections` strings) |
| Limits | 50 pages, 100 sections per page | 100 sections | 10 string headings |
| Disabled | `enabled !== false` (non-boolean `enabled` is dropped by the projection ⇒ rendered) | same | n/a |
| Non-object entry | projected to `{}` ⇒ rendered through the unknown fallback with empty type | same | n/a |
| Dispatch | `sectionHtml(section)` if-chain on `section.type` | `sectionHtml(section, products, commerce)` if-chain on `section.type` | none |
| Types owned | `spacer`, `about`/`text-image`, `services`/`team`/`portfolio`, `cta`, `contact` | `spacer`, `products`, `banner`, `trust`, `category-grid`/`brand` | — |
| Unknown fallback | `open + head + (body ? <p class="body">) + close` | `open + <h2>title</h2> + (subtitle ? <p class="muted">) + close` | — |
| Section id in HTML | `id="${anchorOf(section)}"` = `anchor` or stored `id` (sanitized) | **no id attribute**; the projection replaces ids with `public-section-N` (never exposed) | — |
| Page id | `readPages` assigns `page-N` (the projection drops stored page ids) | single page | — |
| Spacer | `<div style="height:…">`, no `data-section-type` | same | — |

Manifest interaction: `publish-manifest.mjs` counts top-level **and** page sections (known over-report for mixed documents). Renderers never read the manifest. PR4B does not change manifest generation.

## Decision

Render functions are **not** placed in `capabilities.mjs` (or anywhere in `site-platform/`). The flow is:

```
section-runtime            (site-platform, read-only model)
      │
      ▼
type resolution            (registry aliases: legacy type ⇄ canonical type)
      │
      ▼
renderer dispatch table    (inside each renderer file, keyed by the stored legacy type)
      │
      ▼
existing render functions  (bodies unchanged)
```

The PR3 boundary stays in force: renderers import nothing from `site-platform/`, and `site-platform` runtime imports no renderer. The two sides meet only through the **stored legacy type string**, which is the existing storage contract. An agreement test composes them: every section the runtime model resolves maps (via the registry alias) to a key in the owning renderer's dispatch table, and every table key is a registry alias.

## What moves into section-runtime

Nothing new in PR4B. Section walking, limits, enabled semantics, alias resolution, capability ownership and known/unknown classification already live in `section-runtime.mjs` (PR4A) as a read-only model. It remains unused by renderers.

## What stays inside the renderer layer

- The dispatch table (`Map` from legacy type → render function) for each renderer, exported read-only for agreement tests.
- Every render function body, byte-for-byte.
- The per-renderer unknown fallback (corporate: body; store: subtitle).
- Spacer handling (no `data-section-type`).
- Section projection (`projectPublicStorePresentation`), page reading (`readPages`), id handling (corporate anchors; store `public-section-N` never emitted), limits, enabled filter.
- Legacy renderers (`storefront`, `genericSite`) — not touched at all.

## What must never change (in PR4B)

- HTML output of every committed baseline in `server/test/__snapshots__/site-render-baseline/` and `server/test/__snapshots__/site-render-baseline-edge/` — byte-identical; never regenerated.
- Dispatch keys are the stored legacy strings; stored and published documents are never rewritten.
- Lookup is by exact own key (`Map`), so types such as `toString`, `constructor`, `__proto__` keep falling through to the unknown fallback (covered by the edge baselines).
- Evaluation order: shared values (`style`, `open`, `close`, `head`, `columns`) are computed exactly as before; the sale clock read in the store `products` renderer is unchanged.
- Renderers import nothing from `site-platform/`; `capabilities.mjs` carries no render functions.
- `renderPublishedSite`, `isCorporateV16`, `isStoreV16`, routes, the manifest and the frontend are unchanged.

## Verification

- `npm test` (server) and both baseline suites green, with no file under `__snapshots__/` modified.
- Edge baselines (`site-render-baseline-edge.test.mjs`) captured from the renderers **before** any dispatch change, covering unknown, prototype-named and non-object types, the 100-section limit, leftover top-level sections, mixed-case slugs, hidden/empty pages.
