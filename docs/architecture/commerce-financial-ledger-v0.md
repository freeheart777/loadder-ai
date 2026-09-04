# Loadder Commerce Financial Ledger v0

This document defines the accounting boundary for the current Loadder Commerce provider. It is intentionally narrower than a full payments, refunds, settlement, or general-ledger subsystem.

## Source boundary

The current commerce implementation does not have a separate Payment aggregate. Until one exists through an explicit versioned migration, the payment capture source of truth is the payment snapshot on `ecommerce_orders`:

- `payment_status`
- `payment_provider`
- `payment_reference`
- `total_minor`
- `currency`
- order subtotal / discount / shipping snapshot fields

The financial ledger must not invent a second mutable payment source of truth.

## Ledger model

`ecommerce_financial_ledger` is append-only financial history.

Each entry owns:

- workspace and store ownership
- order relationship
- deterministic source type + source ID
- entry type
- integer minor-unit amount
- currency
- occurrence timestamp
- immutable metadata snapshot

Update and delete are forbidden at the database boundary.

## Capture invariant

A real transition from a non-`PAID` payment state to `PAID` creates exactly one `PAYMENT_CAPTURED` ledger entry.

The entry ID is deterministic for the order capture. Database uniqueness is the final idempotency boundary.

The capture ledger write happens in the same database transaction as the order payment-state transition. The transactional Commerce Outbox follows the same transition, so a committed payment transition must not leave only one of Ledger or Outbox behind.

A rollback must leave neither financial capture history nor a downstream payment-captured event.

Repeated `PAID -> PAID` updates must not create another capture entry.

## Historical snapshot invariant

A ledger entry records the commercial/payment facts that existed when the financial event occurred. Later catalog price changes or other mutable commerce configuration must not alter historical amounts, currency, payment reference, discount, or shipping information already recorded in the ledger.

## Reconciliation

Reconciliation is repair/check logic, not history editing.

Supported capture reconciliation outcomes are:

- `missing_order`
- `not_paid`
- `already_consistent`
- `repaired`
- `conflict`

A missing capture may be appended only when the current order is already `PAID` and no existing capture source row exists.

If an existing immutable capture disagrees with the current order amount or currency, reconciliation returns `conflict`. It must never update or delete the existing ledger entry to make the conflict disappear.

Reconciliation is restricted to authenticated workspace `owner` or `admin` roles. The workspace is derived from authenticated request context, not accepted as an arbitrary request body/query ownership selector.

Every reconciliation attempt that reaches the financial service must create an operator audit record. When reconciliation repairs the ledger, the repair and audit write are one database transaction: if mandatory audit persistence fails, the repair must roll back.

## Currency integrity

Money is always persisted in integer minor units plus currency.

Financial totals from unlike currencies must never be summed into one number. Read models and operator UI must group totals by currency unless an explicit, separately versioned FX/conversion subsystem is introduced.

## Refund rule for the future

`REFUND` is reserved as an append-only entry type, but this version does not invent a refund workflow.

When Returns / Refunds v0 is implemented, a refund must create a new financial entry linked to its real refund source. It must not mutate, negate in place, delete, or rewrite the original `PAYMENT_CAPTURED` entry.

Refund authorization, partial-refund limits, provider execution, idempotency, inventory/fulfillment effects, and refund event delivery require their own explicit domain contract before writes are enabled.

## Accounting Bridge rule

External accounting integrations, exports, journal projections, settlement reports, or bookkeeping adapters must treat the financial ledger as an immutable input stream/read model.

They may transform ledger entries into provider-specific accounting records, but they must not write accounting-provider state back by editing historical commerce ledger rows.

Any delivery to an external accounting provider must have its own idempotency and delivery receipt/outbox boundary. Provider acknowledgment is not permission to mutate commerce financial history.

## Operational surface

The first operator surface exposes:

- store-scoped immutable ledger list
- order financial summary and timeline
- explicit owner/admin capture reconciliation
- audit-backed reconciliation results
- per-currency captured/refunded/net views

This surface is diagnostic and repair-oriented. It does not perform payment capture, refund execution, settlement, or accounting-provider posting.
