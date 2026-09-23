# Build State — Website Builder V16

Snapshot taken after fast-forwarding local `main` to `origin/main` and removing the corrupted stray file. See `.claude/current-state.md` for the token-optimized living version of this; this file is the durable, repo-committed snapshot.

## Current branch

`main`

## Current commit

`570927aaee3f91072c3b76c101349625eef92501`
(fast-forwarded from `cdd8005570be19d0c5359f4d82543362a1a294eb7`; matches `origin/main` exactly, no local divergence)

## Discovered Website Builder modules

**Frontend pages** (`src/pages/`):
- `StoreWebsiteStudioPageV16.tsx` + `StoreWebsiteStudioPageV16Core.tsx` — current editor entry + core.
- Full prior version history: `StoreWebsiteStudioPage.tsx`, `V2` through `V15` — superseded iterations, kept for reference.
- `PublicStorefrontPage.tsx`, `PublicCorporateSitePage.tsx` — public-facing renderers for commerce vs. corporate site kinds.
- `CorporateWebsiteStudioPage.tsx`, `VisualWebsiteStudioPage.tsx` — corporate/non-commerce builder surface.
- Supporting commerce pages: `StoreAdminDashboardPage.tsx`, `StoreCatalogOperationsPage.tsx`, `StoreCommerceManagerPage.tsx` / `Core.tsx`, `StoreFinancialsPage.tsx`, `StoreProductDetailPage.tsx`, `StoreQuickStartPage.tsx`, `StoreSetupWizardPage.tsx`, `StorefrontTestPage.tsx`.

**Frontend components:** `src/components/store-studio-v16/`.

**Backend:** `server/app/commerce/`.

**Docs already in repo:** `docs/LOADDER_APP_BUILDER_COMMERCIAL_SPEC.md`, `docs/LOADDER_BUSINESS_BUILDER_ROADMAP.md`, `docs/LOADDER_BUSINESS_BUILDER_LAUNCH_CHECKLIST.md`, `docs/LOADDER_ENGINEERING_SYSTEM.md`, `docs/LOADDER_MASTER_ARCHITECTURE.md`, `docs/INLINE_MEDIA_INTERACTION.md`.

**How it got here:** built across sequential branches, each merged via its own PR into `main` — `commerce/context-first-store-v16` → `commerce/studio-v16-true-visual-commerce-builder` → `claude/universal-website-builder-core-v1` (PR #244) → `claude/v16-multi-page-core` (PR #245) → `codex/v16-persistence-foundation-gate-01` (PR #247) → `codex/v16-structured-patch-engine-gate-02` (PR #248) → `codex/v16-component-contract-gate-03` (PR #249, current tip). Full reasoning trail in `.claude/decisions.md`.

## Next recommended task

Read `StoreWebsiteStudioPageV16Core.tsx` and `src/components/store-studio-v16/` (scoped read, not a full scan) to determine what "Gate 04" or equivalent next step should cover — the gate sequence so far has gone foundation → editor → multi-page → persistence → structured patch engine → natural-language patches (Gate 03). A natural next candidate is production-readiness hardening (error boundaries, publish/rollback safety, load testing) or extending the AI-personalization layer, kept strictly optional and outside the core per the architecture rule in `CLAUDE.md`. Confirm with the user before starting.
