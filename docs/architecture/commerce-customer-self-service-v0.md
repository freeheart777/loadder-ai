# Commerce Customer Persistence & Self-Service v0

This phase persists the Customer Accounts v0 domain model and exposes authenticated self-service through the existing Business App Runtime. It does not create another login/session system.

## Authentication

Self-service resolves the existing `X-Loadder-App-Token` through `LoadderAppUserAuth`. Only an active `customer` principal may access its own account. Store identity is resolved through the active `business_builder_commerce_bindings` row; callers cannot provide an arbitrary auth project binding.

## Persistence

The persistence boundary uses three tables:

- `ecommerce_customer_accounts`
- `ecommerce_customer_addresses`
- `ecommerce_customer_order_links`

Database uniqueness enforces one account per `(workspace, site_project, auth_project, app_user)` and one ownership link per Order. Account identity fields and Order ownership links are immutable.

Mutable profile/address writes use an account `revision` for optimistic concurrency. A stale client receives a conflict rather than silently overwriting a newer profile/address change.

## Address history

Saved addresses remain convenience data. Orders continue to own immutable address snapshots. Updating/removing a saved address never mutates an existing order.

## Order ownership

Customer order history is driven only by immutable `CHECKOUT` ownership links. V0 still forbids post-hoc guest claiming. Linking and order creation must eventually execute in the same checkout transaction when V2 checkout is cut over to persistence.

## Runtime surface

The generated-app runtime may expose:

- get/create `me` customer account
- update profile
- add/update/remove saved address
- set default shipping/billing address
- list `my orders`

Every operation derives the principal from the existing app session and the workspace from tenant context. Cross-project/store/customer access fails closed.

## Checkout binding

For authenticated checkout, the persistence adapter must resolve/create the customer account and append the immutable Order ownership link inside the same database transaction as order persistence. A committed Order must not be left with an intended authenticated customer but no ownership link.

This v0 phase does not implement guest-order recovery or infer customer ownership from email, phone, name, shipping address, or payment data.
