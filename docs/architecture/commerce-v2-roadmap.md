# Loadder Commerce Core V2 Roadmap

V2 remains dark (not production-routed) until each module satisfies unit, cross-module, tenant-isolation, migration and provider-parity gates.

## Completed foundations
- [x] Provider-independent contract boundary
- [x] Promotion Engine v0
- [x] Catalog / Variant Core v0
- [x] Inventory Reservation Engine v0
- [x] Pricing Engine v0: base/variant/channel price lists, currency integrity, deterministic resolution
- [x] Cart Engine v0: immutable line snapshots, quantity transitions, inventory reservation orchestration
- [x] Checkout v0: shipping/tax/payment-neutral validation and idempotency key
- [x] Order Engine v0: immutable order snapshot and state machine
- [x] Commerce Financial Ledger foundation
- [x] Fulfillment v0
- [x] Returns / Refunds v0
- [x] Customer Accounts v0
- [x] Customer Account persistence & authenticated self-service v0
- [x] Agent Commerce API safety layer v0

## Next
- [ ] Agent Commerce execution adapter: bind the safety decision to real domain/application operations without bypassing existing invariants
- [ ] Durable agent idempotency receipts and append-only audit trail
- [ ] Provider Adapters v1 where an external provider is actually required (payment / shipping / refund), behind provider-neutral contracts
- [ ] Migration / shadow traffic / cutover rehearsal

## Production cutover gates
1. Existing Loadder provider contract parity.
2. Workspace/store isolation tests for every operation.
3. Data migration round-trip with no loss of products, variants, inventory, carts and orders.
4. Load and concurrency tests for reservation/checkout races.
5. Security Supply Chain Gate, dependency audit and targeted penetration testing.
6. Shadow traffic comparison before any write cutover.
7. Rollback to current Loadder Native provider demonstrated.
8. Agent-facing writes require server-side capability authorization, durable idempotency, human confirmation for high-impact actions, auditability and abuse tests.
