# Current State

Last updated: 2026-09-25, after Website Platform PR 2 (capability manifest).

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

**Status: fixed, verified, and committed** as `d2864b5` ("Template System V1 - Commerce Modern template foundation") after a second, final acceptance pass (24/24 SSR checks + 18/18 isolation checks) confirmed both fixes held.

## Commercial Readiness Audit V1 (2026-09-24) — see `docs/COMMERCIAL_READINESS_AUDIT_V1.md` for full detail

**Status: audit only, no code changed.** Read-only pass over the Website Builder V16 frontend (`store-studio-v16/`, `StoreWebsiteStudioPageV16Core.tsx`, `templates/`) and backend (`site-projects.mjs`, `public-sites.mjs`, `auth.mjs`, `server/app/commerce/` incl. `v2/`, and the site services those files call). Goal: determine what remains before Loadder Website Builder can be sold to real customers.

**Customer journey result:** of the 8 steps audited (account/workspace creation was out of file scope and not assessed), only **Edit design, Add products, and Publish are a clean PASS**. **Create website** and **Select template** are **MISSING** — both have complete, tested backend/logic (`POST /site-projects`, `createConfigFromTemplate()`) but zero UI path anywhere in the audited Studio to reach them (`StoreWebsiteStudioPageV16Core.tsx` assumes a project already exists; nothing references `"template"` outside the `templates/` folder itself). **Connect domain** and **Receive orders** are **PARTIAL**: domain-connect has a working backend endpoint but no UI at all, and (even if UI existed) no DNS ownership verification or TLS provisioning; order creation is solid end-to-end but checkout is hardcoded to `"manual"` payment (no gateway wired despite a complete, tested adapter contract in `payment-attempt-service.mjs`) and there is no order/lead notification of any kind (no email/SMS/webhook).

**Biggest structural finding:** `server/app/commerce/v2/*` — 10 files covering cart, checkout, pricing, promotions, inventory reservation, fulfillment, returns/refunds, customer accounts, orders, and catalog — is imported **exclusively by test files** (confirmed via `grep -rl` for each engine across `server/`). The live storefront (`auth.mjs` + `ecommerce-service.mjs`) uses a separate, simpler, hand-rolled implementation instead. Only `financial-ledger.mjs` is genuinely wired into production routes. This means substantial, well-tested commerce functionality (promotions, inventory reservation, real fulfillment, returns, customer accounts) exists in the codebase but is unreachable by any real merchant today — a product decision (wire it in vs. archive it) is needed before adding more commerce surface area.

**P0 blockers (6):** no create-site UI, no template-selection UI, no real payment gateway wired, no order/lead notifications, domain-connect has no ownership/TLS verification, OTP delivery self-reported as `"not-connected"` (`/api/auth/status`).

**P1 (6):** `commerce/v2` unwired (above); no SEO essentials beyond title/description (no OG tags, JSON-LD, sitemap.xml, robots.txt); new section types not yet in the Ask Loadder patch allow-list; Ask Loadder is a regex matcher despite AI branding; Design Copilot reads the wrong content path; no rate limiting on public site GET routes.

**Next step:** none taken — this was audit-only per explicit instruction. The 30-day roadmap in the audit doc prioritizes unblocking create-site + template-selection UI in week 1 (highest leverage: existing tested backend, UI-only work), order notifications and a first real payment-gateway integration in weeks 1-2, domain verification in weeks 2-3, a `commerce/v2` wire-in-or-archive decision in week 3, SEO essentials in weeks 3-4, and minimum monitoring in week 4.

## Website Creation and Template Selection Flow V1 (2026-09-24) — closes the audit's #1 P0

**Status: implemented and verified, not yet committed** (review requested before commit, per instruction).

Implements exactly the week-1 audit recommendation: a new user can now create a STORE or BUSINESS site from the Studio UI itself, instead of the Studio requiring a project to already exist.

