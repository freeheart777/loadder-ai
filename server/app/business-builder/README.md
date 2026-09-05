# Loadder Business Builder Core

This module is the owned, provider-independent foundation for Loadder's AI Business Builder.

## Non-negotiable ownership rule

A generated application MUST remain understandable, editable, exportable and deployable from its `LoadderAppDefinition` even if any upstream open-source project, LLM vendor, hosted backend or sandbox provider disappears.

Open-source code may accelerate implementation, but no third-party project name is allowed in the application contract.

## Current pipeline

`Business Intent -> Blueprint Ranking -> Business Model Merge -> LoadderAppDefinition -> Validation`

The compiler is deterministic by default. LLM enrichment will be added behind `LoadderAIGateway`; it must never become required to read or operate an already-compiled application definition.

## Loadder-owned contracts

- `loadder-app-schema.mjs`: source-of-truth application contract.
- `business-blueprints.mjs`: initial reusable business capability catalog.
- `business-compiler.mjs`: intent-to-application compiler.

## Planned boundaries

1. `LoadderAIGateway`: model routing, fallback, policy and metering.
2. `LoadderRuntime`: sandbox/workspace/build/preview contracts.
3. `LoadderRenderer`: render pages and components from definitions.
4. `LoadderWorkflowEngine`: durable business workflow execution.
5. `LoadderAgentOrchestrator`: scoped agents with auditable tools and permissions.
6. `LoadderDeployment`: provider-independent deployment targets.
7. `LoadderBusinessGraph`: organization-wide entity and relationship intelligence.

## Safety / reliability principles

- Fail closed on invalid application definitions.
- Never expose a host Docker socket to generated applications.
- Sandboxes are disposable workers, not the control plane.
- Secrets are references in app definitions, never plaintext values.
- Every generated app carries explicit roles and permissions.
- Provider adapters must be replaceable without migrating customer business data.
- Schema versions are explicit and migrations are owned by Loadder.

## First verticals

The first blueprints are deliberately narrow and composable:

- CRM
- Inventory
- Booking

Next candidates: invoicing, procurement, customer portal, internal approvals and logistics operations.
