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
