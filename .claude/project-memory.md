# Project Memory — Loadder Website Builder

Standing facts about this project that hold across sessions. Update only when a fact genuinely changes (e.g. repo moves, stack changes) — not for task-by-task status (see `current-state.md` for that).

## What this project is

Loadder is an AI-assisted business platform (CRM, analytics, automation, ads, content studio, etc.) with a Website Builder ("V16") as one module. Repository: `freeheart777/loadder-ai` on GitHub.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind, in `src/`.
- Backend: Node.js services, in `server/` (`server/app/`, `server/db/`, `server/ai/`, `server/services/`).
- Package manager/scripts: root `package.json` runs `dev:frontend` (Vite) and `dev:server` (`node --watch server/index.mjs`) concurrently.

## Website Builder V16 — architectural principle

The Website Builder core (editor, storefront rendering, persistence, patch engine) must work independently of AI. AI is an optional add-on for personalization/content assistance, never a hard dependency of the core.

## How V16 development actually happened (important — avoids re-investigation)

V16 was NOT built on a single long-lived branch. It was built as a sequence of short-lived branches, each merged into `main` via its own PR, in this order (each branch based on the previous merged tip):

1. `commerce/context-first-store-v16` — foundational store studio v16 shell.
2. `commerce/studio-v16-true-visual-commerce-builder` — visual commerce builder.
3. `claude/universal-website-builder-core-v1` (PR #244) — generalized reusable website core + CORPORATE (non-commerce) page kind.
4. `claude/v16-multi-page-core` (PR #245) — real multi-page support.
5. `codex/v16-persistence-foundation-gate-01` (PR #247) — deterministic draft revision/persistence foundation.
6. `codex/v16-structured-patch-engine-gate-02` (PR #248) — structured patch engine, authoritative draft mutation.
7. `codex/v16-component-contract-gate-03` (PR #249) — "Ask Loadder" natural-language section patches. This is the current tip of `origin/main` as of the last sync.
8. `test/store-studio-v16-browser-journey` — browser E2E coverage, also merged.

All of the above are fully merged into `origin/main`. **`origin/main` is therefore the most complete and production-oriented V16 implementation — not any single feature branch.**

Known unmerged/superseded branches (do not treat as sources of missing functionality without checking first):
- `builder/visual-studio-v1` / `v2-interactions` / `v3-shell` — an earlier, smaller, abandoned prototype line (Aug 29), superseded by the `commerce/context-first-store-v16` lineage. Never merged.
- `fix/unify-website-builder-entry` — one unmerged docs-only commit sitting on top of an already-merged tip. Low-value, low-risk if ever needed.

## Recurring pitfall to avoid

A local checkout's `main` can be far behind `origin/main` (seen once: 1247 commits behind) without any warning besides `git fetch`. **Always `git fetch --all --prune` before concluding a feature "doesn't exist" or "was never implemented."** An earlier investigation in this project wrongly concluded V16 had never been built, purely because the remote had never been fetched in that session.
