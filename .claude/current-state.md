# Current State

Last updated: 2026-09-24, after environment-preparation + repo sync milestone.

## Git

- Branch: `main`
- HEAD: `570927aaee3f91072c3b76c101349625eef92501` (fast-forwarded from `cdd8005`, in sync with `origin/main`)
- Sync method used: `git fetch --all --prune` then `git merge --ff-only origin/main` — clean fast-forward, no conflicts.
- Removed: the corrupted untracked stub `src/pages/StoreWebsiteStudioPageV16.tsx` (contained one stray pasted shell command) before merging, since `origin/main` tracks a real file at that exact path and would otherwise have blocked the fast-forward.
- Still untracked in the working tree (unrelated to V16, left alone): `.continue/`, `LOADDER_*.txt`, `stitch_loadder_medical_booking_platform.zip`.

## Website Builder V16 — confirmed present on disk after sync

Frontend (`src/pages/`): `StoreWebsiteStudioPageV16.tsx`, `StoreWebsiteStudioPageV16Core.tsx`, `PublicStorefrontPage.tsx`, `CorporateWebsiteStudioPage.tsx`, `PublicCorporateSitePage.tsx`, plus the full version history `StoreWebsiteStudioPageV2`…`V15` and supporting commerce pages (`StoreAdminDashboardPage`, `StoreCatalogOperationsPage`, `StoreCommerceManagerPage(Core)`, `StoreFinancialsPage`, `StoreProductDetailPage`, `StoreQuickStartPage`, `StoreSetupWizardPage`, `StorefrontTestPage`, `VisualWebsiteStudioPage`).

Components: `src/components/store-studio-v16/` exists.

Backend: `server/app/commerce/` exists.

Docs: `docs/LOADDER_APP_BUILDER_COMMERCIAL_SPEC.md`, `docs/LOADDER_BUSINESS_BUILDER_LAUNCH_CHECKLIST.md`, `docs/LOADDER_BUSINESS_BUILDER_ROADMAP.md`, `docs/LOADDER_ENGINEERING_SYSTEM.md`, `docs/LOADDER_MASTER_ARCHITECTURE.md`, `docs/INLINE_MEDIA_INTERACTION.md`.

This directly supersedes the "V16 was never implemented" finding from earlier in this project's history — that was true only for the pre-fetch local checkout. See `decisions.md` for the full account.

## Latest merged V16 milestone

