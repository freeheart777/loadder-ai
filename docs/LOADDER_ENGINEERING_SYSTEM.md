# Loadder Engineering System (LES)

This is a permanent engineering constitution for Loadder. It adapts proven Japanese quality-management ideas into concrete software rules. It is not cultural mythology; every principle must map to an executable engineering practice.

## 1. Kaizen — continuous small improvement
- Prefer small reversible changes over giant rewrites.
- Every production defect must add a regression test or guard.
- Track reliability, latency, cost and token usage trends; improve the weakest recurring point.

## 2. Jidoka — quality built into execution
- Detect abnormal state as close to its source as possible.
- Fail closed on invalid definitions, permissions, approvals, deploy health and unsafe execution.
- Stop/pause/rollback automatically instead of continuing with known-bad state.

## 3. Poka-Yoke — make mistakes difficult
- Safe defaults, validated contracts, constrained editor patches and idempotency keys.
- Dangerous operations require explicit approval and clear scope.
- UI must prevent invalid states when the backend contract already knows they are invalid.

## 4. Genchi Genbutsu — go to the real evidence
- Architecture decisions use real logs, traces, tests, latency, error rates, cost and user-flow evidence.
- A feature is not complete because UI looks correct; prove UI -> API -> service -> persistence/runtime -> recovery.

## 5. Standard Work — make success repeatable
- Stable successful flows become versioned blueprints, fixtures, runbooks and acceptance tests.
- Production deployment, backup/restore, incident response and migrations require documented repeatable procedures.

## 6. Andon — make abnormality visible
- Errors must be observable and actionable, not silently swallowed.
- Health/readiness gates expose what failed and block promotion.
- Critical incidents and repeated failures create explicit follow-up work.

## 7. Heijunka — smooth the load
- Queue and bound bursty build/AI/executor workloads.
- Avoid expensive always-on compute for idle tenants.
- Prefer shared runtime plus ephemeral workers for heavy jobs.

## 8. Muda elimination — remove waste
- Never spend LLM tokens on deterministic work.
- Avoid duplicate services, unnecessary dependencies, repeated regeneration and over-provisioned infrastructure.
- Delete dead paths after safe migration instead of maintaining two permanent systems.

## 9. Five Whys — fix causes, not symptoms
- Significant/repeated defects require a short root-cause record.
- Correct the systemic cause, add a prevention mechanism, and verify the prevention.

## 10. Quality at the source
- The authoring layer validates before persistence.
- Persistence enforces tenant and integrity boundaries.
- Runtime validates persisted contracts before execution.
- Deploy validates artifacts and health before promotion.

## 11. Fast Gate -> Develop -> Full Gate -> Release
CI protects quality but must not become development waste.

### Fast Gate — development feedback
Run the smallest deterministic checks that can reject a broken change quickly:
- syntax/import smoke for changed critical modules;
- targeted unit/contract/regression tests;
- targeted TypeScript/type checks for changed UI;
- static secret/backdoor scan;
- deterministic builder token budget (`0` AI tokens for supported deterministic builds).

Fast Gate should avoid reinstalling/auditing the entire world when the changed surface does not require it. Target: useful feedback in a few minutes, not tens of minutes.

### Full Gate — release evidence
Before merge/release/production promotion, run the complete evidence set:
- full Server Tests;
- full Frontend Build;
- full Security Supply Chain audit;
- tenant-isolation and authorization tests;
- Backup/Restore Drill;
- production readiness / canary / rollback checks;
- relevant performance and cost budgets.

### Stop-the-line semantics
- A red Fast Gate blocks further work on the affected surface until understood.
- A slow/queued Full Gate does not prohibit reversible, isolated development on a separate safe surface, but nothing may be called merge-ready/release-ready until the exact release SHA passes Full Gate.
- Never treat a green result from an older SHA as evidence for a newer SHA.

## Definition of Done — mandatory
A Loadder capability is Done only when all applicable checks pass:
1. Real user path works end to end; no mock success.
2. Server-side validation and authorization exist.
3. Tenant isolation is proven where data is involved.
4. Failure behavior is defined and tested.
5. Retry cannot create duplicate side effects.
6. Logs/metrics make abnormal behavior visible.
7. Restore/rollback exists where change is destructive or production-facing.
8. Unit/regression/integration coverage exists.
9. Exact release SHA passes the Full Gate before merge/release.
10. Cost/token impact is understood; deterministic alternatives were considered first.

## Stop-the-line rule
If a required security/isolation/recovery/integrity gate fails, do not expand the affected feature surface until the failure is understood and fixed. New functionality must not hide an existing red gate.

## Builder-specific law
`ENGINE BUILDS, AI GUIDES.`
The deterministic Loadder Engine builds supported applications. AI navigates, teaches, reviews, proposes and explains. AI is never required to keep a supported generated application operational.
