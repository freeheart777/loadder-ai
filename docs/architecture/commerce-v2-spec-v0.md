# Loadder Commerce Core V2 — Specification v0

This document defines behavior, not implementation.

## Domain primitives
- `Money`: integer minor units plus ISO/provider-neutral currency code.
- `Product`: sellable concept with slug, status, content, classification and metadata.
- `Variant`: purchasable SKU with options, price override, inventory policy and lifecycle state.
- `InventoryUnit`: on-hand, reserved and committed quantities per variant/location.
- `Cart`: mutable collection of priced lines before order creation.
- `Order`: immutable commercial snapshot created from a validated cart.
- `Promotion`: rule set that can alter cart price when eligibility conditions are satisfied.

## Required invariants
- monetary values are integers; floating point is forbidden in persisted money calculations.
- tenant/workspace ownership is mandatory on every write and every lookup.
- a cart cannot contain variants from another store.
- an inactive product or variant cannot enter a new cart.
- inventory cannot oversell when policy is `DENY`.
- order line prices are snapshots and never change when catalog prices later change.
- promotion calculations are deterministic for identical inputs.
- domain functions do not mutate their inputs.

## Catalog / Variant v0
### Product
A product owns `workspaceId`, `storeId`, lifecycle status, slug, classification and metadata. IDs and ownership fields are immutable across updates.

### Variant
A variant owns a globally scoped SKU within its storage boundary, product ownership, option values, optional price override, lifecycle state and inventory policy.

### Sellability
A variant is sellable only when:
- its product is `ACTIVE`;
- the variant itself is active;
- product, variant, workspace and store ownership agree.

Cross-workspace, cross-store or cross-product relationships are rejected before pricing/cart operations.

## Inventory Reservation v0
Inventory is modeled per `(workspace, store, variant, location)`.

`available = onHand - reserved - committed`

### Operations
- `reserve`: moves available capacity into `reserved` without reducing `onHand`.
- `release`: decreases `reserved`.
- `commit`: moves units from `reserved` to `committed`.
- `adjustOnHand`: changes physical stock while preventing `onHand` from dropping below allocated stock.

### Rules
- quantity inputs are integers.
- reservation/release/commit operations are deterministic and return new state rather than mutate input state.
- `DENY` rejects reservations larger than available stock.
- `ALLOW` permits backorder-style negative availability but never changes the original state.
- release/commit cannot underflow an existing reservation.
- initial inventory state may not have `reserved + committed > onHand`.
- snapshots have stable ordering so persistence/event hashing is reproducible.

## Promotion v0
### Supported reward types
- percentage discount
- fixed cart discount
- fixed line discount

### Eligibility conditions
- minimum subtotal
- product/category/brand inclusion
- product/category/brand exclusion
- minimum line quantity
- start/end time
- usage limit

### Evaluation output
`evaluatePromotion(cart, promotion, context)` returns a provider-neutral result:
- `eligible`
- `discountMinor`
- `lineDiscounts[]`
- `reasonCodes[]`
- `promotionId`

### Rules
- final discount cannot exceed eligible merchandise value.
- percentage is clamped to 0..100.
- inactive/expired/exhausted promotions return zero discount with a reason code.
- exclusions win over inclusions.
- no mutation of cart input is allowed during evaluation.

## Fulfillment v0
A Fulfillment is a provider-neutral allocation of one or more immutable Order lines to a shipment/delivery lifecycle. It does not mutate the Order snapshot and it does not perform returns or refunds.

### Creation
A new fulfillment:
- belongs to exactly one workspace, store and order;
- may be created only for orders in a fulfillable state (`CONFIRMED` or `PROCESSING` in v0);
- references existing immutable order-line IDs;
- uses positive integer quantities;
- rejects duplicate order-line references inside the same fulfillment;
- counts active pending/packing/shipped/delivered allocations when checking remaining quantity;
- rejects any allocation that would exceed the ordered quantity across active fulfillments.

Existing/persisted fulfillment history is treated as untrusted input at the domain boundary: ownership, order-line references and quantities are revalidated before allocation or summary calculations. Negative, zero or fractional fulfillment quantities are rejected instead of being allowed to corrupt remaining-quantity calculations.

A cancelled fulfillment releases its unshipped allocation so a replacement fulfillment may be created without over-fulfilling the order.

### Lifecycle
Fulfillment states are forward-only:

`PENDING -> PACKING -> SHIPPED -> DELIVERED`

Cancellation is allowed only before shipping:

- `PENDING -> CANCELLED`
- `PACKING -> CANCELLED`

`SHIPPED`, `DELIVERED` and `CANCELLED` cannot move backward. Shipping carrier, tracking number and tracking URL are provider-neutral optional metadata because local/manual delivery may legitimately have no carrier tracking number.

Lifecycle timestamps must be valid timestamps and may not move the fulfillment clock backward. A transition cannot occur before fulfillment creation or before its current `updatedAt`; delivery cannot occur before shipment. This keeps persisted history internally chronological even when callers provide explicit timestamps.

### Tracking
Tracking events are append-only immutable facts identified by a unique event ID within a fulfillment. Recording a tracking event returns a new fulfillment value and never mutates earlier snapshots. Duplicate event IDs are rejected. Cancelled fulfillments cannot receive new tracking events.

A tracking event cannot predate fulfillment creation. Carrier events may arrive out of chronological delivery order, so appending an older valid tracking fact does not rewrite history or move the fulfillment aggregate `updatedAt` backward.

### Derived order fulfillment status
Order fulfillment status is derived from shipped/delivered quantities, not from merely allocating a pending fulfillment:

- `UNFULFILLED`: no ordered quantity has shipped;
- `PARTIAL`: some but not all ordered quantity has shipped;
- `FULFILLED`: all ordered quantity has shipped.

The fulfillment summary separately exposes ordered, allocated, fulfilled/shipped and delivered quantities per order line. This distinction is required so partial shipments and later Returns / Refunds can reason from physical delivery facts instead of mutable catalog data.

### Returns boundary
Fulfillment v0 intentionally does not create return or refund records. Returns / Refunds v0 must reference real fulfilled/delivered quantities and must not rewrite fulfillment or financial history.

## V2 compatibility goal
The V2 core must eventually satisfy the existing Loadder Commerce Provider Contract for product, variant, inventory, cart, coupon/shipping, checkout and order operations. New capabilities may extend the contract only through explicit versioning.

## Future agent-facing contract
V2 domain operations must remain suitable for safe tool exposure such as `discover_products`, `check_inventory`, `create_cart`, `apply_promotion`, `checkout`, `get_order`, `track_order` and `return_item`, with authorization enforced outside the domain functions.