`codex/v16-component-contract-gate-03` (PR #249) — "Ask Loadder" natural-language section patches. This is the tip of `origin/main` as synced.

## Environment / tooling

- GitHub MCP access: confirmed working (`get_me`, `get_file_contents` both succeeded against `freeheart777/loadder-ai`).
- Filesystem access: native Read/Write/Edit/Bash tools; no dedicated Filesystem MCP server configured or needed — native tools cover it.
- No project-level or user-level `mcpServers` config exists for this repo (`~/.claude.json` has none for this project path); nothing was installed.

## Production audit (2026-09-24) — see `docs/WEBSITE_BUILDER_V16_AUDIT.md` for full detail

**Maturity estimate:** Core editor/persistence/patch-engine architecture is production-grade (append-only revisions, structured patches with a Commerce-truth allow-list, versioned publish+rollback). The commerce backend (`server/app/commerce/v2/*`: cart, checkout, pricing, promotions, inventory reservation, fulfillment, returns/refunds, customer accounts) is also substantial and API-complete. But the STORE side is **not yet commercially shippable**: the public SSR/custom-domain path for a STORE site (`public-sites.mjs`) renders a stale asset-only template that ignores the real V16 document and catalog entirely, and the in-editor checkout (`CheckoutCanvas`) is an unwired placeholder that never calls the real checkout API. Corporate (`BUSINESS`) sites are materially more production-ready (correct SSR, real per-page SEO) than commerce sites. Overall: **strong foundation, incomplete production wiring on the commerce/storefront-delivery side.**

**Next implementation gate (recommended, pending user decision):** Fix the STORE SSR path in `public-sites.mjs` so `renderPublishedSite()` projects the real `storeBuilderV16` document + live `ecommerce_products` catalog for STORE sites the same way `renderCorporateSite()` already does for BUSINESS — this is the single highest-leverage fix, since it's blocking both SEO/crawlability and correct custom-domain delivery for every commerce site. Wire `CheckoutCanvas` to the real `POST /commerce/carts/:cartId/checkout` endpoint should follow immediately after, since a store cannot take real orders without it. Do not start either without explicit go-ahead — these are product-facing changes, not docs/investigation.

## P0-1 + P0-2 implementation (2026-09-24)

Both commercial-release blockers from the audit are now implemented and verified. Checkpoint commit `6bd0755` ("checkpoint before storefront checkout P0 fixes") was created before any code edit, per instruction. Committed as `d845f6f` ("P0 complete - real storefront SSR and checkout integration") after review confirmed only the intended 8 files were staged (no db/log/temp artifacts).

**Files changed:**
- `server/app/services/store-site-html.mjs` (new) — `renderStoreSite()`/`isStoreV16()`, mirrors `corporate-site-html.mjs`'s contract for the STORE site kind: real design/hero/sections from `projectPublicStorePresentation()` plus real products.
- `server/app/routes/public-sites.mjs` — `renderPublishedSite()` now branches to `renderStoreSite()` for a STORE project with a real V16 document; `createPublicSitesRouter` takes an `ecommerceService` and fetches the live catalog (workspace-scoped via `runWithWorkspace`) before rendering. Legacy `storefront()`/`genericSite()` untouched, still used as fallback for pre-V16 projects.
- `server/public-site-server.mjs` — instantiates `ecommerceService` and passes it into `createPublicSitesRouter`.
- `server/app/routes/auth.mjs` — `sendLegacySite` (the `/api/auth/sites/:id` path, sharing the same `renderPublishedSite`) now fetches products for STORE projects too, for parity.
- `src/lib/publicCart.ts` — added `getPublicCart()` and `checkoutPublicCart()` against the already-complete `/api/auth/storefront/carts/:id/checkout` API; existing exports/behavior unchanged.
- `src/components/store-studio-v16/PublicStorefrontRuntime.tsx` — loads the real cart (not just a count) and exposes `cart`/`checkout` on the runtime adapter.
- `src/components/store-studio-v16/StudioCanvas.tsx` — `StorefrontRuntimeAdapter` type extended (optional `cart`/`checkout`, backward compatible); `CartCanvas` renders real line items and `CheckoutCanvas` submits through `adapter.checkout()` **only when a real adapter is present** — the editor's own no-adapter preview path is untouched.

**Tests run:**
- `npx tsc -b` — clean, exit 0.
- Targeted server test files (not the full 201-file suite, per token/scope rules): `public-sites.test.mjs`, `public-storefront-render.test.mjs`, `corporate-website-core.test.mjs`, `commerce-public-trust-boundary.test.mjs`, `commerce-v2-checkout-order.test.mjs`, `ecommerce-core.test.mjs`, `auth.test.mjs`, `public-cart-recovery.test.mjs`, `commerce-v2-pricing-cart.test.mjs`, `store-v16-publish-live-parity.test.mjs`, `v16-ask-loadder.test.mjs`, `v16-document-revisions.test.mjs`, `v16-multi-page-core.test.mjs`, `v16-patch-engine.test.mjs`, `site-project-service.test.mjs`, `site-project-manual-creation.test.mjs` — **145/145 pass, 0 failures.**
- Two ad-hoc verification scripts (scratchpad, real migrated schema, `runWithWorkspace`) confirmed all 4 requested checks end-to-end: (1) SSR renders the real V16 hero/title, (2) real catalog product name+price appear (not the legacy placeholder), (3) a real cart returns real line items from `ecommerce_cart_items`, (4) checkout writes a real row to `ecommerce_orders`. One check was run at the HTTP layer (`GET /api/auth/sites/:id` through a live Express app) for full confidence, not just at the function level.

**Remaining risks:**
- `server/public-site-server.mjs` is a separate process from the main API server — confirm it's actually deployed/running wherever `/sites/:id` and custom domains are served in production; this fix is inert otherwise.
- One of the test-file runs above wrote to the **real** `server/db/loadder.sqlite` (not an isolated DB) — caught via `git status` and reverted with `git checkout -- server/db/loadder.sqlite` before finishing. Some test files in this suite isolate their DB via `DATABASE_PATH`/temp files or `test-helpers/site-test-db.mjs` (in-memory); others don't and fall through to `server/db/database.mjs`'s default path. This is a pre-existing property of the test suite, not something this change introduced — but it's worth knowing before running `node --test` against files outside this list.
- Checkout in `CheckoutCanvas` sends no `shippingMethod` (the picker UI for shipping methods wasn't part of this task's approved scope) — checkout still succeeds since it's optional server-side, but shipping cost will be 0 until that's added as a follow-up.
- Nothing here touches CRM/Marketing/Business Brain, and AI independence is preserved — none of the 7 changed/added files call an AI/model service.

## Template system audit (2026-09-24) — see `docs/TEMPLATE_SYSTEM_AUDIT.md` for full detail

**Status: audit only, no code changed.** Read-only pass over `src/components/store-studio-v16/*`, `StoreWebsiteStudioPageV16Core.tsx`, and the V16 persistence/schema files. Confirmed (targeted grep, not a repo scan) that no theme/template table or file exists anywhere in that scope.

**Finding:** the system does **not** currently support reusable templates. Sections are a closed hardcoded TS union with duplicated switch-statements across `StudioCanvas.tsx` and `InspectorPanel.tsx` (no registry); themes are just one project's inline `design` values with a single hardcoded per-site-kind default (`config.ts`); there is no template catalog, no "create project from template" flow, and no template-vs-instance separation. The underlying `StudioConfig` document model itself is plain, versioned JSON with no embedded logic, so this is addable without a rewrite — it just isn't built yet.

**Plan on file for "Loadder Commerce Modern V1"** (design only, not implemented): of the 8 Stitch reference sections, 4 already exist and are reusable as-is (hero, trust badges, product grid, footer), 1 exists partially (flash sale — needs a countdown field added to the existing discounted-products preset), and 2 are genuinely missing new section types (`category-grid`, `brand`). The template itself would be one more static `SectionConfig[]` + `DesignConfig` literal, identical in shape to today's `sectionDefaults` — deterministic, AI-independent, and schema-driven by construction. Where that literal should live so it's reusable across projects (the actual template-catalog storage question) is explicitly deferred to a future decision, not part of this audit.

**Next step:** awaiting go-ahead on (a) adding the two missing section types + flash-sale fields, and (b) deciding the template-catalog storage mechanism, before any implementation begins.
