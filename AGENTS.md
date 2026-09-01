# LOADDER AI — MANDATORY AGENT PREFLIGHT

## STOP: READ THIS BEFORE MODIFYING THE REPOSITORY

This file is the persistent entry point for AI coding agents and future implementation sessions working in this repository.

### Mandatory first action
Before planning, editing, committing, reviewing, or merging work in this repository:

1. Read GitHub Issue **#98 — “🚨 START HERE — Loadder Architecture & Commerce Source of Truth”** in `freeheart777/loadder-ai`.
2. Check current `main` HEAD and recent merged PRs.
3. Check relevant open PRs and CI status.
4. Inspect the actual current implementation before proposing changes.
5. Reconcile the requested work with Issue #98. If there is a conflict, surface it before coding.

**Do not rely on chat/session memory as the source of truth.**

## Commerce non-negotiables (short form)

- **Medusa is a reference architecture / roadmap / UX benchmark, not a required Loadder runtime dependency.**
- Critical commerce code must remain Loadder-owned, independently operable, and self-hostable.
- **Store Studio V16 is canonical.** Do not create V17 just to solve incremental bugs.
- V13/V14/V15 are fallback/debug compatibility only; normal user routes must resolve to V16.
- Preserve `storeBuilderV16`, real `selectedElement` state, direct canvas selection, catalog-backed Product Slots, `+ Add Product`, reorder persistence, and backward compatibility.
- Draft Preview is view-only for editing but functionally navigable and must resemble a real storefront.
- Use Medusa storefront/starter conventions plus approved Loadder UI references as the commerce UX benchmark.
- Studio changes must not casually mutate production Cart / Checkout / Order runtime.
- Publish direction: `Studio Draft → persisted storeBuilderV16 → versioned publish snapshot → storefront renderer → public storefront`, with rollback.
- Required merge gates: Frontend Build, Server Tests, Security Supply Chain Gate.
- Fix the canonical implementation; avoid parallel versions and duplicate runtimes unless an explicit architecture decision requires them.

## Durable decisions
Issue #98 is the detailed, updateable architecture record. When a durable architectural decision changes, update Issue #98 (and this file if the mandatory preflight itself changes).

## Why this exists
The project must not depend on an AI agent remembering prior conversations. Repository state and Issue #98 are the persistent project memory intended to prevent architectural drift, regressions, contradictory decisions, and repeated work.
