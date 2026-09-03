# Loadder Business Builder — Canonical Roadmap

> This document is the repository source of truth for the Loadder-owned Business Builder / Business Operator platform. Update it when architecture, gates, ownership boundaries, cost model, or milestone status changes.

## North Star

Loadder must not become only another prompt-to-code builder. The target product is an **AI Business Operating System** where the **Loadder Engine builds**, and **AI navigates, teaches, reviews and advises**.

Core loop:

`User Goal -> Loadder Navigator -> Deterministic Builder Engine -> App Definition -> Live Runtime -> Intelligence -> Recommended Action -> Human Approval -> Execution -> Outcome`

## Core product doctrine — ENGINE BUILDS, AI GUIDES

This is the primary architectural rule for the App Builder.

1. **The deterministic Loadder Engine is the builder.** App structure, entities, relations, forms, CRUD, navigation, common workflows, renderer output, validation, versions and runtime behavior are generated from Loadder-owned code, blueprints, schemas, rules and reusable blocks.
2. **AI is not a critical build dependency.** A user must be able to create, edit, run, restore and export supported applications even when all AI providers are unavailable.
3. **AI is the Navigator.** Its primary jobs are: understand ambiguous user goals, teach the user what tool to use, guide the next step, suggest modules/workflows/integrations, review output, explain errors and propose safe improvements.
4. **AI requests must compile into Loadder contracts.** AI never gets permission to mutate arbitrary production code. Suggested edits become validated `LoadderAppDefinition`, editor patches, workflow definitions or governed action drafts.
5. **Deterministic before probabilistic.** Before any LLM call, the system must check whether the task can be completed by catalog lookup, domain detection, blueprint composition, rules, cached knowledge or validated patches.
6. **Graceful AI absence is mandatory.** If AI is offline, the normal builder still works; guidance falls back to deterministic contextual help and task checklists.
7. **The user experience stays minimal.** Normal users should see: `What do you want to build? -> Build -> Edit -> Use -> Publish`. Architecture details remain hidden.

### AI Navigator responsibility matrix

AI MAY:
- clarify a vague goal;
- recommend the right Loadder module/template;
- teach the current screen and next action;
- suggest a workflow, integration or role model;
- convert natural-language edits into validated editor patches;
- review generated structure and flag likely omissions;
- explain runtime errors and propose safe remediation;
- summarize business data and suggest governed actions.

AI MUST NOT be required to:
- generate standard CRUD schemas;
- generate standard forms/tables/navigation;
- persist data;
- enforce permissions;
- execute workflows;
- calculate standard KPIs;
- render supported UI blocks;
- version/restore/export an app;
- keep an existing generated app operational.

## Lean commercial architecture principles

These are non-negotiable design constraints for commercialization:

1. **Operational completeness over feature count.** No UI-only or mock-success feature can be marked done; every user-facing capability must have a tested path through API, service, persistence/runtime and recovery behavior.
2. **Token efficiency by default.** Prefer deterministic compilers, reusable blueprints, validated patches, cached plans and small task-specific prompts before general full-app regeneration. AI should modify deltas rather than regenerate stable application structure.
3. **Cheap model routing.** High-cost reasoning models are reserved for tasks that need them; routine classification, patching, validation and summarization should use cheaper or local models where quality gates allow.
4. **No token spend for deterministic work.** CRUD schema generation, renderer output, versioning, migration, routing, validation, KPI calculations and many workflow decisions should remain code-driven.
5. **Lean runtime.** Generated business apps should share a multi-tenant control plane/runtime instead of requiring a dedicated server/container per small tenant by default.
6. **Scale on demand.** Workers, build sandboxes and heavy AI execution should be ephemeral/queue-driven and scale to zero or low idle capacity where infrastructure permits.
7. **Database efficiency.** SQLite is acceptable for local/dev/small deployments; PostgreSQL is the production scale target. Avoid unnecessary service sprawl.
8. **Infrastructure independence.** Critical operation must not require one cloud vendor. Adapters may target managed services, but self-hosted migration paths must exist.
9. **Security before convenience.** Workspace isolation, server-side authorization, validation, secrets isolation, idempotency, audit and rate limits are release gates, not later polish.
10. **Small deployable surface.** Prefer one web application, one API/control plane, PostgreSQL, object storage and queue/worker capability before introducing additional infrastructure.
11. **Observability with cost accounting.** Track AI tokens/cost, build compute, storage, DB load, errors and latency per workspace/app so gross margin is measurable.
12. **Simple operations.** A production Loadder install must be reproducible from documented configuration, support backup/restore and have health checks and safe rollback.

