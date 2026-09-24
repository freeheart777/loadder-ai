# ADR-002 Subscription Payments

## Status

Accepted

## Scope

Merchant subscriptions:
merchants sell recurring products to their own customers.

## Not Included

Loadder SaaS billing.

## V1 Decision

Renewals use payment links.

Automatic direct debit is postponed.

## Commerce Decision

Build on existing commerce flow.

Reuse:

- ecommerce-service
- payment-attempt-service
- payment-verification-service
- financial-ledger
- messaging

## Architecture Model

Subscription
 |
Subscription Period
 |
Order
 |
Payment Attempt
 |
Ledger Entry

## Reason

Reduce risk by extending existing commerce contracts instead of introducing a separate billing system.

