# Website Builder V16 — Production Audit

Scope: `src/pages/StoreWebsiteStudioPageV16.tsx`, `StoreWebsiteStudioPageV16Core.tsx`, `PublicStorefrontPage.tsx`, `PublicProductPage.tsx`, `CorporateWebsiteStudioPage.tsx`, `src/components/store-studio-v16/*`, `server/app/commerce/`, the `site/store/project` routes under `server/app/routes/`, and the `server/db` migrations those routes read/write. No unrelated modules (CRM, Marketing, AI agents) were inspected.

## 1. Current architecture

### Editor architecture
One universal editor core (`StoreWebsiteStudioPageV16Core.tsx`) serves both site kinds — `STORE` (commerce) and `BUSINESS` (corporate) — selected by a `siteKind` prop, not a fork. Two thin entry pages gate it: `StoreWebsiteStudioPageV16.tsx` and `CorporateWebsiteStudioPage.tsx` both block rendering until a real backend project is confirmed to exist and load (`loadActiveStoreProject` / `ensureSiteProject`), so the editor never opens on synthetic/local-only state.

The canvas (`StudioCanvas.tsx`) is a single component that renders seven page modes (storefront/collection/product/cart/checkout/success for commerce, plus a distinct corporate layout) and is reused, unchanged, for three different callers: the interactive editor, the draft preview modal, and the public runtime (`interactive={false}`). This is a deliberate "one renderer" design — the same file that lets an editor see WYSIWYG changes is the exact file the published site executes, so editor preview and live output cannot structurally drift.

Editing is inline-first: clicking an element on the canvas selects it and opens `InspectorPanel.tsx`; images are changed by clicking directly on the image (`InlineMediaControl`) rather than through a separate media dialog. Drag-and-drop reordering works for both sections and products-within-a-section.

### Schema/config model
`StudioConfig` (`types.ts`) is the single source of truth on the client: versioned (`version: 16`), site-kind-aware, and page-based (`PageConfig[]`, each owning its own `sections`, `slug`, and `seo`; header/footer/nav/design stay site-wide). `config.ts`'s `restoreConfig` reads a persisted document and migrates it forward from four prior schema generations (`storeBuilderV11/V13/V14/V15`) with no destructive rewrite — an empty/missing field falls back to sane defaults rather than failing.

Section types are gated per site kind by a small capability registry (`site-types.ts`): `STORE` may only compose `products/banner/trust/text/spacer`; `BUSINESS` may only compose `about/services/portfolio/team/text-image/cta/contact/text/spacer`. `isCommerceSite()` is the single gate that keeps a corporate site from ever loading a Commerce concept.

### Component system
`src/components/store-studio-v16/` cleanly separates: `types.ts`/`site-types.ts` (schema + capability registry), `config.ts`/`pages.ts` (defaults, restore/migration, page helpers), `StudioCanvas.tsx` (all rendering), `InspectorPanel.tsx`/`PageManager.tsx` (editing UI), `StudioToolbar.tsx` (device/save/publish controls), `AskLoadderPanel.tsx` (optional AI panel), and `PublicSiteRuntime.tsx`/`PublicStorefrontRuntime.tsx` (public data adapters that feed the same `StudioCanvas`).

### Persistence model
Server-authoritative, with three distinct concerns kept in separate tables (`server/db/migrations/042_site_builder_control_plane.mjs`, `090_site_document_revisions.mjs`, `091_site_document_patches.mjs`, `043_site_publish_versions.mjs`):

- **`site_projects.content_json`** — the canonical current draft (mutable).
- **`site_document_revisions`** — an append-only, DB-trigger-enforced immutable history of every tracked save, keyed by a SHA-256 document hash and an idempotency key (`site-document-revision-service.mjs`). Undo/restore appends a new revision; nothing is ever rewritten.
- **`site_document_patches`** — structured, semantically-scoped edit proposals (propose → preview → apply), validated by a strict server-side allow-list (`v16-patch-policy.mjs`) and executed by a pure, side-effect-free engine (`v16-patch-engine.mjs`). Any property canonically recognized as Commerce truth (price, inventory, payment/order fields, `productSettings` itself) is rejected structurally at *any* path depth, regardless of spelling — this is the mechanism that makes "Ask Loadder" (or any future patch producer) provably unable to touch money or stock.
- **`site_publish_versions`** — immutable snapshots created on publish, with a rollback endpoint (`POST /site-projects/:id/publish-rollback`).

Saves use `expectedRevision` + a client-generated idempotency key (`StoreWebsiteStudioPageV16Core.tsx:439-451`) so a stale draft can never silently clobber newer work, and a retried request converges rather than duplicating.

## 2. Existing features