### Cost target philosophy

The platform must be profitable at low tenant usage. Idle customers should cost close to storage/database overhead rather than dedicated compute. Dedicated isolated compute is reserved for builds, risky execution, enterprise isolation requirements or sustained workloads.

### Token minimization sequence

`Intent -> deterministic domain detection -> blueprint composition -> compact AI delta only when needed -> schema validation -> deterministic rendering/runtime`

Never use an LLM merely to reproduce data structures or UI that Loadder can generate deterministically.

## Non-negotiable ownership rules

1. `LoadderAppDefinition` is the source of truth for generated applications.
2. Core contracts must stay provider-independent.
3. No critical runtime dependency on Singulary, Dyad, bolt.diy, WebContainers, Totalum, Supabase, or any single AI/infrastructure vendor.
4. Open-source components may accelerate implementation, but upstream disappearance must not stop production Loadder applications.
5. Production actions require explicit governance, auditability, idempotency, and rollback where applicable.
6. Tenant/workspace isolation is mandatory at every persistence and execution boundary.
7. Production deployment remains blocked until a Loadder-owned deploy adapter passes canary, health-check, rollback, security, recovery and cost-observability gates.

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
- [x] Action Ledger schema + service foundation with workspace isolation
- [x] Action state-machine contract and idempotency uniqueness at persistence boundary
- [x] Commercial app catalog endpoint
- [x] Versioned validated Visual Editor patch path

## Phase 1 — Reliability hardening (ACTIVE)

Goal: make the existing platform safe to trust before adding broad feature surface.

- [~] Action Ledger: persistence/state machine exists; wire recommendation -> draft -> approval -> execution -> outcome end-to-end
- [ ] Approval Center UI across generated applications
- [~] Idempotency: persistence uniqueness exists; require idempotency keys on every mutating operator endpoint/executor
- [ ] Immutable audit trail for approvals and executions
- [ ] RBAC enforcement beyond admin-only schema defaults
- [~] Cross-tenant isolation: Action Ledger covered; extend to runtime records, approvals, exports and executor paths
- [ ] Restart/retry recovery tests
- [ ] Corrupt payload / malformed definition tests
- [ ] Provider outage and timeout tests
- [ ] Rate limiting / abuse limits for runtime and Copilot endpoints
- [ ] Backup/restore verification for Business Builder state
- [ ] Token/cost accounting per workspace/app/task
- [ ] Performance baseline for common CRUD/runtime endpoints
- [ ] Cold-start and low-idle-cost deployment profile
- [ ] Deterministic AI-offline builder acceptance test
- [ ] Navigator fallback guidance acceptance test

Exit gate: Server Tests + Frontend Build + Security Gate green, isolation tests green, no ungoverned external action path, and measurable runtime/AI cost for critical flows.

## Phase 2 — AI Navigator / Product Guide

- [ ] Context-aware current-screen guidance
- [ ] Deterministic fallback guidance with zero LLM dependency
- [ ] Tool/template recommendation from commercial catalog
- [ ] Next-best-action checklist
- [ ] Natural-language -> validated editor patch
- [ ] Natural-language -> validated workflow proposal
- [ ] Error explanation / remediation suggestions
- [ ] Explicit token budget per navigation task
- [ ] Never block normal builder operation when AI is unavailable

