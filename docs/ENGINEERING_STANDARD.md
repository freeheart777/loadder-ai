# Loadder Engineering Standard

> Permanent product-engineering rule. Features do not reach users because the UI exists; they reach users only after the real user outcome is proven.

## Operating philosophy
Loadder combines TQM with practical Japanese manufacturing principles:

- **Genchi Genbutsu — go and see:** diagnose the real runtime path and evidence, not assumptions or source-code appearances.
- **Jidoka — stop on abnormality:** if required context, persistence, auth, storage or a critical dependency is missing, stop the editable workflow. Never continue with a fake-success state.
- **Poka-Yoke — mistake proofing:** architecture should make invalid states difficult or impossible, e.g. one active project resolver and one media-upload pipeline.
- **Kaizen — continuous improvement:** every important escaped defect adds a regression guard so the same defect class cannot silently return.
- **TQM — quality at every stage:** quality, security, performance and maintainability are part of design and implementation, not a final inspection step.

## Non-negotiable release gate
A feature is NOT DONE until all applicable gates are proven:

1. **Single architecture path** — no parallel implementations for the same critical behavior without an explicit migration plan.
2. **Precondition safety** — required project/workspace/auth/context must be resolved before editable UI mounts.
3. **Real behavior test** — test the user outcome, not merely the presence of source strings or buttons.
4. **Persistence test** — save, reload/refresh and verify the result remains.
5. **Regression test** — an escaped production/user bug must add a guard before closure.
6. **Integration/build gate** — affected frontend and backend paths must compile/test together.
7. **Security and tenant boundary** — workspace ownership and authorization must remain intact.
8. **Performance check** — no avoidable heavy client payload or duplicated infrastructure.
9. **Observable failure** — no silent early returns on user actions. A failure must produce a clear actionable error.

## Jidoka rule for editors
Editors such as Store Studio must never render an apparently editable default/fallback document when the persistent project failed to load.

Correct behavior:
`resolve persistent project -> load context/data -> mount editor`

Incorrect behavior:
`load fails -> render default canvas -> allow buttons -> silently fail when action needs missing project`

## Canonical Store contracts
- Active STORE project resolution: `src/lib/activeStoreProject.ts`
- Media upload: `src/lib/siteMediaUpload.ts`
- Store Studio and Commerce must not independently invent or guess a different project identity.
- Media upload requires a valid `siteProjectId`; missing identity is a blocking state, not a no-op.

## Media Definition of Done
Hero, Banner, Logo, Product and Gallery media are complete only when the tested path proves:

`choose real file -> request upload target -> upload bytes -> complete media record -> receive URL -> apply to intended target -> save -> refresh -> image remains`

The same storage/upload contract should be reused across all surfaces.

## Root-cause rule
Do not patch downstream symptoms until the first broken invariant is identified. When a defect spans multiple layers, document the causal chain and fix the earliest invalid state first.

## Merge rule
If a critical user path cannot be reasonably validated in CI, it must at minimum be blocked behind an explicit precondition/error state and tracked until browser E2E coverage exists. "CI is green" is not proof of a user outcome unless the CI actually tests that outcome.
