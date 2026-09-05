# Commerce Agent API Safety Layer v0

This layer is a fail-closed authorization kernel for future agent-facing Commerce tools. It does not execute Commerce operations and it is not mounted on any production HTTP route in v0.

## Goals

- keep workspace and store scope authoritative;
- expose only an explicit allowlist of agent-safe Commerce actions;
- require exact capabilities for every action;
- require idempotency keys for every mutating action;
- require trusted human confirmation for high-impact actions;
- impose deterministic quantity and monetary ceilings before execution;
- produce a frozen, scoped command envelope for a later execution adapter;
- keep the Commerce domain provider-neutral and agent/model-independent.

## Allowed actions

Read-only:
- `discover_products`
- `check_inventory`
- `get_order`
- `track_order`

Mutating, idempotent:
- `create_cart`
- `apply_promotion`

High impact, idempotent, human-confirmed:
- `checkout`
- `return_item`

Unknown actions fail closed. Wildcard-like caller capabilities do not authorize undeclared actions.

## Trusted boundaries

The agent/model must never be allowed to mint its own identity, workspace, store, capability set, idempotency authority, or human confirmation.

`principal` and `authorization` are server-side trusted inputs supplied by the future tool/control plane. Tool/model input is treated as untrusted data. If untrusted input repeats `workspaceId` or `storeId`, those values must exactly match the trusted principal scope.

High-impact confirmation is accepted only when the trusted caller supplies a confirmation object already verified by the human control plane and bound to:
- the exact action;
- the exact workspace;
- the exact store;
- an unexpired timestamp.

The safety kernel does not infer confirmation from natural-language phrases such as “yes”, prior chat context, model output, or request metadata.

## Idempotency

Every write/high-impact action requires a bounded server-provided idempotency key before an execution command can be constructed. V0 validates the presence and shape of this key; a later persistence/execution adapter must durably enforce key uniqueness and replay semantics.

## Limits

V0 enforces pre-execution limits for:
- cumulative positive integer quantities found in request payloads;
- proposed monetary amounts represented in integer minor units.

Defaults are deliberately bounded and callers may supply stricter limits. Unsafe/fractional/negative values fail closed.

## Command envelope

After authorization, `createAgentCommerceCommand()` creates an immutable command containing only:
- request ID;
- allowed action;
- trusted workspace/store/actor scope;
- validated idempotency key when required;
- a cloned untrusted input payload.

The command does not grant authority by itself. Execution adapters must still use the scoped server context and must never derive tenancy from model-provided input.

## Explicit non-goals

V0 does not:
- mount agent Commerce routes;
- execute checkout, fulfillment, return, refund, inventory or ledger writes;
- create provider adapters;
- persist idempotency receipts;
- infer ownership from PII;
- allow post-hoc Order claiming;
- let agents bypass existing Customer Account, Ledger, Fulfillment or Returns invariants.

Production exposure remains blocked until an execution adapter, durable idempotency receipts, authorization integration, audit logging, rate limits, and end-to-end tool abuse tests are added and pass the Commerce cutover gates.
