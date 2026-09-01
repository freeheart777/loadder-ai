# Loadder Commerce Core V2 Roadmap

V2 remains dark (not production-routed) until each module satisfies unit, cross-module, tenant-isolation, migration and provider-parity gates.

## Current
- [x] Provider-independent contract boundary
- [x] Promotion Engine v0
- [x] Catalog / Variant Core v0
- [x] Inventory Reservation Engine v0

## Next
- [ ] Pricing Engine v0: base/variant/channel price lists, currency integrity, deterministic resolution
- [ ] Cart Engine v0: immutable line snapshots, quantity transitions, inventory reservation orchestration
- [ ] Checkout v0: shipping/tax/payment-neutral validation and idempotency key
- [ ] Order Engine v0: immutable order snapshot and state machine
- [ ] Fulfillment v0
- [ ] Returns / Refunds v0
- [ ] Customer Accounts v0
- [ ] Agent Commerce API safety layer

## Production cutover gates
1. Existing Loadder provider contract parity.
2. Workspace/store isolation tests for every operation.
3. Data migration round-trip with no loss of products, variants, inventory, carts and orders.
4. Load and concurrency tests for reservation/checkout races.
5. Security Supply Chain Gate, dependency audit and targeted penetration testing.
6. Shadow traffic comparison before any write cutover.
7. Rollback to current Loadder Native provider demonstrated.
