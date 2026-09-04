# Loadder Commerce Customer Accounts v0

This document defines the first Customer Account boundary for Commerce V2. It is intentionally a commerce-profile layer, not a second authentication system.

## Identity source of truth

Customer Accounts do not own passwords, sessions, invite tokens, login state, or primary application-user identity.

The existing App Builder app-user authentication system remains the identity source of truth. Commerce receives a resolved app-user principal plus the auth-project identity already resolved for the current store, and binds a customer account to:

- `identitySource = APP_USER`
- immutable app-user subject ID
- immutable auth project ID
- workspace
- store

Account creation requires the store's resolved `authProjectId` explicitly. The principal's `projectId` must exactly match that store auth project. This prevents an app user from one generated application/project from being bound accidentally to another store's Commerce customer account even when both are inside the same broader workspace.

The domain does not infer that `storeId === projectId`; the application/store adapter owns that mapping and must pass the already-authorized auth project explicitly.

Email is not a customer-account identity key. An email change must not create a second commerce customer. Authentication tokens and credentials must never be copied into Customer Account metadata.

V0 accepts only an active resolved app-user with role `customer`. Employee/manager/admin buyer semantics, impersonation, delegated purchasing, and B2B organization buyers require separate contracts.

## Account uniqueness

Within one workspace/store/auth-project boundary, one app-user subject may bind to at most one Customer Account.

Callers that create accounts must supply complete relevant account history until persistence adds a database uniqueness boundary. Persisted implementations must eventually enforce this uniqueness transactionally rather than rely on check-then-insert application logic.

Existing account history is treated as untrusted input and is revalidated before it can establish uniqueness.

## Profile data

Customer Account profile data is mutable convenience data. V0 supports:

- display name
- phone

Changing profile data must not change the immutable app-user identity binding.

Customer Account profile data is not authoritative authentication data. In particular, email/login state continues to belong to App User Auth.

## Address book

A Customer Account may maintain saved addresses for checkout convenience.

Each address has a stable address ID and contains the delivery/contact snapshot fields needed by checkout. Default shipping and billing addresses are explicit references to saved address IDs.

Address book changes are mutable profile changes only. They must never rewrite an Order's historical shipping or billing address snapshot. Checkout copies address facts into the immutable Order; later editing or deleting the saved address leaves past Orders unchanged.

Removing a saved address clears any default pointer that referenced that address.

## Mutation authorization boundary

Domain mutations require the same resolved active customer app-user principal that is bound to the Customer Account. A different subject or auth project cannot mutate the account, address book, or create order ownership links.

Workspace/store authorization remains an application/persistence responsibility outside the pure domain engine, using authenticated tenant context. Account creation additionally requires the store adapter's explicit auth-project binding and validates it against the resolved principal. The domain verifies workspace/store agreement between Customer Account and Order when producing links.

## Customer Order ownership links

Customer ownership of an Order is represented as a separate immutable link fact rather than mutating historical Order snapshots.

A link records:

- link ID
- workspace/store
- Order ID
- Customer Account ID
- app-user identity subject
- auth project ID
- source
- link timestamp

V0 permits only `source = CHECKOUT`.

An Order may have at most one Customer ownership link in the supplied relevant history. Duplicate link IDs and duplicate Order ownership are rejected.

The link timestamp cannot predate Order creation.

## Guest checkout boundary

V0 does not implement post-hoc claiming of guest Orders.

Attaching a historical guest Order after checkout requires an explicit proof-of-ownership protocol such as verified email/phone ownership, signed claim token, authenticated payment proof, or another deliberate recovery mechanism. Simply matching an email, phone number, address, or name is not sufficient authorization.

Until that protocol exists, `POST_HOC_CLAIM` and equivalent link sources are forbidden.

## Privacy and deletion boundary

V0 does not invent account erasure/anonymization workflows. Historical Orders, Ledger entries, fulfillment facts, returns, and refunds have separate retention/audit requirements and must not be rewritten by deleting mutable Customer Account profile data.

A future privacy workflow must distinguish removable profile data from legally/audit-required immutable commerce history.

## Persistence boundary

This phase is dark-domain work only. It does not add production routes, database tables, migrations, customer-facing account pages, or authentication flows.

A later persistence phase must enforce at least:

- unique customer account ID
- unique `(workspace, store, auth_project, identity_subject)` binding
- validated store-to-auth-project ownership/mapping before account creation
- unique Order ownership link per Order
- tenant/store foreign ownership integrity
- transaction-safe account/link creation
- safe optimistic/concurrent updates for mutable profile/address data

The persistent implementation must reuse App User Auth rather than creating parallel customer credentials or sessions.
