# CRM Sales Pipeline Beta

## Canonical rule

The Kanban board is a view only. Deal state transitions are owned by the backend CRM Pipeline service.

Current beta flow:

`Kanban intent -> guarded transition endpoint -> CRM Pipeline service -> workspace-scoped lead persistence -> server-confirmed board state`

## Current beta stages

- `new`
- `hot`
- `qualified`
- `negotiating`
- `converted`

The UI receives stage definitions and allowed targets from the backend. It must not invent transition rules.

## Concurrency guard

The current legacy Lead record has no explicit version column, so the first beta slice uses `updatedAt` as an optimistic concurrency token. A stale drag-and-drop receives HTTP 409 and must refresh from server state rather than overwrite a newer change.

A future dedicated Deal schema should replace this with an explicit monotonically increasing version while preserving the same API behavior.

## Customer-visible deal fields

The first beta board derives the following from current Lead data and backend stage definitions:

- amount
- stage
- owner
- last activity
- next action
- age
- conversion probability
- stuck state

## Next slices

1. Persisted Deal/Owner/Next Action fields and stage history.
2. Pipeline analytics from immutable stage history.
3. Lost reason and Won/Lost domain events.
4. Automation consumers for stuck/Won/Lost transitions.
5. Central Admin workspace telemetry and churn/usage signals.

Do not attach Automation, AI Agent, WhatsApp, or Voice Agent directly to UI state. They must use the same guarded Pipeline transition contract.