## Phase 3 — Business Operator

- [ ] Executor adapter contract (`email`, `CRM`, `procurement`, `calendar`, `webhook`, etc.)
- [ ] Human-approved execution only
- [x] Action status machine: proposed -> drafted -> approved/rejected -> executing -> succeeded/failed -> evaluated
- [~] Retry policy with idempotency: database uniqueness implemented; executor-level retries pending
- [ ] Action outcome capture
- [ ] Operator daily queue
- [ ] Action history and filters
- [ ] Business Brain feedback from outcomes

## Phase 4 — Vertical Intelligence expansion

Priority verticals: Logistics, Real Estate, Clinic/non-clinical operations, Agency/Marketing, Retail/Distribution, Construction/Projects, HR/Recruitment, Procurement, Customer Support, Lightweight ERP.

Each vertical must ship with domain entities, relationships, role model, workflows, KPI definitions, alerts, governed actions, regression fixtures and deterministic generation coverage.

## Phase 5 — Production runtime and deployment

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
- [ ] Reference low-cost single-node deployment
- [ ] Scale-out deployment profile
- [ ] Backup + restore drill

Exit gate: deployment can fail safely without affecting control plane or unrelated tenants, and baseline infrastructure cost is documented for small, medium and scaled installations.

## Phase 6 — Scale / enterprise

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

## Phase 7 — Ecosystem

- [ ] Loadder App Store
- [ ] Loadder Agent Store
- [ ] Reusable domain blocks
- [ ] Signed templates
- [ ] Template version compatibility
- [ ] Revenue-share model
- [ ] Safe third-party integration SDK

## Quality gates for every milestone

Every feature must answer **yes** to all applicable checks:

- Operational: does the real UI reach a real backend/runtime path without mocks?
- Deterministic-first: can the supported user goal complete without an LLM where Loadder already owns the rule/blueprint?
- AI-optional: if all AI providers fail, does the core builder still work?
- Ownership: can Loadder operate without the upstream project/vendor?
- Security: is workspace/tenant isolation enforced server-side?
- Validation: is untrusted client input validated against persisted contracts?
- Governance: can an AI-triggered external side effect occur without explicit authorization? It must not.
- Idempotency: can retry/double-click duplicate an external action? It must not.
- Audit: can we reconstruct who/what/when/why?
- Recovery: what happens after process crash or provider outage?
- Portability: can project state still be exported/restored?
- Efficiency: could deterministic code or a cached/reusable block replace this LLM call?
- Cost: can we attribute token/compute/storage cost to the workspace/app?
- Performance: is the common path acceptably fast under the target deployment profile?
- Tests: unit + regression + integration coverage added?
- CI: Server Tests + Frontend Build + Security Supply Chain green?

## Canonical architecture

```text
LOADDER PRODUCT EXPERIENCE
  Minimal Builder UI
      |
  AI Navigator / Deterministic Guide
      |
LOADDER DETERMINISTIC ENGINE
  Catalog + Domain Detection + Blueprints
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
  Shared CRUD + Relations + Workflows
      |
  Vertical Intelligence
      |
  Governed Recommendations
      |
  Action Ledger -> Approval -> Replaceable Executors
      |
  Outcome -> Business Brain
```

## Reference production topology goal

```text
Reverse Proxy / TLS
        |
Loadder Web + API (1-2 small instances)
        |
PostgreSQL + Object Storage
        |
Queue (only when needed)
        |
Ephemeral Worker Pool for builds / heavy AI / risky execution
```

Do not require Kubernetes, dedicated per-tenant containers, or many always-on microservices for the default commercial installation. Add orchestration complexity only when scale proves it necessary.

## Merge policy

The Business Builder foundation PR stays Draft while the current head has incomplete or failing required CI. Do not merge merely because the feature appears functional in UI.

## Documentation rule

When a milestone materially changes, update this file in the same PR/commit series. This document is the long-lived project memory for the Business Builder architecture, AI role, cost discipline and roadmap.
