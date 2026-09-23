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

## Not yet done

No Website Builder implementation code has been modified this session (audit was read-only, per instructions). The next task is implementation-shaped (see gate above) and needs explicit user sign-off before any code changes.
