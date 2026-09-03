# Loadder Business Builder — Canonical Roadmap

> Repository source of truth for the Loadder-owned Business Builder / Business Operator. The permanent engineering constitution is `docs/LOADDER_ENGINEERING_SYSTEM.md` and applies to every phase below.

## North Star
Loadder is an AI Business Operating System where **ENGINE BUILDS, AI GUIDES**.

`User Goal -> Navigator -> Deterministic Engine -> App Definition -> Runtime -> Intelligence -> Governed Action -> Approval -> Execution -> Outcome`

## Permanent engineering law
All work follows the Loadder Engineering System (LES): Kaizen, Jidoka, Poka-Yoke, Genchi Genbutsu, Standard Work, Andon, Heijunka, waste elimination, Five Whys and quality-at-source.

### Stop-the-line gate
If required CI, security, tenant isolation, recovery, integrity or operational-completeness checks are red, feature expansion stops until the cause is understood and fixed.

### Definition of Done
No UI-only/mock-success capability is Done. A feature must prove its real path through UI/API/service/persistence-or-runtime, define failure behavior, add regression/integration coverage, and pass current-head Server Tests + Frontend Build + Security Supply Chain.

## Core product doctrine — ENGINE BUILDS, AI GUIDES
- Deterministic Loadder code/blueprints/contracts build supported applications.
- AI is optional for normal build/run/restore/export operation.
- AI navigates, teaches, reviews, proposes safe deltas and explains.
- AI output compiles into validated Loadder contracts; it does not mutate arbitrary production code.
- Deterministic/catalog/rule/cached paths are checked before any LLM call.
- AI outage must degrade guidance, not break supported applications.
- Default UX remains minimal: `What do you want to build? -> Build -> Edit -> Use -> Publish`.

## Lean commercial principles
1. Operational completeness over feature count.
2. No token spend for deterministic work.
3. Cheap/local model routing before expensive reasoning where quality permits.
4. Shared multi-tenant runtime; no dedicated always-on compute for small idle tenants by default.
5. Ephemeral/queued heavy work.
6. PostgreSQL production target; avoid service sprawl.
7. Provider-independent critical contracts.
8. Security, idempotency, audit, rate limits and recovery are release gates.
9. One small deployable surface before microservice/Kubernetes complexity.
10. Cost, tokens, errors and latency attributable per workspace/app/task.

## Completed foundation
- [x] Deterministic Persian/English compiler
- [x] Loadder App Definition + validation
- [x] CRM / Inventory / Booking / Project / Approval / Customer Portal blueprints
- [x] UI contract + RTL renderer
- [x] Versioned Visual Editor patch path; rename/hide/theme controls
- [x] Portable bundle; persistence; immutable versions; restore/export/import
- [x] SQLite workspace-scoped CRUD runtime + references/search/pagination
- [x] Workflow runtime + runtime Copilot fallback
- [x] Live generated-app route
- [x] Vertical intelligence for CRM/Inventory/Booking
- [x] Governed action drafts
- [x] Action Ledger foundation + idempotency uniqueness
- [x] Deployment canary/health/rollback contracts
- [x] Commercial catalog
- [x] Zero-token deterministic Navigator foundation
- [x] Loadder Engineering System documented as permanent law

## Phase A — Quality hardening (ACTIVE)
- [ ] LES automated quality gate/checklist in CI
- [ ] Approval Center UI
- [~] Action Ledger end-to-end recommendation -> approval -> execution -> outcome
- [~] Idempotency on every mutating operator/executor endpoint
- [ ] Immutable audit trail
- [ ] Fine-grained RBAC enforcement
- [~] Cross-tenant isolation coverage extended to records/approvals/exports/executors
- [ ] Restart/retry recovery tests
- [ ] Corrupt payload/malformed definition tests
- [ ] Provider outage/timeout tests
- [ ] Rate limiting/abuse limits
- [ ] Backup/restore verification
- [ ] Performance and cost baseline
- [ ] Deterministic AI-offline acceptance test

## Phase B — Minimal Product Studio
- [x] Minimal `چی می‌خوای بسازی؟` entry
- [x] Commercial catalog from backend
- [x] Visual editor side panel
- [x] Zero-token next-step Navigator
- [ ] Block reorder with persisted version + restore
- [ ] Full page/field visibility controls
- [ ] Navigation/page rename UX polish
- [ ] Mobile/responsive acceptance suite
- [ ] Publish readiness surface

## Phase C — AI Navigator
- [x] Deterministic fallback guidance foundation
- [ ] Context-aware screen guidance
- [ ] Natural language -> validated editor patch
- [ ] Natural language -> validated workflow proposal
- [ ] Error explanation/remediation
- [ ] Explicit token budget and cache policy per navigation task

## Phase D — Vertical expansion
Logistics -> Real Estate -> Agency/Marketing -> Retail/Distribution -> Construction -> HR -> Procurement -> Support -> Lightweight ERP.
Every vertical ships as deterministic blueprints + fixtures + roles + workflows + KPIs + alerts + governed actions.

## Phase E — Production runtime/deployment
- [ ] PostgreSQL production adapter
- [ ] Loadder production deploy adapter
- [ ] Isolated ephemeral workers; no host Docker socket
- [ ] Secrets manager
- [ ] Artifact checksums/signing
- [ ] Synthetic smoke + canary + automatic rollback
- [ ] Deployment history
- [ ] Backup/restore drill
- [ ] Reference low-cost single-node profile
- [ ] Scale-out profile and observability/cost accounting

## Phase F — Native / enterprise / ecosystem
- [ ] Shared Native Renderer
- [ ] iOS build/sign/TestFlight/App Store gates
- [ ] Android build/sign gates
- [ ] SSO/SCIM, RBAC/ABAC, retention/audit export
- [ ] App Store / Agent Store / signed templates / safe integration SDK

## Canonical architecture
```text
MINIMAL PRODUCT EXPERIENCE
  User Goal
    -> Zero-token Navigator / optional AI guide
    -> Deterministic Catalog + Blueprints + Rules
    -> Business Compiler
    -> Loadder App Definition
    -> UI/Data/Workflow Contracts
    -> Immutable Version
    -> Shared Runtime
    -> Intelligence
    -> Governed Action Ledger
    -> Human Approval
    -> Replaceable Executor
    -> Outcome
```

## Reference production topology
```text
Reverse Proxy/TLS
  -> Loadder Web + API (small instances)
  -> PostgreSQL + Object Storage
  -> Queue only when needed
  -> Ephemeral workers for builds/heavy AI/risky execution
```
No default Kubernetes or per-tenant always-on container requirement.

## Documentation rule
Material architecture/quality changes update this roadmap and LES in the same commit series. These files are the long-lived project memory.
