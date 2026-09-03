# Loadder Business Builder — Canonical Roadmap

> This document is the repository source of truth for the Loadder-owned Business Builder / Business Operator platform. Update it when architecture, gates, ownership boundaries, or milestone status changes.

## North Star

Loadder must not become only another prompt-to-code builder. The target product is an **AI Business Operating System** that can understand a business, generate its applications, run them, interpret live data, recommend governed actions, and execute approved actions through replaceable adapters.

Core loop:

`Business Intent -> Business Compiler -> App Definition -> Live Runtime -> Intelligence -> Recommended Action -> Human Approval -> Execution -> Outcome -> Business Brain`

## Non-negotiable ownership rules

1. `LoadderAppDefinition` is the source of truth for generated applications.
2. Core contracts must stay provider-independent.
3. No critical runtime dependency on Singulary, Dyad, bolt.diy, WebContainers, Totalum, Supabase, or any single AI/infrastructure vendor.
4. Open-source components may accelerate implementation, but upstream disappearance must not stop production Loadder applications.
5. Production actions require explicit governance, auditability, idempotency, and rollback where applicable.
6. Tenant/workspace isolation is mandatory at every persistence and execution boundary.
7. Production deployment remains blocked until a Loadder-owned deploy adapter passes canary, health-check, rollback, security, and recovery gates.

## Current completed foundation

- [x] Persian/English deterministic Business Compiler
- [x] Loadder-owned App Definition schema + validation
- [x] CRM / Inventory / Booking composable blueprints
- [x] UI contract + RTL renderer
- [x] Portable source bundle
- [x] AI Gateway contract with failover / private-local mode
- [x] Secure runtime/sandbox contracts
- [x] Ownership-boundary tests
- [x] Project persistence and immutable version history
- [x] Restore, export, import, executable preview
- [x] Human preview / production approval records
- [x] SQLite workspace-scoped live data runtime
- [x] Dynamic CRUD, references, search, pagination
- [x] Workflow runtime
- [x] Provider-neutral runtime Copilot with owned fallback
- [x] Live generated application route
- [x] Vertical Intelligence for CRM / Inventory / Booking
- [x] Governed action recommendations and draft-only operator actions
- [x] Deployment controller contracts for canary / health / rollback

## Phase 1 — Reliability hardening (ACTIVE)

Goal: make the existing platform safe to trust before adding broad feature surface.

- [ ] Action Ledger: persist recommendation, draft, approval, execution, outcome
- [ ] Approval Center UI across generated applications
- [ ] Idempotency keys for every mutating operator action
- [ ] Immutable audit trail for approvals and executions
- [ ] RBAC enforcement beyond admin-only schema defaults
- [ ] Cross-tenant isolation tests for runtime records, actions, approvals, exports
- [ ] Restart/retry recovery tests
- [ ] Corrupt payload / malformed definition tests
- [ ] Provider outage and timeout tests
- [ ] Rate limiting / abuse limits for runtime and Copilot endpoints
- [ ] Backup/restore verification for Business Builder state

Exit gate: Server Tests + Frontend Build + Security Gate green, isolation tests green, no ungoverned external action path.

## Phase 2 — Business Operator

- [ ] Executor adapter contract (`email`, `CRM`, `procurement`, `calendar`, `webhook`, etc.)
- [ ] Human-approved execution only
- [ ] Action status machine: proposed -> drafted -> approved/rejected -> executing -> succeeded/failed -> evaluated
- [ ] Retry policy with idempotency
- [ ] Action outcome capture
- [ ] Operator daily queue
- [ ] Action history and filters
- [ ] Business Brain feedback from outcomes

## Phase 3 — Vertical Intelligence expansion

Priority verticals:

1. Logistics
2. Real Estate
3. Clinic / Healthcare operations (non-clinical workflow only)
4. Agency / Marketing operations
5. Retail / Distribution
6. Construction / Projects
7. HR / Recruitment
8. Procurement
9. Customer Support
10. Lightweight ERP

Each vertical must ship with:
- domain entities
- relationships
- role model
- workflows
- KPI definitions
- alerts
- recommended governed actions
- regression fixtures

## Phase 4 — Production runtime and deployment

- [ ] Loadder production runtime adapter
- [ ] Isolated execution workers
- [ ] No direct host Docker socket
- [ ] Secrets manager
- [ ] Build artifact signing / checksums
- [ ] Canary rollout
- [ ] Synthetic smoke tests
- [ ] Automatic rollback
- [ ] Deployment history
- [ ] Multi-region recovery design
- [ ] Observability: logs, metrics, traces, cost accounting

Exit gate: deployment can fail safely without affecting control plane or unrelated tenants.

## Phase 5 — Scale / enterprise

- [ ] PostgreSQL production data adapter
- [ ] Queue-backed workflow execution
- [ ] Horizontal workers
- [ ] Enterprise SSO / SCIM where required
- [ ] Fine-grained RBAC / ABAC
- [ ] Private/local AI mode
- [ ] Organization -> company -> team -> app permission hierarchy
- [ ] Data retention controls
- [ ] Audit export
- [ ] SLA / incident runbooks

## Phase 6 — Ecosystem

- [ ] Loadder App Store
- [ ] Loadder Agent Store
- [ ] Reusable domain blocks
- [ ] Signed templates
- [ ] Template version compatibility
- [ ] Revenue-share model
- [ ] Safe third-party integration SDK

## Quality gates for every milestone

Every feature must answer **yes** to all applicable checks:

- Ownership: can Loadder operate without the upstream project/vendor?
- Security: is workspace/tenant isolation enforced server-side?
- Validation: is untrusted client input validated against persisted contracts?
- Governance: can an AI-triggered external side effect occur without explicit authorization? It must not.
- Idempotency: can retry/double-click duplicate an external action? It must not.
- Audit: can we reconstruct who/what/when/why?
- Recovery: what happens after process crash or provider outage?
- Portability: can project state still be exported/restored?
- Tests: unit + regression + integration coverage added?
- CI: Server Tests + Frontend Build + Security Supply Chain green?

## Canonical architecture

```text
LOADDER CONTROL PLANE
  Business Brain
      |
  Business Compiler
      |
  Loadder App Definition
      |
  UI / Data / Workflow / Agent Contracts
      |
  Persisted Version
      |
LOADDER APPLICATION RUNTIME
  CRUD + Relations + Workflows
      |
  Vertical Intelligence
      |
  Governed Recommendations
      |
  Approval Center
      |
  Replaceable Executors
      |
  Outcome Ledger
      |
  Feedback -> Business Brain
```

## Merge policy

The Business Builder foundation PR stays Draft while the current head has incomplete or failing required CI. Do not merge merely because the feature appears functional in UI.

## Documentation rule

When a milestone materially changes, update this file in the same PR/commit series. This document is the long-lived project memory for the Business Builder architecture and roadmap.
