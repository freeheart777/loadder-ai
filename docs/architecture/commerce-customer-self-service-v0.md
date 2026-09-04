# Commerce Customer Persistence & Self-Service v0

This phase persists Customer Accounts v0 and exposes self-service through the existing public Business App auth boundary. It does not create another login/session system.

## Authentication and store binding

Self-service reuses `X-Loadder-App-Token` and `LoadderAppUserAuth.resolve()`. Only an active `customer` principal may access its own account. The public app router resolves workspace from the ready Business Builder project. Store access is accepted only when an active `business_builder_commerce_bindings` row connects that same project to the requested site project. Client-provided project/store combinations cannot bypass this mapping.

The public app bootstrap returns the active commerce stores only for an authenticated customer principal. These IDs/slugs are non-secret routing metadata derived from the authoritative binding table.

## Persistence

Migration 073 adds:

- `ecommerce_customer_accounts`
- `ecommerce_customer_addresses`
- `ecommerce_customer_order_links`
- `ecommerce_carts.commerce_customer_account_id`

Database constraints/triggers enforce one account per `(workspace, site_project, auth_project, app_user)`, one ownership link per Order, immutable customer identity, immutable Order ownership links, valid active customer app-user binding, one default shipping/billing address, and same-store active-cart binding.

Mutable profile/address writes use an account `revision` for optimistic concurrency. Public mutations require `If-Match`; stale writes fail with `409 CUSTOMER_REVISION_CONFLICT` rather than silently overwriting newer state.

## Address history

Saved addresses are convenience data only. Orders retain immutable shipping/billing snapshots. Updating/removing a saved address never rewrites historical Orders.

## Atomic checkout ownership

An authenticated customer binds an ACTIVE cart to its Customer Account before checkout. That cart binding is immutable and cannot be moved to another customer or removed.

When an `ecommerce_orders` row is inserted from a bound cart, a database trigger appends deterministic ownership link `customer-order:<orderId>` in the same transaction. Therefore:

- committed authenticated checkout => Order + ownership link;
- checkout rollback => neither Order nor ownership link remains;
- unbound guest cart => Order is created without a customer ownership link.

There is no public post-hoc Order-link endpoint. V0 does not infer ownership from email, phone, name, address, or payment data.

## Public self-service surface

Under `/api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me` the existing app session can:

- get/create its customer account;
- update display name / phone;
- add/update/remove addresses;
- set default shipping/billing addresses;
- list immutable linked Orders;
- bind its active same-store cart before checkout.

The generated Business App exposes a customer-only “حساب من” view using the same stored app token. It supports profile editing, address CRUD/defaults, store selection from authoritative bindings, and “سفارش‌های من”.

## Current storefront boundary

The existing `/storefront/...` guest checkout SPA does not currently expose an authoritative generated-app project binding/session mapping. This phase does not guess a project from store slug or PII. Guest checkout therefore remains unchanged unless an authenticated cart is explicitly bound through the public app session surface. A later storefront-auth bridge may reuse the same binding endpoint once storefront bootstrap exposes the authoritative app project mapping.
