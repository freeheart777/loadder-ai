# Decisions Log — Loadder Website Builder

Append-only record of non-obvious decisions and their reasoning, so future sessions don't re-derive or re-litigate them. Newest entries at the top.

---

## 2026-09-24 — Treat `origin/main` as the best V16 candidate, not any feature branch

**Decision:** When asked to find "the most complete and production-ready Website Builder implementation," the answer is `origin/main` (tip at the time: `570927aaee3f91072c3b76c101349625eef92501`), not a specific feature branch.

**Why:** Investigation of 11+ candidate branches showed 7 of them (`commerce/context-first-store-v16`, `commerce/studio-v16-true-visual-commerce-builder`, `claude/universal-website-builder-core-v1`, `claude/v16-multi-page-core`, `codex/v16-persistence-foundation-gate-01`, `codex/v16-structured-patch-engine-gate-02`, `test/store-studio-v16-browser-journey`) are ancestors of `origin/main` — i.e. already merged in sequence. Only `builder/visual-studio-v1/v2/v3` (superseded prototype) and `fix/unify-website-builder-entry` (one unmerged docs commit) are not merged, and neither contains functionality missing from main.

**Do not repeat:** re-running a full branch-by-branch maturity comparison for V16 unless new branches appear that aren't already covered above.

## 2026-09-24 — Corrupted stray file, not evidence of missing implementation

**Decision:** `src/pages/StoreWebsiteStudioPageV16.tsx` (untracked, previously 0 bytes then 65 bytes containing a stray pasted shell command) is a paste accident, not a placeholder or lost work. It is safe to delete.

**Why:** Confirmed via `git rev-list --all --objects` (no blob with this or related filenames ever existed in git history) and via the branch investigation above (the real V16 implementation lives on `origin/main` under different, correct paths).

## 2026-09-24 — Always fetch before concluding something is unimplemented

**Decision:** Standing rule, also recorded in `project-memory.md`: never declare a feature "never implemented" without first running `git fetch --all --prune` and checking `origin/<branch>` refs.

**Why:** An earlier investigation in this same session concluded Website Builder V16 had never been implemented anywhere in git history — a real finding for the *local* refs, but wrong once the remote was fetched: it produced ~200 previously-unknown branches, several already merged into `origin/main` containing the full V16 implementation.

## 2026-09-24 — ZarinPal is the first payment gateway (Commerce Gate 3)

User-approved. Market is Persian (IRT prices, Kavenegar SMS, Persian UI); ZarinPal's redirect model fits the existing server checkout without client payment JS, and a single merchant ID fits `credential_reference` with no migration. Stripe was deferred: needs a webhook signing secret and currency-aware minor units. Adapters are looked up by `provider_key` in `auth.mjs`'s `paymentAdapters` map — add a second gateway there, no new registry layer.

## 2026-09-24 — Payment provider activation by real gateway probe (Gate 3.5)

User chose a real ZarinPal request over format-only validation. Sandbox rows probe the sandbox; live rows send a 1,000 IRR request that is never paid (it expires at the gateway, visible as unpaid in the merchant dashboard). Every save resets to PENDING so changed credentials can never stay CONNECTED unverified. The ZarinPal merchant ID is stored as plain `credential_reference`: it is a per-request identifier, not a signing secret. Activation logic lives in its own service (`payment-provider-activation-service.mjs`), not in routes.

## 2026-09-24 — Payment verification outcomes: unknown is `pending`, never `FAILED` (P1a)

`payment-verification-service.verifyAndSettle()` is the only verify→settle path (callback and merchant reconcile). Only a definite ZarinPal error code marks an attempt `FAILED`; a network error, timeout, or reply without a code leaves it untouched and reports `pending`, because marking a possibly-paid attempt FAILED would lose a real payment. Abandoned attempts are handled by merchant-triggered reconcile instead of a scheduler; an automatic sweep can call the same function later. `TRUST_PROXY` accepts only an exact hop count — `true` would let clients forge `X-Forwarded-For` past rate limits.

## 2026-09-24 — Retry payment: freshness window before verification (P1b)

ZarinPal reports a live link as "unpaid" until the customer finishes, so verifying a just-issued attempt and marking it FAILED would break a payment in progress (found by the concurrent-retry test). Retry therefore refuses (409) while any attempt was issued in the last 15 minutes, verifies only older open attempts, and refuses if any outcome stays unknown. Customer SMS fires from `verifyAndSettle`'s `onSettled` only for the call that performed the real settlement.

## 2026-09-25 — Website platform is capability-first (ADR-004)

