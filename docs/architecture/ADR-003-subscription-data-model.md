# ADR-003 Subscription Domain Model

## Status

Proposed

## Decision

Subscriptions extend existing commerce.

Subscription is not a separate billing system.

## Domain Model

Product / Variant

↓

Subscription Plan

↓

Subscription

↓

Subscription Period

↓

Order

↓

Payment Attempt

↓

Ledger Entry


## Ownership Rules

Subscription owns:
- lifecycle
- periods
- renewal scheduling

Order owns:
- commercial transaction

Payment Attempt owns:
- payment state

Ledger owns:
- financial records


## Rules

Subscriptions never write directly to ledger.

Every financial event must flow through existing order and payment settlement flow.

## V1 Customer Model

Use optional customer_account_id.

Support token/contact based customers initially.

Avoid forcing storefront account dependency.

## Migration Strategy

Add subscription tables without modifying core order/payment tables.