| Feature | Status | Notes |
|---|---|---|
| Visual editor | **Present, mature** | Click-to-select, inline image replace, drag/drop, device preview (desktop/tablet/mobile), preview modal separate from live draft. |
| Pages | **Present for BUSINESS only** | Multi-page (add/rename/reorder/delete, per-page slug+SEO+nav visibility) via `PageManager.tsx`. `STORE` is deliberately kept single-page (`isCommerceSite` gate) — this is a design choice, not a bug. |
| Sections | **Present, rich** | Per-site-kind type registry, add/duplicate/reorder/delete, one-click presets (e.g. "⚡ شگفتانه" discount layout), items sub-editor for services/team/portfolio. |
| Themes | **Minimal** | One global design-token panel (colors, fonts, radii, spacing, scale). No theme gallery, no swappable starting templates — every new site starts from one hardcoded default. |
| Products | **Present, backed by a real catalog** | Products live in a dedicated `ecommerce_products`/`ecommerce_variants` schema (migration 049), not inside site content — full CRUD via `/api/stores/:id/products`, create-from-Studio flow with SEO+GEO metadata, and five sourcing modes (featured/latest/bestselling/discounted/manual). |
| Storefront (public) | **Present but split into two inconsistent paths** — see §3 P0. | Live interactive storefront is CSR-only (`PublicStorefrontRuntime.tsx`); the SSR fallback used for `/sites/:id` and custom domains renders a *different*, older, asset-only template that never reads the real V16 document or catalog. |
| Corporate public site | **Present, SSR, correct** | `corporate-site-html.mjs` renders real per-page HTML from the same canonical projection the editor uses — title/description per page, real content, no drift. |
| Publishing | **Present, solid** | Draft/publish separation, versioned publish history, rollback, preview tokens for sharing an unpublished draft, custom-domain resolution, ETag/Cache-Control on public routes. |
| Ask Loadder ("AI" section assistant) | **Present, but not an LLM** | Deterministic regex/keyword translator (`v16-instruction-translator.mjs`) mapping a handful of Persian phrases to pre-approved patch operations; routed through the same patch pipeline as manual edits, so it structurally cannot touch price/inventory. See §4. |

## 3. Missing for commercial release

**P0 — blocking**

1. **STORE storefront SSR is disconnected from the real V16 document and catalog.** `server/app/routes/public-sites.mjs`'s `renderPublishedSite()` only calls the canonical, schema-correct renderer (`renderCorporateSite`) for `BUSINESS` sites. For `STORE` sites it falls back to a hardcoded `storefront()` HTML template that reads only `site_assets` (uploaded images) and ignores `content.storeBuilderV16` and the real `ecommerce_products` catalog entirely. This is the HTML served on `/sites/:id`, `/sites/:id/:slug`, and any connected custom domain — meaning search engines, social-link previews, and any visitor on a custom domain see a generic placeholder store, never the real products/prices/design the merchant configured. The actual correct storefront only exists client-side (`PublicStorefrontRuntime.tsx`, CSR, fetch-on-mount against `/api/auth/storefront/:id`), which isn't reachable from the SSR-served domain/slug routes in the audited code.
2. **Checkout is a non-functional placeholder.** `CheckoutCanvas` in `StudioCanvas.tsx` renders static, unwired `<input>` fields and a button labeled "ثبت سفارش آزمایشی" ("submit test order") that only navigates to the success screen — it does not call the real `POST /commerce/carts/:cartId/checkout` endpoint that the commerce v2 engine (`checkout-engine.mjs`, inventory reservation, order snapshot) already implements. A merchant can build a store and take zero real orders through it today.
3. **No individual-product SSR/meta tags.** `PublicProductPage.tsx` is pure CSR; a shared product link has no server-rendered title/description/OG tags, hurting both SEO and link-preview quality — the exact audience (shoppers sharing a product link) that matters most for a commercial store.

**P1 — important**

4. Online payment is preview-only: the commerce config's `paymentMode: "ONLINE"` is explicitly labeled "فقط preview" in the Inspector UI, despite a real `ecommerce_payment_providers` table and provider-config API (`PUT /stores/:id/payment-providers/:key`) already existing in the backend — the two are not connected at the storefront checkout layer.
5. No theme/template gallery; every site starts from one design.
6. No responsive-image pipeline — all `<img>` tags point at original uploaded URLs with no resizing/`srcset`; `loading="lazy"` is only applied inconsistently (corporate item cards have it, most commerce product images do not).
7. Public HTML cache TTL is a flat 60s (`Cache-Control: public, max-age=60, stale-while-revalidate=300`) with no cache-invalidation-on-publish (e.g. surrogate keys) — acceptable for a first release, not tuned for scale.
8. Analytics/conversion tracking has a DB slot (`site_integrations.provider = 'ANALYTICS'`) but no code in the audited scope actually injects a tracking snippet into rendered public pages.

