# Commerce Agent Execution Adapter v0

This phase connects an already authorized Agent Commerce decision and command to an injected operation handler. It remains dark: no public/production HTTP route is mounted and no concrete Commerce handler is registered by this phase.

## Trust model

Execution requires the original in-process authorization decision created by `authorizeAgentCommerceAction()`. The safety module brands valid decisions in a private `WeakSet`; a structurally forged object cannot pass `assertAgentCommerceDecision()`.

The execution adapter then requires the command to exactly match the trusted decision for:
- action;
- workspace;
- store;
- actor;
- idempotency key.

Any mismatch fails closed before a handler is called.

## Handler boundary

Handlers are injected by exact action name. Missing handlers return `AGENT_COMMERCE_HANDLER_UNAVAILABLE`; there is no generic fallback or dynamic method dispatch.

Every handler receives:
- a cloned, deeply frozen untrusted input payload;
- a deeply frozen trusted context containing request ID, action, risk mode, workspace, store, actor and validated idempotency key.

A handler must use the trusted context for tenancy and authorization-sensitive writes. It must not derive tenant scope from model input.

## Non-goals

This phase does not yet provide:
- durable idempotency receipts;
- append-only Agent Commerce audit records;
- handler implementations for catalog/cart/checkout/order/return;
- provider calls;
- retry orchestration;
- production tool/API exposure.

Those are separate boundaries so failure/replay semantics can be tested transactionally instead of being hidden inside the authorization layer.
