# Current State

Last updated: 2026-10-17. Verified HEAD `417e239` on `automation/loadder-roadmap` (= `origin/automation/loadder-roadmap`).

Full history of the V16 / Commerce / Site-Platform milestones (2026-09-24 → 09-25, every audit, gate and PR section that used to live here, verbatim) is in `docs/CURRENT_STATE_ARCHIVE_V16_2026-09.md`. Read it only when a task concerns that history.

## Where we are

- Website Builder **V18 is implemented and pushed** (`417e239`). Product notes and the capability-to-template gap matrix: `docs/WEBSITE_BUILDER_V18.md`. V17 Studio (inline editing, Inspector, Persian/RTL/a11y): `docs/VISUAL_STUDIO_V17.md`. Capability matrix: `docs/WEBSITE_BUILDER_CAPABILITY_MATRIX.md`.
- Repo: `freeheart777/loadder-ai`. Stack and architecture rules: `CLAUDE.md`, `.claude/project-memory.md`, `docs/architecture/`.
- Next focus: customer-facing visual acceptance and the website-building experience. **No new architecture phase is authorized.**

## Milestone references (SHAs)

| Milestone | Reference |
|---|---|
| V16 Gate 03 "Ask Loadder" patches | `codex/v16-component-contract-gate-03`, PR #249 (tip of `origin/main` on 2026-09-24, `570927a`) |
| Site Platform PR 1.0 render baselines | `2800fa0` |
| PR 1.1 capability resolver | `9c7b45d` |
| PR 1.2 registry and capabilities | `af1eec2` |
| PR 1.3 decisions recorded | `b6c3500` |
| PR 2 capability metadata in publish manifests (`manifestVersion: 2`) | `a9f19f57d05761be82a173c294cc59043d970c7d` |
| PR 3 runtime capability resolution | `1e90f38a299dc7a5f4a60885c8464b25e1098164` |
| Studio V17 phases 1-8 | `33dbbf6` … `aaf9a6f`; customer acceptance journey `3d0a914` |
| V18 real template previews / Hybrid, Education, clinic booking entry | `6e52c93`, `f97d45e` |
| V18 customer journeys and gap matrix | `7e8975c`; production-topology runner target `87760e8` |
| Hybrid is showcase + inquiry, Commerce STORE-only | `417e239` |

Commit SHAs for Commerce Gates 1-3.5 and Payment Hardening P0/P1 are in the archive file.

## Standing facts (still true at HEAD)

- Site model: Website = Core + Capabilities + Sections + Theme + Published Snapshot. Site types are legacy presets. Code: `server/app/site-platform/`.
- **Commerce is STORE-only** (`NOT_STORE_PROJECT`, 409 for others). Public routers decide product loading through `runtime-capabilities.mjs` only; renderers still dispatch by site type.
- Booking: strict site scope for MEDICAL, compat scope for LEGAL/EDUCATION (`booking-scope.mjs`). HYBRID has no `booking` capability.
- Published pages require `https` image URLs; on plain-HTTP local environments the server-rendered `/sites/:id` drops template photos, while the SPA `/site/:id` renders them.
- Render baselines in `server/test/__snapshots__/site-render-baseline/`: regenerate only on intended change (`UPDATE_SNAPSHOTS=1`).
- Payments: ZarinPal is the first gateway (see `decisions.md`).

## Open product decisions (owner's, not implementation tasks)

1. Allow Commerce for HYBRID projects, or keep it STORE-only. Changing the rule needs a separate ADR plus tenant/authorization test updates.
2. Add `booking` to the HYBRID archetype (`website-platform-definition.mjs`), with a scope decision.

Other known rendering inconsistencies recorded but not fixed are listed in the archive ("Known rendering inconsistencies recorded").

## Recovery and safety

- Runtime data is off-limits for inspection: `server/db/loadder.sqlite` and sidecars, `server/data`, Docker volumes. Browser runners use throw-away databases (`e2e/websites/run-website-e2e.sh`).
- Before declaring something missing, `git fetch --all --prune` and check `origin/*` (see `decisions.md`).
- Working-tree note: keep unrelated untracked files (`.continue/`, `LOADDER_*.txt`, zips) untouched.