**P2 — future**

9. No A/B testing of storefront layouts/themes.
10. No multi-language/i18n — all copy, including error/help text, is hardcoded Persian.
11. No theme marketplace / community templates.

## 4. AI boundary check

**Confirmed: the builder core works with zero AI dependency.** Every editing action available through `InspectorPanel.tsx`, `PageManager.tsx`, and direct canvas manipulation (color pickers, toggles, ranges, drag/drop, add/duplicate/delete section, product picker) writes directly to `StudioConfig` and saves through `persistConfig()` — none of this path calls an AI service. Publishing, revisioning, and public rendering likewise have no AI step anywhere in the pipeline. Deleting the two AI-touching components below would not break the editor, save/publish, or storefront rendering.

**Where AI actually connects, and an important correction to the "Ask Loadder" framing:**

- **Ask Loadder** (`AskLoadderPanel.tsx` → `POST /site-projects/:id/ask-loadder/translate` → `v16-instruction-translator.mjs`) is, as currently implemented, **not an LLM call** — it's a deterministic, regex-based keyword matcher over a fixed set of Persian phrases ("خلوت‌تر", "N محصول", "بزرگ‌تر", a price mention) that emits pre-approved patch operations. It is genuinely optional and safely bounded (routes through the same `v16-patch-policy` allow-list as any manual edit, so a price-change attempt is structurally rejected server-side, not just hidden in the UI) — but it should not be marketed or budgeted as an LLM feature without also wiring an actual model behind it.
- **Design Copilot** (`server/app/routes/design-copilot.mjs` → `design-copilot-service.mjs`) **does** call a real model (`modelRouter.propose(...)`, sanitized through a strict allow-list of stylistic properties only — no price/content injection possible). However, it reads `project.content?.visualStudio`, a *different, older content namespace* than the one V16 actually uses (`content.storeBuilderV16`). As wired, calling Design Copilot against a real V16 project will always 404 with `DESIGN_SECTION_NOT_FOUND`, since V16 sections live under `storeBuilderV16`, not `visualStudio`. There is also no "apply" endpoint for its proposal — only `propose`. **This AI feature is currently disconnected from V16** and would need both a schema-path fix and an apply flow before it does anything for a V16 site.

**Recommendation:** the "AI is optional" architectural goal is soundly met structurally (patch-policy + revision system make it safe by construction), but functionally only one of the two AI touchpoints does anything at all today (Ask Loadder), and it isn't actually AI. Design Copilot is real AI but inert against V16 content.

## 5. Performance review

**Rendering approach:** split and inconsistent by site kind.
- `BUSINESS` (corporate): real per-request server-side HTML (`corporate-site-html.mjs`), string-built (no virtual DOM/React on the server), same canonical projection as the editor.
- `STORE` (commerce), live/interactive path: pure client-side React SPA — `PublicStorefrontRuntime.tsx` fetches store metadata and the full product list on mount (`Promise.all` of two API calls, plus a third for cart state if a cart reference exists) before anything renders. No SSR, no streaming, no code-splitting evidence in the audited files.
- `STORE`, SSR/domain path: a third, separate, much simpler hardcoded HTML template — see §3 P0 finding #1.

**Caching:** Public HTML responses set `Cache-Control: public, max-age=60, stale-while-revalidate=300` plus `ETag`/304 support (`public-sites.mjs`, `site-public-runtime.mjs`). Preview responses are correctly `private, no-store` with `X-Robots-Tag: noindex`. There is no evidence of CDN-level cache purge tied to publish events — a 60s TTL is the only mechanism keeping published content fresh, which is a reasonable stopgap but not a scaling strategy.

**SEO readiness:**
- Corporate sites: good — real per-page `<title>`/`<meta description>`, semantic HTML, canonical single source of truth.
- Store/commerce sites: poor — the only server-rendered HTML a crawler or custom domain visitor can reach shows generic placeholder content unrelated to the actual catalog (§3 P0 #1), and product pages have no SSR meta tags at all (§3 P0 #3). This is the single most consequential gap for a "production ecommerce builder": today, an ecommerce site built in V16 is not actually crawlable or shareable in a way that reflects its real content.

---

## Findings requiring user decision before implementation

The most consequential gaps (§3 P0 items 1–2) are not small bugs — they mean the STORE side of V16 is not yet an ecommerce site a merchant can put in front of real customers on a custom domain, even though the underlying commerce engine (cart/checkout/inventory/payments/refunds/ledger) is already substantial and well-tested. Recommended next step: decide whether to (a) wire `renderPublishedSite()`'s STORE branch to the same canonical V16 projection corporate already uses (architecturally straightforward — the projection function already exists and is shared), or (b) move the SSR/CSR boundary differently (e.g. SSR shell + hydration). This is a product/architecture decision, not something to default silently.
