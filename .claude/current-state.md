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

## Template System V1 implementation (2026-09-24)

**Status: implemented and verified.** Checkpoint commit `511d812` ("checkpoint template system v1 foundation") was created before continuing; final work described here builds on top of it and is **not yet committed** (no commit was explicitly requested for this stage).

**Files changed/created (this stage, on top of the checkpoint):**
- `src/components/store-studio-v16/StudioCanvas.tsx` — added a `category-grid`/`brand` render branch in `StorefrontCanvas` (uses the existing `StoreItemGrid` component from the checkpoint), and added `SECTION_LABELS` entries for both new types so they appear in the insert-section picker.
- `src/components/store-studio-v16/InspectorPanel.tsx` — `ProductSectionEditor` gained a "فروش ویژه با شمارش معکوس" field group (`saleLabel` text + `saleEndsAt` datetime-local); `GenericSectionEditor` now renders the existing `ItemsEditor` for `category-grid`/`brand` sections (STORE sections fall through to `GenericSectionEditor`, not `CorporateSectionEditor`, since STORE lacks the `lead` capability).
- `src/components/store-studio-v16/templates/commerce-modern-v1.ts` (new) — the actual "Loadder Commerce Modern V1" `WebsiteTemplate` data: hero + trust + flash-sale (`products` with `saleLabel`, no `saleEndsAt` — a template never carries a moving deadline) + `category-grid` + `products` (featured) + `brand`, all plain data, no logic.
- `src/components/store-studio-v16/templates/registry.ts` (new) — `TEMPLATES` catalog array and `createConfigFromTemplate(template)`, which builds a `{ storeBuilderV16: {...} }` content shape from the template's fields and feeds it through the existing `restoreConfig()` — the exact same normalization path a saved draft already goes through, so a templated site is indistinguishable from a hand-built one from first render. No parallel builder, no new persistence path.
- `server/app/services/store-public-presentation.mjs` — `projectSections()`'s whitelist extended with `visibleProductCount`, `productImageSize`, `saleEndsAt`, `saleLabel` (previously silently stripped from public/SSR output).
- `server/app/services/store-site-html.mjs` — added `saleLineHtml()` (a static snapshot of the sale label/end-time at request time, not a live client-side countdown — SSR has no clock) wired into the `products` branch, and `itemGridHtml()` wired into a new `category-grid`/`brand` branch of `sectionHtml()`, plus matching CSS.

**Not done (deliberately out of scope per explicit instruction "Do not expand scope"):** no page was wired to call `createConfigFromTemplate()` yet (e.g. a "create from template" UI in `StoreSetupWizardPage.tsx` or similar) — the capability exists and is ready to be called, but hooking it into an actual site-creation flow was not one of the listed remaining-scope items and was left untouched to avoid touching an unreviewed file.

**Tests run:**
- `npx tsc -b` — clean, exit 0 (type-checks `templates/registry.ts` and `templates/commerce-modern-v1.ts` along with everything else).
- `npm run build` (`tsc -b && vite build`) — full production build succeeded, confirming the new template files bundle without runtime import errors.
- Targeted server tests covering the two backend files touched: `store-v16-publish-live-parity.test.mjs`, `v16-patch-engine.test.mjs`, `v16-document-revisions.test.mjs`, `v16-multi-page-core.test.mjs` — **58/58 pass, 0 failures.**
- Confirmed via `git status` that `server/db/loadder.sqlite` was not touched by the test run.

**Remaining risk:** the two new section types (`category-grid`, `brand`) and the flash-sale fields are only reachable through direct edits (`persistConfig()`'s full-document save) — they are not yet in the Ask Loadder structured-patch allow-list (`v16-patch-policy.mjs`), so "Ask Loadder" cannot add/edit them via natural language yet. This was explicitly out of scope ("keep existing persistence and patch engine unchanged").

## Commercial acceptance test (2026-09-24) — first pass found 2 defects, both now fixed

Ran a real end-to-end acceptance test against the Template System V1 work above (not just code reading): bundled the actual `templates/registry.ts` + `config.ts` via Vite's library-mode build to execute the real TypeScript logic under Node, and ran a full backend pass (in-memory test DB → create a STORE project from `commerce-modern-v1` → add two real catalog products → publish via the real repository → render through the actual `renderPublishedSite()` dispatcher). All scratch scripts lived in the session scratchpad; nothing in the repo was touched by the test itself.

**Found and fixed:**
1. **Template mutation leak (FAIL → fixed).** `createConfigFromTemplate()` returned independent top-level objects per call, but nested arrays — e.g. a `category-grid` section's `items` — were shared by reference with the template seed, because `restoreConfig()`'s `modernizeSections()` only shallow-copies each section (`{...section}`). Reproduced deterministically: pushing an item into a created config's `items` array grew the *template's* array too. **Fix (registry.ts only):** wrapped the content object in `structuredClone()` before it reaches `restoreConfig()`, so every nested field is deep-copied upfront and nothing downstream can share a reference back to the template, regardless of how shallow `restoreConfig()`'s own copying is.
2. **Flash-sale label invisible without an end date (FAIL → fixed).** Both `StudioCanvas.tsx`'s products-section render and `store-site-html.mjs`'s `saleLineHtml()` gated the *entire* sale-info block (label + countdown) on `section.saleEndsAt` being set. Since the template intentionally seeds `saleLabel` without `saleEndsAt` ("a template never carries a moving deadline"), the flash-sale section looked like a plain product grid until a merchant manually set an end date. **Fix:** the wrapper now shows whenever `saleLabel` OR `saleEndsAt` is present; the `Countdown` component (client) / countdown-or-expired state text (SSR) render only when `saleEndsAt` is actually set. No dates were added to the template; persistence, the patch engine, and the AI layer were not touched.

**Files touched by the fix:**
- `src/components/store-studio-v16/templates/registry.ts` — `createConfigFromTemplate()` now deep-clones via `structuredClone()`.
- `src/components/store-studio-v16/StudioCanvas.tsx` — sale-info wrapper condition changed from `section.saleEndsAt &&` to `(section.saleLabel || section.saleEndsAt) &&`; `<Countdown>` now conditional on `section.saleEndsAt` independently.
- `server/app/services/store-site-html.mjs` — `saleLineHtml()` rewritten to compute `label` and `stateText` independently and return early only when *both* are empty.

**Verification after the fix:**
- Template isolation re-test (bundled real code): **18/18 checks pass** — includes byte-identical template JSON before/after mutating a created config, and independent copies across two separate `createConfigFromTemplate()` calls.
- SSR end-to-end re-test (real DB, real publish, real `renderPublishedSite()`): **22/22 checks pass** — including the previously-failing "SSR contains flash-sale saleLabel badge" check, now passing with no `saleEndsAt` set.
- `npx tsc -b` — clean, exit 0.
- Targeted server regression check: `store-v16-publish-live-parity.test.mjs`, `v16-patch-engine.test.mjs`, `v16-document-revisions.test.mjs`, `v16-multi-page-core.test.mjs` — 58/58 pass, no regressions.
- `server/db/loadder.sqlite` confirmed untouched by any of the above.

**Status: fixed and verified, not yet committed** (no commit was requested for this stage).