A website is Core + Capabilities + Sections + Theme + Published Snapshot, not a fixed product type. `STORE`, `BUSINESS`, `MEDICAL`, `LEGAL`, `NEWS` remain only as legacy experience presets: they seed capabilities and starter sections at creation; afterwards the site's own capability list is the truth. Why: one builder must serve many domains (store, clinic, academy, law firm) without a new site type, renderer or builder per industry.

## 2026-09-25 — Capability and Section Registry ownership

The Capability Registry owns available capabilities, their dependencies and the sections each provides (`server/app/site-platform/registry.mjs`, `capabilities.mjs`). The Section Registry owns section definitions, legacy aliases and editor metadata (variants, fields, interactive, seo). Section types are namespaced `<capability>.<name>`; existing plain types (`products`, `about`, …) are aliases, and stored or published documents are never rewritten (rollback copies old content verbatim). The registry lives server-side only for now: `tsconfig.app.json` includes only `src/`, and Phase 1 needs no frontend.

## 2026-09-25 — Canonical capability names

`core`, `commerce`, `payments`, `people`, `forms`, `blog`; `booking` and `courses` are recognized but pending (resolved into `unregistered`, never loaded). `payments` is internal: only reachable as a dependency of `commerce`, never selected directly. Legacy names from `website-platform-definition.mjs` / `site-types.ts` are mapped by the resolver, not migrated. Capabilities stay in the existing `content.websitePlatform.capabilities` for V1; a `site_capabilities` table is deferred.

## 2026-09-25 — `people` capability added in PR 1.2

Not in the original PR 1.2 scope (core, commerce, payments), but required: the existing corporate `team` section must alias to `people.profileGrid`, and BUSINESS/LEGAL sites already resolve `people` from the legacy `team` capability. Added with a single section (`people.profileGrid`) so resolver and registry agree.

## 2026-09-25 — Commerce loading stays STORE-only

`resolveCapabilities()` grants `commerce` and `payments` if and only if `siteType === "STORE"`, whatever the document declares, matching today's `productsFor` gate in `public-sites.mjs`. Changing this rule (e.g. commerce on a BUSINESS site) requires a separate ADR. Why: preserves exact current behavior while the runtime is not yet capability-driven.

## 2026-09-25 — Runtime capability access boundary (PR 3)

- Runtime capability decisions go through `server/app/site-platform/runtime-capabilities.mjs` only. Public routers import that module and nothing else from `site-platform/`.
- Renderers (`corporate-site-html.mjs`, `store-site-html.mjs`, `store-public-presentation.mjs`, `renderPublishedSite`) cannot import `site-platform/`; they stay capability-unaware.
- The `site-platform` runtime module cannot import renderers, ecommerce modules, the registry or `capabilities.mjs` (it uses the resolver and the manifest reader only). This keeps the import graph one-way and avoids a cycle once capabilities gain render functions.
- Manifest v2 is metadata, not commerce authority. A manifest records `siteType` at publish time; the runtime follows the project's current `siteType`. `commerceEnabled()` therefore re-resolves from the current `siteType` (STORE-only rule), so a store changed to BUSINESS after publishing loads no catalog even though its manifest lists commerce.

Why: one audited entry point for capability decisions, renderers that cannot drift from the byte-identical baselines, and no change to the STORE-only commerce rule without a separate ADR. All four rules are enforced by the agreement test in `server/test/site-platform-registry.test.mjs`.

## 2026-09-26 — Public site URL is `PUBLIC_SITE_BASE_URL/s/:slug`, with globally unique slugs

- The user-facing address of a published site is `PUBLIC_SITE_BASE_URL + /s/:slug`. `/sites/:id` stays an internal route, and custom domains keep using the host-based domain handler.
- Slugs are globally unique (migration 092, `ux_site_projects_slug`), because the URL carries no workspace. The old `UNIQUE(workspace_id,slug)` stays, since SQLite cannot drop it without a table rebuild.
- Generated slugs that clash get a random suffix, not `-2`/`-3`, so other tenants' addresses cannot be enumerated. An explicitly chosen slug is never silently changed: a clash is a 409 `SITE_SLUG_TAKEN`.
- URL building lives in `services/public-site-urls.mjs`, not `site-platform/`, which stays capability-only (see the PR 3 boundary above).

Why: a slug URL is shareable and readable, and uniqueness has to hold across tenants or `/s/:slug` could resolve to another workspace's site.

## 2026-09-26 — Local media root is anchored to the module, not the process cwd

- `site-media-storage-adapter.mjs` defaults to `server/data/site-media`, resolved from its own file location (`DEFAULT_SITE_MEDIA_LOCAL_DIR`). `SITE_MEDIA_LOCAL_DIR` still overrides it.
- Stored media are relative keys, so a root change never breaks a stored reference.

Why: starting the server from `server/` wrote uploads to `server/server/data/site-media`, where the API and public server could not find them.
