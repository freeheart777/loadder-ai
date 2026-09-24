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