**File changed (one file only):** `src/pages/StoreWebsiteStudioPageV16Core.tsx`. No backend changes — `POST /api/site-projects` (`site-project-service.mjs`'s `create()`) already accepted exactly the content shape needed; confirmed by reading `validateSiteDocument()`/`ensureWebsitePlatformContent()` before writing any code.

**What changed:**
- The load effect's previous behavior (throw "پروژه ... پیدا نشد" when no project of this `siteKind` exists) now sets a new `needsCreate` flag instead of failing.
- A new `CreateWebsiteScreen` component (defined in the same file) renders instead of the empty Studio shell when `needsCreate` is true: for STORE it lists `TEMPLATES` from `templates/registry` (currently just "Loadder Commerce Modern V1") plus a "start blank" option; for BUSINESS it offers "start blank" only, since the template registry has no BUSINESS templates today (not invented here).
- A new `createProject(template)` function builds the seed `StudioConfig` via `createConfigFromTemplate(template)` or `restoreConfig({}, siteKind)` for blank, wraps it as `{ storeBuilderV16: { ...config, version: 16 } }` — the exact same shape `persistConfig()` already writes on every later save — and `POST`s it to `/api/site-projects`. On success it sets `project`/`config`/`assets` from the response, exactly like the existing load effect does, landing the user directly in the already-working Studio with no page reload.
- "Select site type" (the flow's step 2) is resolved one level above this file: `siteKind` arrives as a prop already fixed by which route mounted this component (`App.tsx` for STORE, `CorporateWebsiteStudioPage.tsx` for BUSINESS) — not a new screen, and not touched.

**Tests run:**
- `npx tsc -b` — clean, exit 0.
- `npm run build` (`tsc -b && vite build`) — full production build succeeded; `StoreWebsiteStudioPageV16Core` chunk grew from 95.89 kB to 101.79 kB, consistent with the added code, no bundling errors.
- `site-project-manual-creation.test.mjs` + `site-project-service.test.mjs` — 10/10 pass, no regressions.
- A real functional end-to-end check (bundled the actual `registry.ts`/`config.ts` via Vite, ran against a real in-memory test DB and the real `site-project-service`): **12/12 checks pass**, covering all three paths — STORE+template (5 sections in the exact template order, hero title matches, `siteKind` correct), STORE blank (falls back to the ordinary `products`/`banner`/`trust` defaults), BUSINESS blank (`siteKind` correct, only corporate section types present) — plus confirmed two separately-created template projects don't share `items` array references (the isolation fix from the previous task holds for freshly created projects too, not just in-memory config copies).
- `server/db/loadder.sqlite` confirmed untouched throughout.

**Not done (deliberately, per explicit constraints):** no backend/database change, no change to `commerce/v2` or any commerce engine, no AI dependency added, no refactor of the existing Studio/canvas/patch-engine architecture — this is additive UI plus one new client-side function that calls two already-existing, already-tested backend capabilities.

**Remaining gap (unchanged from the audit, not in this task's scope):** domain connection still has no UI and no DNS/TLS verification; no payment gateway; no order/lead notifications. This task closes only the "create website" + "select template" P0 items.

## Commercial Payment & Order Notification Audit V1 (2026-09-24) — see `docs/PAYMENT_NOTIFICATION_AUDIT_V1.md` for full detail

**Status: audit only, no code changed.** Read-only pass over the checkout/cart UI (`StudioCanvas.tsx`'s `CartCanvas`/`CheckoutForm`/`SuccessCanvas`, `PublicStorefrontRuntime.tsx`, `src/lib/publicCart.ts`), `server/app/commerce/` (incl. `v2/`), `server/app/routes/ecommerce.mjs`, `server/app/routes/auth.mjs`, and the payment/notification services those files call. Goal: determine what's required for real customer payments and merchant order notifications.

**Payment finding:** the hard, correctness-critical engineering is already done and unused. `payment-attempt-service.mjs` is a complete, tested, money-safe payment-attempt framework (idempotent, server-derived money, provider/amount/currency cross-checks, a clean 4-method gateway-adapter contract) — but `grep -rl "payment-attempt-service" server/app/routes` returns nothing; no route ever calls it. `PUT /stores/:id/payment-providers/:key` lets a merchant store a provider config row, but it's never validated and never read at checkout. The public checkout route (`auth.mjs`) hardcodes `paymentProvider:"manual"` regardless of anything configured, and the checkout UI (`CheckoutForm`) has no payment-method selector at all. **Missing:** one real gateway adapter, a checkout-route change to actually use a configured provider, provider-key validation, and a payment webhook/callback route.

**Notification finding:** a real, provider-backed notification utility already exists — `server/services/messaging.mjs` (outside the audited `app/` tree, found via targeted search) supports real SMS (Kavenegar) and email (Resend) with a safe "simulator" default, not a stub. But `grep -rl "services/messaging.mjs" server/app` returns nothing — it's never called from `checkout()`, `setOrderStatus()`, or `site-lead-service.mjs`. A merchant has zero automated way to learn a sale happened. **This is very likely the single lowest-effort, highest-impact fix found across both audits**: the infrastructure works; it's simply never called from the commerce path.

**Receipt finding:** backend is genuinely well-designed — checkout returns a capability-hash-gated `receiptCapability` token, and `GET /storefront/orders/:orderId` works correctly against it (no login needed, unguessable). But the frontend (`PublicStorefrontRuntime.tsx`) destructures `receiptCapability` out of the checkout response and **never uses it** — not persisted like the cart capability already is in `publicCart.ts`, no "track my order" link, no order number shown on `SuccessCanvas`. A real customer who completes checkout today cannot look up their order again through the product at all.

**P0 (3, ranked by effort/impact):** (1) wire the existing `sendMessage()` into `checkout()` for merchant order notification — smallest fix, highest leverage; (2) persist + surface `receiptCapability` on the frontend, mirroring the existing cart-capability pattern; (3) implement one real payment gateway against the existing adapter contract and stop hardcoding `"manual"` in the checkout route.

**Next step:** none taken — audit only, per explicit instruction. No code was modified.

## Commercial Commerce Gate 1 (2026-09-24) — implements the P0 roadmap from the Payment & Notification Audit

**Status: implemented and verified, not yet committed.**

**Files changed (two only):** `server/app/routes/auth.mjs`, `src/lib/publicCart.ts`. No `ecommerce-service.mjs`/`ecommerce.mjs` changes, no schema migration, no Studio/builder changes, no AI, no external gateway integration — exactly the approved scope (P0-1/P0-2/P0-3).

**P0-1 (merchant notification):** wired `server/services/messaging.mjs`'s real `sendMessage()` into the checkout route, called right after order creation, wrapped in try/catch so a notification failure can never fail checkout. Per explicit instruction, **no merchant contact data was invented**: `resolveMerchantNotificationRecipient()` is a clearly-marked `TODO(merchant-notifications)` connection point that always returns `null` today (no merchant-contact field exists anywhere in the audited data model), so notification is always skipped for now — verified via a real HTTP checkout producing the log line `Merchant order notification skipped for site ...: no notification recipient configured (order ...)`. Checkout itself is unaffected either way.

**P0-2 (receipt capability):** `publicCart.ts` already had unused scaffolding for this (`orderStorageKey()`, `orderCapabilityHeaders()` existed but nothing called them). Added `writePublicOrderReference()`/`readPublicOrderReference()` (mirroring the existing cart-reference pair) and `getPublicOrder(orderId)` (calls the already-working `GET /storefront/orders/:orderId`). `checkoutPublicCart()` now persists the receipt capability instead of discarding it. `PublicStorefrontRuntime.tsx` needed **no change** — its `checkoutPublicCart()` call keeps working unchanged since the persistence happens inside the library function.

**P0-3 (payment provider adapter connection):** instantiated `createPaymentAttemptService({db})` in `auth.mjs`. After a successful order, the checkout route now looks up whether the site has a `CONNECTED` row in `ecommerce_payment_providers` (found via a real bug caught in testing: the correct status value is `CONNECTED`, not `ACTIVE` as initially assumed — the table's real CHECK constraint is `DISCONNECTED|PENDING|CONNECTED|ERROR`) — if so, it calls `paymentAttemptService.create()` to record a `CREATED`-status payment attempt referencing that provider config, using the order's own server-computed amount/currency. `createPayment`/`verifyPayment` are never called — no gateway integration. The order's own `payment_provider` field stays `"manual"` unconditionally either way, so today's default behavior (no provider ever configured, since `configurePaymentProvider()` has no frontend caller) is completely unchanged.

**Tests run:**
- `npx tsc -b` — clean, exit 0 (run twice, before and after the `CONNECTED` status fix).
- `auth.test.mjs`, `public-cart-recovery.test.mjs`, `public-storefront-render.test.mjs`, `commerce-payment-foundation.test.mjs`, `commerce-public-trust-boundary.test.mjs` — **41/41 pass**, no regressions; the trust-boundary test's real HTTP checkout still asserts `payment_provider === "manual"` unchanged and now also shows the new skip-notification log line.
- A dedicated real end-to-end HTTP test (real Express app, real migrated DB, real cart→item→checkout call) for the configured-provider branch of P0-3: **10/10 checks pass**, confirming a payment attempt row is created with the correct provider, amount, currency, and `CREATED` status, and that the order's `payment_provider` stays `"manual"`. This test is what caught the `ACTIVE` vs `CONNECTED` status bug before it shipped.
- `server/db/loadder.sqlite` confirmed untouched throughout (checked after every test run).

**Not done (deliberately, per explicit constraints):** no real merchant contact resolution (blocked on a future settings field, marked with a TODO, not invented); no real payment gateway; no frontend UI for order lookup or payment-method selection (would be Studio/builder changes, out of scope this task).

## Commercial Commerce Gate 2 Audit — Merchant Operations (2026-09-24)

**Status: audit only, no code changed.** Scope: `StoreCommerceManagerPage(Core).tsx`, `StoreAdminDashboardPage.tsx`, `store-studio-v16/` (existing store-management UI), `ecommerce.mjs` (routes), `ecommerce-service.mjs`, `server/app/commerce/`, payment routes/services, `messaging.mjs`. Goal: the minimum implementation needed for Merchant Operations. No new doc file this time — full findings recorded here only, per instruction.

### 1. Current merchant capabilities

| Capability | Backend | Frontend | Overall |
|---|---|---|---|
| View orders | **PASS** — `GET /stores/:id/orders` returns full order objects (status, paymentStatus, fulfillmentStatus, totals, items), live and wired. | **MISSING** — both `StoreCommerceManagerPageCore.tsx` (`type Order={id:string}`, orders only ever used for a count) and `StoreAdminDashboardPage.tsx` (fetches full order objects but only aggregates a revenue stat) fetch orders and never render a list. | **PARTIAL** — data is one API call away; zero UI. |
| Order details | **PASS** — `GET /commerce/orders/:orderId` exists, live. | **MISSING** — no file in scope calls it. | **MISSING** |
| Update status | **PASS** — `PATCH /commerce/orders/:orderId/status` exists, live, and correctly refuses payment-state fields ("require their canonical financial authority" — confirmed in the Payment Audit). | **MISSING** | **MISSING** |
| Refunds | **PARTIAL, and less ready than it looks.** `commerce/v2/refund-service.mjs` is real and tested; `ecommerce.mjs`'s router has full refund routes (`GET/POST .../refunds`, `GET /commerce/refunds/:id`, `POST .../transitions`) correctly gated by `requireFinancialAdmin` and with a genuine safety block (a direct "SUCCEEDED" transition is refused without provider verification, since no gateway exists yet). **But the router mount that's actually live** (`site-builder-control-plane.mjs` → `site-builder-runtime.mjs`) passes `financialLedgerService` but never passes `refundService` — so in the running app these routes 503 with `REFUND_SERVICE_UNAVAILABLE` today. A second router factory (`canonical-commerce.mjs`) *does* wire a real `refundService`, but it is dead code — `grep -rln "createCanonicalCommerceRouter" server` finds no importer anywhere except its own file. | **MISSING** | **MISSING** (not actually usable today at either layer) |
| Fulfillment | **PARTIAL** — no dedicated fulfillment engine is wired (`commerce/v2/fulfillment-engine.mjs` remains test-only, per the Commercial Readiness Audit), but `setOrderStatus()` already accepts `fulfillmentStatus` as a mutable field, so a minimal "mark shipped/delivered" capability exists today at the API layer. | **MISSING** | **MISSING** |
| Payment settings | **PARTIAL** — `PUT /stores/:id/payment-providers/:key` exists and is live, but performs zero validation of the provider key or credentials (defaults `status:'PENDING'`), and — confirmed in the Payment Audit — nothing reads this configuration at checkout time regardless. | **MISSING** — no file in scope ever calls this endpoint. | **MISSING** |
| Notifications | **PARTIAL** — `messaging.mjs`'s `sendMessage()` is real (Kavenegar SMS / Resend email) and, as of Commerce Gate 1, is wired into the checkout success path — but always skips today (no merchant-contact field exists, by design, marked with a TODO). No order-status-change or refund-status-change notification exists anywhere. | N/A — no settings UI exists for a merchant to provide a notification contact either. | **PARTIAL** |

### 2. Existing APIs — frontend need → backend endpoint (all already implemented, just unused)

- Order list → `GET /stores/:siteProjectId/orders`
- Order detail → `GET /commerce/orders/:orderId`
- Update order/fulfillment status → `PATCH /commerce/orders/:orderId/status`
- List/create refund → `GET` / `POST /commerce/orders/:orderId/refunds` (**blocked**: needs `refundService` wired into the live router first)
- Refund detail/transition → `GET /commerce/refunds/:refundId`, `POST /commerce/refunds/:refundId/transitions`
- Financial ledger → `GET /stores/:siteProjectId/financial-ledger`
- Order financials + reconciliation → `GET /commerce/orders/:orderId/financials`, `POST /commerce/orders/:orderId/financials/reconcile`
- Configure a payment provider → `PUT /stores/:siteProjectId/payment-providers/:providerKey`

### 3. Missing UI only — files a real implementation would need

- A new order-list page/component (e.g. `src/pages/StoreOrdersPage.tsx`) — table of orders from `GET /stores/:id/orders`, filterable by status.
- An order-detail view (new page or a drawer/modal within the orders page) — calls `GET /commerce/orders/:orderId`, `PATCH .../status`, and (once unblocked) the refund endpoints.
- A payment-settings section (new page or an addition to `StoreAdminDashboardPage.tsx`) — calls `PUT /stores/:id/payment-providers/:key`. Today's "روش‌های پرداخت" checklist item on `StoreAdminDashboardPage.tsx` links to the *product* page, not any real payment-settings screen.
- Routing entries (outside this audit's scope to edit, e.g. `App.tsx`) linking the above from the dashboard.
- **One backend prerequisite, not a UI file:** `site-builder-control-plane.mjs` needs `refundService: createRefundService({db})` passed into its `createEcommerceRouter(...)` call (exactly as `canonical-commerce.mjs` already does) — otherwise a refund UI would be built against a 503 endpoint.

### 4. Commercial priority

**P0 — needed for first paying merchants:**
1. Order list + order detail view. A merchant cannot run a business blind to what customers bought.
2. Wire `refundService` into the live router mount (one line, already proven correct in `canonical-commerce.mjs`) — otherwise refunds are unbuildable.
3. Basic status/fulfillment update UI (mark shipped/delivered/cancelled) — the API already supports this.

**P1 — needed for scaling:**
1. Refund request + history UI, once unblocked.
2. Payment-provider settings UI (pairs with Commerce Gate 1's real-gateway P0).
3. Merchant-facing financial ledger / reconciliation view (a real backend exists; whether `StoreFinancialsPage.tsx` already covers this was outside this audit's file scope).

**P2 — future:**
1. Order-status-change and refund-status-change customer notifications.
2. Merchant notification-contact settings screen (closes the Gate 1 TODO).
3. Bulk order actions / CSV export.

### 5. Recommended Gate 2 implementation plan
1. Fix the one-line backend wiring gap (`refundService` into the live mount) — unblocks everything refund-related with near-zero risk.
2. Build the order list + detail view against the already-complete, already-tested `GET /stores/:id/orders` / `GET /commerce/orders/:orderId` / `PATCH .../status` endpoints.
3. Add refund request/history UI once step 1 lands.
4. Add a payment-provider settings screen against the existing (unvalidated) `configurePaymentProvider` endpoint — pair with provider-key validation as a companion backend fix.
5. Revisit notifications (order-status changes, merchant-contact settings) after the above, consistent with Commerce Gate 1's already-flagged TODO.

**Next step:** none taken — audit only, per explicit instruction. No code was modified.

## Commerce Gate 2 — Merchant Operations UI (2026-09-24)

**Status: implemented and verified, not yet committed** (review requested before commit, per instruction). Checkpoint commit `cbb3a9f` ("checkpoint before merchant operations UI") was created before any edit.

**Files changed (two only):** `server/app/site-builder-control-plane.mjs`, `src/pages/StoreCommerceManagerPageCore.tsx`. No commerce-engine files modified, no checkout-flow changes, no template changes, no Website Builder core changes, no new backend endpoints, no new schema.

**P0-1 (refund service wiring — one-line fix, exactly the audit's finding):** `site-builder-control-plane.mjs` now imports `createRefundService` and passes a real `refundService` into `createEcommerceRouter(...)`, exactly mirroring the pattern already proven correct in the (unused) `canonical-commerce.mjs`. Before this fix, every refund route (`GET/POST .../refunds`, `GET /commerce/refunds/:id`, `POST .../transitions`) 503'd with `REFUND_SERVICE_UNAVAILABLE` in the actually-running app. Verified with a real HTTP test against the real `mountSiteBuilderControlPlane` mount (not a standalone router, which is what the existing `commerce-refund-api.test.mjs` uses and would not have caught this bug): create product → cart → checkout → settle payment via the real `payment-attempt-service.mjs` path → refund creation now succeeds (was 503, now 201) → the pre-existing safety gate (no unverified `SUCCEEDED` transition) is still intact.

**P0-2 (order management UI):** `StoreCommerceManagerPageCore.tsx` gained a 3-way tab switcher (محصولات/سفارش‌ها/تنظیمات پرداخت) added just below the header, replacing nothing — the existing product-catalog view is unchanged and still the default. New "سفارش‌ها" tab (`OrdersView`):
- Order list, each row showing id, email, created date, `status`/`paymentStatus`/`fulfillmentStatus` (Persian-labeled), and total — sourced from the already-fetched `GET /api/stores/:id/orders` (the `Order` type was widened from `{id:string}` to the real shape; `refresh()` itself needed no change, it already fetched full orders).
- Click-to-expand order detail: line items, shipping address, and two status dropdowns (order status, fulfillment status) that `PATCH /api/commerce/orders/:orderId/status`. `REFUNDED` is deliberately excluded from the order-status picker, matching the backend's own refusal to accept it via this endpoint ("requires canonical financial authority").
- No refund UI was added in this pass (out of the approved P0-2 feature list, which was list/detail/status-update only); refund UI is a natural P1 follow-up now that P0-1 unblocks it.

**P1-a (payment settings UI):** new "تنظیمات پرداخت" tab (`PaymentSettingsView`) — a form for provider key + optional credential reference, calling the existing `PUT /api/stores/:id/payment-providers/:providerKey`. Honestly labeled: the form explicitly tells the merchant this only saves configuration, real online payment is not yet active (matches the Payment Audit's finding that nothing reads this config at checkout time). Known limitation, not fixed here since it would mean a new endpoint: there is no GET to read back a previously configured provider, so only the just-saved result is shown for the session; a page reload won't show prior configuration.

**P1-b (merchant notification settings UI): deliberately not built.** The task's own condition — "only if existing storage path exists" — is false: the Payment & Notification Audit and this session's own searches found no merchant-contact/notification-settings field anywhere in the data model, and creating one would mean new schema, explicitly disallowed. Skipped, not silently dropped.

**Tests run:**
- `npx tsc -b` — clean, exit 0.
- `npm run build` — full production build succeeded, no bundling errors.
- Existing tests covering the touched surface: `commerce-refund-api.test.mjs`, `commerce-financial-admin.test.mjs`, `site-builder-runtime-mount.test.mjs`, `ecommerce-core.test.mjs` — **14/14 pass**, no regressions.
- A new real end-to-end HTTP test against the actual `mountSiteBuilderControlPlane` production mount (not a standalone router) — **9/9 checks pass**, proving the P0-1 fix works through the real app composition, not just in isolation.
- `server/db/loadder.sqlite` confirmed untouched throughout.

**Not done (deliberately, per explicit constraints):** no refund UI (P1, follow-up now that it's unblocked), no provider-key validation (pre-existing gap, not this task's scope), no merchant-contact settings (no storage path exists), no new backend endpoints, no changes to `commerce/v2` engines beyond wiring an existing one into an existing mount.

## Commerce Gate 3 Audit — Payment Provider Architecture (2026-09-24)

**Status: audit only, no code changed.** Scope: `server/app/commerce/payment*`, `commerce-provider-contract.mjs`, `ecommerce-service.mjs`, `ecommerce.mjs`, `auth.mjs`, payment migrations, `StoreCommerceManagerPageCore.tsx`'s payment-settings area, checkout UI. Goal: the correct production payment architecture. No new doc file — findings recorded here only, per instruction.

### 1. Current payment flow

Public checkout (`auth.mjs`, `POST /storefront/carts/:cartId/checkout`) always creates the order with `paymentProvider:"manual"` and `payment_status:"UNPAID"` via `ecommerceService.checkout()`. Since Commerce Gate 1, the same route (inside the same `runWithWorkspace` call) additionally checks for a `CONNECTED` row in `ecommerce_payment_providers` for the site; if one exists, it calls `paymentAttemptService.create()` to record a `CREATED`-status payment attempt referencing it. **No gateway is ever called** — `createPayment`/`verifyPayment` are never invoked, there is no redirect, and the order's own `payment_provider` field stays `"manual"` regardless. In practice, since no UI ever sets a provider to `CONNECTED` (only `PENDING`, via `StoreCommerceManagerPageCore.tsx`'s Gate 2 payment-settings form → `PUT /stores/:id/payment-providers/:key`), this new code path is a no-op for every real merchant today. The only way an order becomes `PAID` today is a DB trigger-enforced verified payment attempt (see below) — nothing in the audited scope drives that from a real transaction.

### 2. Existing provider abstraction — genuinely strong, two distinct layers

- **Ecommerce backend abstraction** (`commerce-provider-contract.mjs`): `COMMERCE_PROVIDER_CAPABILITIES`/`REQUIRED_METHODS` define a swappable *commerce backend* (products, carts, checkout, orders) — `loadder-commerce-provider.mjs` is the one native implementation. This is unrelated to payment gateways; it's about swapping the whole commerce engine, not a payment method.
- **Payment gateway adapter contract** (`payment-attempt-service.mjs`): `defineCommercePaymentProviderAdapter({createPayment, verifyPayment, refundPayment, verifyRefund})` — exactly the four methods a real gateway integration needs. `createPaymentAttemptService({db})` provides `create()` (idempotent, rejects client-supplied money, looks up a real provider config) and `settleVerified()` (cross-checks provider/amount/currency before marking an order `PAID`). **No concrete adapter for any real gateway exists** — this contract has zero implementations outside tests.
- **Database-level integrity (migration 087) is the strongest part of the whole payment architecture** and deserves emphasis: `ecommerce_payment_attempts` has trigger-enforced identity immutability, a strict state-transition graph (`CREATED → REDIRECT_READY/PENDING_VERIFICATION/SUCCEEDED/FAILED/CANCELLED/RECONCILIATION_REQUIRED`, no arbitrary jumps), a `SUCCEEDED` guard requiring both `provider_transaction_id` and `verified_at`, terminal-state immutability, and — critically — `ecommerce_orders.payment_status` can only reach `PAID` if a matching `SUCCEEDED` attempt row exists with the same amount/currency/provider/transaction reference. This means **even a bug in application code cannot mark an order paid without a real, verified attempt** — the safety is enforced by SQLite itself, not just JS. Refunds have an equivalent guard (`trg_ecommerce_verified_refund_required`).

### 3. What is missing for real gateway integration

1. **A concrete adapter** implementing `createPayment`/`verifyPayment`/`refundPayment`/`verifyRefund` for at least one real gateway. Nothing exists today.
2. **A checkout-route decision point that actually branches on a configured, verified-ready provider** — today's Gate 1 wiring only records an attempt; it never calls `createPayment` to get a redirect URL, and never redirects the customer anywhere.
3. **A payment callback/webhook route.** Both ZarinPal (customer redirect back) and Stripe (webhook, primarily) need a server endpoint to receive the gateway's result and call `paymentAttemptService.settleVerified()`. No such route exists anywhere in the audited scope.
4. **Provider-key validation.** `configurePaymentProvider()` accepts any string with zero validation and defaults to `status:'PENDING'`; nothing ever transitions a provider to `CONNECTED` (no UI, no backend logic) — confirmed no code path sets that status anywhere in the audited scope.
5. **Frontend payment step.** `CheckoutForm` (Studio checkout UI) collects name/phone/email/address only; there is no payment-method selection, no redirect-to-gateway handling, and no return-from-gateway page.
6. **Webhook signature/authenticity verification** (gateway-specific) — doesn't exist because no webhook route exists yet.
7. **Currency/amount-unit handling per provider** — ZarinPal historically speaks Rial (not Toman) in some API versions; Stripe wants ISO currency codes and its own minor-unit conventions per currency. Neither is normalized anywhere yet since `amount_minor` is currently treated as a single generic minor-unit integer.

### 4. ZarinPal vs Stripe adapter requirements — technical comparison only, no recommendation

| Aspect | ZarinPal | Stripe |
|---|---|---|
| Initiate (`createPayment`) | `PaymentRequest.json` call with merchant ID, amount, callback URL, description → returns an `Authority` token and a redirect URL to ZarinPal's hosted payment page. | `PaymentIntents` (or `Checkout Sessions`) API call → returns a `client_secret` (for Stripe.js/Elements, no redirect) or a hosted `Checkout Session` URL (redirect-based, closer to ZarinPal's model). |
| Customer flow | Full redirect to ZarinPal, then redirect back to a fixed callback URL with `Authority` + `Status` query params. | Either stays on-site (Elements/PaymentIntents, JS-heavy, needs Stripe.js on the checkout page) or redirects to Stripe Checkout and back — Loadder's current server-rendered checkout page (no client JS payment SDK) fits the *redirect* model of both, but Stripe's non-redirect mode would need real frontend JS integration Loadder doesn't have today. |
| Confirm (`verifyPayment`) | `PaymentVerification.json` call with merchant ID, amount, and the returned `Authority` — synchronous, called right after the customer redirect returns. | Primarily **webhook-driven** (`payment_intent.succeeded` event with signature verification via `Stripe-Signature` header + webhook secret); the redirect-back page alone is not authoritative per Stripe's own guidance — a webhook route is the correct source of truth. |
| Refund (`refundPayment`) | ZarinPal's refund API availability/terms vary by merchant tier; not universally available on all account types. | `Refunds` API — straightforward, well-documented, works for essentially all Stripe accounts. |
| Verify refund (`verifyRefund`) | Typically synchronous with the refund call itself. | Async via webhook (`charge.refunded`) for full confirmation, though the initial API response usually already reflects success. |
| Currency | Iranian Rial-oriented (some API versions historically used Rial while the merchant dashboard shows Toman — a real historical source of 10x bugs industry-wide); single-currency in practice for this product's market. | Multi-currency, ISO 4217 codes, well-defined minor-unit rules that already vary per currency (e.g. JPY has no minor unit) — `amount_minor` handling would need to become currency-aware if Stripe is ever added, which it doesn't need to be for ZarinPal-only. |
| Auth model | Merchant ID (a single string) is the primary secret/identifier. | API secret key + a separate webhook signing secret; meaningfully more moving credential parts. |
| Fit with existing schema | Maps cleanly onto today's single `provider_config_id` + `credential_reference` model — one merchant ID per site. | Also maps onto the existing model, but the webhook signing secret is a second credential the current `ecommerce_payment_providers` schema doesn't explicitly separate from `credential_reference` (would likely reuse `config_json` for it, no schema change strictly required). |

### 5. Exact files needed for implementation (once a provider is chosen)

- **New:** one adapter module (e.g. `server/app/commerce/zarinpal-payment-provider.mjs` or `stripe-payment-provider.mjs`) implementing `defineCommercePaymentProviderAdapter(...)`.
- **New:** one webhook/callback route (e.g. `server/app/routes/payment-callbacks.mjs`) that receives the gateway's confirmation and calls `paymentAttemptService.settleVerified()` — this is the piece that's missing regardless of which provider is chosen.
- **Modify:** `server/app/routes/auth.mjs` — the checkout route needs to call the adapter's `createPayment()` when a `CONNECTED` provider exists and return a redirect target instead of (or alongside) the current immediate order-creation response.
- **Modify:** `server/app/services/ecommerce-service.mjs`'s `configurePaymentProvider()` — needs real validation before a provider can reach `CONNECTED` (out of this audit's "do not modify" scope to fix now, but is a hard prerequisite).
- **Modify (frontend):** the checkout UI (`StudioCanvas.tsx`'s `CheckoutForm` or a successor) — needs a payment-method step and redirect handling; and a return-from-gateway landing page.
- **No schema migration is strictly required** for either provider — the existing `ecommerce_payment_providers`/`ecommerce_payment_attempts` tables and their trigger-enforced integrity already accommodate this model.

### 6. P0/P1 roadmap

**P0 — needed before real payments can flow at all:**
1. Add provider-key validation + a real path to `CONNECTED` status (currently no code path ever sets it).
2. Build the webhook/callback route and wire it to `settleVerified()` — this is required regardless of provider choice and is the single biggest missing piece.
3. Implement one concrete adapter (`createPayment`/`verifyPayment` at minimum) for the chosen provider and call `createPayment()` from the checkout route instead of only creating a bare attempt record.
4. Add the frontend redirect-to-gateway and return-from-gateway handling.

**P1 — needed for completeness:**
1. `refundPayment`/`verifyRefund` adapter methods, wired to the existing (already Gate-2-unblocked) refund UI/routes.
2. Currency/amount-unit normalization if a second, multi-currency provider is ever added.
3. Idempotent webhook replay handling (gateways routinely retry webhook delivery) — the existing `UNIQUE(provider,provider_config_id,provider_transaction_id)` index already gives a strong building block for this.

**Next step:** none taken — audit only, per explicit instruction. No code was modified.

## Commerce Gate 3 — ZarinPal payment gateway (2026-09-24)

**Status: implemented and verified, not yet committed.** Gate 2 committed as `9f3408c` before this work.

**Files:** new `server/app/commerce/zarinpal-payment-provider.mjs` (adapter via `defineCommercePaymentProviderAdapter`; `createPayment`/`verifyPayment` against ZarinPal v4 REST; refunds throw `ZARINPAL_REFUND_UNSUPPORTED`); `payment-attempt-service.mjs` (+`markRedirectReady`, +`recordOutcome` for FAILED/CANCELLED/RECONCILIATION_REQUIRED; success still only via `settleVerified`); `server/app/routes/auth.mjs` (checkout initiation + `GET /storefront/payments/:attemptId/callback`); `src/lib/publicCart.ts` (follows `payment.redirectUrl`); new `server/test/commerce-zarinpal-gateway.test.mjs`. No migration.

**Flow:** checkout creates order (unchanged, `manual`/`UNPAID`) → if a `CONNECTED` ZARINPAL provider row exists: `create()` attempt → `createPayment` → `markRedirectReady(Authority)` → response `payment.redirectUrl` → customer pays → callback: Authority must equal stored reference → `Status!=OK` ⇒ CANCELLED; else server-to-server `verifyPayment` with stored amount → `settleVerified(ref_id)` ⇒ order `PAID` (DB triggers enforce) → 303 to `/store/:site/order-success/:order?payment=paid|failed|pending`. Settlement failure after gateway success ⇒ `RECONCILIATION_REQUIRED` + error log. Gateway request failure ⇒ attempt FAILED, checkout still 201 as manual.

**Money:** `amount_minor / 100` = Toman (IRT) or Rial (IRR); other currencies and non-whole amounts are refused. Merchant ID = `credential_reference`; `config_json.sandbox=true` targets sandbox.

**Tests:** new e2e 5/5 (manual unchanged, full paid path incl. forged-Authority 404 and replay, cancel, verify-reject, request-reject); full server suite 1035/1035; `npx tsc -b` clean.

**Open:** (1) nothing in the UI sets a provider to `CONNECTED` yet — Gate 2 form saves `PENDING`; needs a decision (on-save vs sandbox check). (2) Callback URL built from `req.protocol`/host — needs `trust proxy` or a public base URL behind TLS termination. (3) `order-success` page does not read `?payment=`; it shows the order's real `paymentStatus`. (4) Refunds, stale `REDIRECT_READY` cleanup — P1.

## Commerce Gate 3.5 — Payment Provider Activation (2026-09-24)

**Status: implemented and verified, not yet committed.** Gate 3 committed as `e4e8c64`.

**Rule now enforced:** `CONNECTED` is reachable only through `server/app/commerce/payment-provider-activation-service.mjs`. `configurePaymentProvider()` always writes `PENDING` (client `status` is dropped in the route and ignored in the service), so any credential change disables online payment until re-activated. ZarinPal merchant ID must be a UUID.

**Activation:** `POST /stores/:id/payment-providers/:key/activate` → service loads the workspace-scoped row → adapter from shared `commerce/payment-adapters.mjs` → `adapter.createPayment()` probe of 1,000 IRR (sandbox host if `config.sandbox`, else a minimal live request that is never paid) → code 100 ⇒ `CONNECTED`, else `ERROR` + 422. The status write is conditional on `credential_reference`/`config_json` being unchanged since the probe started (409 otherwise). ZarinPal sandbox confirmed live (`sandbox.zarinpal.com/pg/v4/payment/request.json` returned code 100); it accepts any UUID, so only live rows truly validate a merchant ID.

**Also:** `GET /stores/:id/payment-providers` (merchant ID masked to last 4); `PaymentSettingsView` is now ZarinPal-only with merchant ID, sandbox toggle, Save, "Test and activate", and persisted status on reload. `auth.mjs` only swapped to the shared adapter map. No schema change, adapter contract unchanged.

**Tests:** new `commerce-payment-provider-activation.test.mjs` 7/7 (real control-plane mount + auth router): forced CONNECTED ignored, UUID check, unsupported/missing-credential never hits gateway, rejection ⇒ ERROR + manual checkout, save→activate→checkout redirect→re-save disconnects, probe race ⇒ 409, cross-workspace 404. Full server suite 1042/1042; `tsc -b` clean; `npm run build` OK.

**Open:** rows set `CONNECTED` via the old PUT loophole before this change are not reset (no migration). Probe callback host comes from the dashboard request host — ZarinPal may reject if the merchant's registered domain differs. Proxy/TLS base URL still open from Gate 3.

## Payment Production Hardening — P0 frontend fixes (2026-09-24)

**Status: implemented, `tsc -b` + `npm run build` clean, not committed; Playwright `test:e2e:commerce` NOT run (needs a live stack via E2E_BASE_URL/E2E_API_BASE_URL).** Audit (read-only, at `f0d4631`) found three P0 bugs that made Gate 3 unusable for real customers; these three files fix them, no backend change.

- `src/pages/PublicCheckoutPage.tsx` — dropped its private checkout `fetch`; now calls `checkoutPublicCart()`, so the `/store/:id/checkout` route follows `payment.redirectUrl` to ZarinPal (previously it ignored it and showed "success" for an unpaid order).
- `src/lib/publicCart.ts` — `PublicCheckoutInput.shippingMethod` added (the page sends it); `readPublicOrderReference()` accepts the legacy bare-token format the old checkout page stored, so existing customer receipts keep working. Writes stay JSON.
- `src/pages/PublicOrderSuccessPage.tsx` — reads through `getPublicOrder()` (fixes JSON-vs-raw receipt mismatch that broke the page after a gateway return); shows state from server `paymentStatus` only: PAID ⇒ green; UNPAID + `?payment=failed` ⇒ red "not paid"; UNPAID + other `?payment=` ⇒ amber "being verified"; UNPAID with no gateway ⇒ amber "order placed, not yet paid". `?payment=paid` can never make an unpaid order look paid.

**Remaining from the audit (P1, not started):** retry-payment endpoint, callback verify-error ⇒ `?payment=pending` instead of JSON, customer SMS on PAID via `sendMessage`, env-driven `trust proxy`, merchant visibility of attempt status/ref_id, sweep for abandoned REDIRECT_READY attempts.

## Payment Hardening P1a — server safety (2026-09-24)

**Status: implemented and verified, not committed.** P0 committed as `237149b`. P1b (retry payment, customer SMS, merchant UI) NOT started, per instruction.

- **TRUST_PROXY:** `environment.mjs` `parseTrustProxy()` — exact hop count 1–10, default off; `true`/`*`/IP lists/out-of-range throw at startup. `server/index.mjs` applies `app.set("trust proxy", n)` only when set. Fixes https callback URLs and per-client rate-limit keys behind TLS termination.
- **`commerce/payment-verification-service.mjs` (new):** `verifyAndSettle(attemptId)` ⇒ `paid|failed|pending` — the single verify→settle path (reuses `paymentAttemptService` + `paymentAdapters`). Gateway unreachable/timeout or no ZarinPal code (5xx/HTML) ⇒ `pending`, attempt untouched; definite ZarinPal error code ⇒ `FAILED`; verified ⇒ `settleVerified`, settle failure ⇒ `RECONCILIATION_REQUIRED`. Also owns `gatewayCredentials()` (removed from `auth.mjs`).
- **ZarinPal adapter:** `call()` now surfaces `errors.code` so the service can tell reject from outage. Adapter contract unchanged.
- **Callback (`auth.mjs`):** uses `verifyAndSettle`; every exit is a 303 to order-success or a small HTML page (404 for unknown/forged) — never JSON; any exception ⇒ `?payment=pending`. `Status=NOK` only cancels `CREATED`/`REDIRECT_READY` (a verified-but-unsettled attempt is never cancelled).
- **Merchant APIs (`ecommerce.mjs`, `requireFinancialAdmin` like refunds):** `GET /commerce/orders/:orderId/payment-attempts` (`paymentAttemptService.listForOrder`, workspace-scoped, 404 cross-workspace), `POST /commerce/payment-attempts/:attemptId/reconcile` (⇒ `verifyAndSettle`). `PaymentAttemptError` now mapped by the router's error handler. Wired in `site-builder-control-plane.mjs`.

**Tests:** `commerce-zarinpal-gateway.test.mjs` unchanged, passes. New `commerce-payment-hardening-p1a.test.mjs` 8/8: verify timeout + 5xx ⇒ pending, verify reject ⇒ FAILED, no-JSON callback + NOK doesn't cancel RECONCILIATION_REQUIRED, reconcile paid (idempotent), reconcile failed, workspace isolation, permission guard (403 incl. refunds parity), TRUST_PROXY https callback + untrusted ignores headers + unsafe values rejected. Full server suite 1050/1050; `tsc -b` clean; `npm run build` OK.

**Deploy note:** set `TRUST_PROXY=<hops>` (usually 1) behind nginx/Cloudflare, and have the proxy forward `Host` (`proxy_set_header Host $host`). Without it, express-rate-limit logs `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.

**Next (P1b, awaiting go):** retry-payment endpoint + UI, customer SMS on PAID via `beforeOrderSettlement`, merchant order-detail UI for attempts/ref_id/reconcile.

## Payment Hardening P1b — retry, customer SMS, merchant attempts UI (2026-09-24)

**Status: implemented and verified, not committed.** P1a committed as `e57891d`.

- **`commerce/payment-initiation-service.mjs` (new):** `start()` = Gate 3 initiation moved out of `auth.mjs` (checkout now calls it; behavior unchanged, Gate 3 test untouched and passing). `retry()` guards against double charge: (1) any `CREATED/REDIRECT_READY/PENDING_VERIFICATION` attempt touched in the last 15 min (`updated_at`, i.e. link issue time) ⇒ 409 `PAYMENT_IN_PROGRESS`, never verified or superseded — the customer may be paying it; (2) older open attempts go through `verifyAndSettle`, any `paid` ⇒ `{result:"paid"}`, no new charge; (3) anything still open ⇒ 409; stale `CREATED` ⇒ `CANCELLED`; then `start()` with key `retry:{order}:{n}`. PAID order ⇒ `{result:"paid"}`; no gateway ⇒ 422 `PAYMENT_PROVIDER_UNAVAILABLE`.
- **Route:** `POST /storefront/orders/:orderId/pay` (receipt capability, checkout rate limiter).
- **Customer SMS:** `commerce/payment-customer-notification.mjs` `notifyCustomerPaid()` → existing `sendMessage({channel:"sms"})` to the checkout phone. Wired as `verifyAndSettle`'s new `onSettled`, which fires only when that call performed the real settlement (status read and `settleVerified` in one synchronous step), after commit, fire-and-forget; hook errors are logged only. Wired in both `auth.mjs` (callback/retry) and the control plane (merchant reconcile). Simulator unless Kavenegar is configured.
- **Frontend:** `retryPublicPayment()` in `publicCart.ts`; "پرداخت دوباره" on the success page for UNPAID orders that came back from a gateway; merchant order detail `PaymentAttemptsPanel` (ref_id, attempts with status/code, RECONCILIATION_REQUIRED warning, "بررسی مجدد" → reconcile).

**Tests:** new `commerce-payment-hardening-p1b.test.mjs` 10/10 (retry after cancel, paid-old-attempt settles without new charge, unknown outcome ⇒ 409, unpaid-old ⇒ FAILED + new attempt, fresh link untouched, concurrent retries ⇒ one charge, receipt/gateway required, SMS exactly once across concurrent callbacks + reconcile, no SMS on fail/cancel, failing SMS hook doesn't affect PAID). Gate 3 + P1a tests unchanged and passing; payment-related 50/50; full server suite 1060/1060; `tsc -b` clean; build OK. Playwright not run.

**Known limits:** SMS once-guard assumes a single API process (worst case otherwise: duplicate SMS, never double charge). 15-min in-flight window is a fixed constant. A customer who pays an old link after a retry closed it as FAILED is refunded by ZarinPal's auto-reversal of unverified payments — not settled twice.

## Website Platform Phase 1 — capability-first foundation (2026-09-25)

Branch `feature/site-platform-baseline`. Architecture: `docs/architecture/ADR-004-website-platform-architecture.md`, `docs/architecture/WEBSITE_COMPONENT_ARCHITECTURE.md`.

**Model:** Website = Core + Capabilities + Sections + Theme + Published Snapshot. Site types (`STORE`, `BUSINESS`, `MEDICAL`, `LEGAL`, `NEWS`) are legacy experience presets only.

**Completed (no runtime or rendering change, no migration):**

- **PR 1.0** `2800fa0` — `server/test/site-render-baseline.test.mjs` + 7 HTML baselines in `server/test/__snapshots__/site-render-baseline/` (V16 store, V16 corporate single/multi-page, legacy STORE, legacy generic BUSINESS/MEDICAL) and 4 dispatch-edge tests. Regenerate only on intended change: `UPDATE_SNAPSHOTS=1`.
- **PR 1.1** `9c7b45d` — `server/app/site-platform/capability-resolver.mjs`: `resolveCapabilities(project, content)` → `{ capabilities, unregistered, ignored, source }`. Legacy names mapped (`catalog→commerce`, `lead→forms`, `team→people`, `content→blog`; `landing/location/portfolio→core`; `analytics/ads` ignored).
- **PR 1.2** `af1eec2` — `server/app/site-platform/registry.mjs` (`defineCapability`, `defineSection`, `createRegistry`) and `capabilities.mjs` (`core`, `people`, `payments` internal, `commerce` → requires `payments`). All 14 existing section types registered via legacy aliases; metadata only.
- **PR 1.3** `b6c3500` — architecture decisions recorded in `current-state.md` / `decisions.md`.
- **PR 2** `a9f19f57d05761be82a173c294cc59043d970c7d` — Capability metadata in published snapshots. `site_publish_versions.manifest_json` is now the version-2 metadata carrier (`manifestVersion: 2`). New publish versions store `capabilities`, `unregisteredCapabilities`, `sectionTypes` (namespaced, enabled sections across all pages) and `unknownSectionTypes`, built by `server/app/site-platform/publish-manifest.mjs` (`buildCapabilityManifest`) inside the existing publish transaction. Existing manifest fields (`projectId`, `slug`, `siteType`, `contextVersionId`, `publishedAt`, `assetIds`, `rollbackOfVersionId`) are unchanged; stored website content is never rewritten. Old manifests keep working through fallback resolution (`readCapabilityManifest` derives metadata from snapshot content; the stored row is never migrated). Rollback creates v2 metadata from the restored snapshot content, using the project's current `siteType`. No renderer, frontend, migration or runtime-loading changes.

**Capabilities:** `core`, `commerce`, `payments` (internal), `people`, `forms`, `blog`; pending: `booking`, `courses`. `forms` and `blog` are resolved but not yet in the registry (no sections).

**Commerce rule:** commerce/payments resolve for `STORE` only. Renderers still dispatch by `siteType` (`isCorporateV16` / `isStoreV16`); no renderer or the public server imports `site-platform/` yet (enforced by an agreement test); since PR 2 only the publish path (`site-project-repository.mjs`) does, to write manifest metadata.

**Tests:** `node --test test/site-platform*` 40/40; server suite 1111/1111.

**Known rendering inconsistencies recorded (not fixed):** BUSINESS V16 docs with only `text`/`spacer` fall back to `genericSite`; empty STORE V16 falls back to the legacy storefront; `genericSite` prints raw `siteType` (e.g. "MEDICAL") to visitors; MEDICAL/LEGAL/NEWS have no V16 renderer; STORE is single-page; sale countdown depends on request time; spacers carry no `data-section-type`. Open issue from ADR-004 verification: `/preview/sites/:id` on the standalone public server likely lacks workspace context (unconfirmed).

**Next:** PR 3 — Runtime Capability Resolution. Goal: move the public runtime from `siteType`-based decisions toward capability-manifest decisions. Expected scope: capability-aware public rendering; lazy capability loading; remove eager `createEcommerceService()` initialization in `public-site-server.mjs`; preserve current behavior with fallback (`readCapabilityManifest` for pre-v2 versions; commerce stays STORE-only per the recorded decision). Rendering baselines must stay byte-identical.
