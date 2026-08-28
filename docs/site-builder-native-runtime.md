# Native Site Builder Runtime Contract

## Goal

Loadder's Site Builder is a first-party runtime, not a redirect or dependency on iportals.ir.

## Product flow

1. A workspace opens Site Builder.
2. The builder can start from active Business Profile, Business DNA, Brand Book, catalog/product data, or explicit user-provided descriptions.
3. The user can manually upload product images and other assets, including hero/header banners and section-specific banners.
4. The builder generates an editable site project composed of pages, sections, content, and asset references.
5. The user previews and publishes the project through Loadder's own runtime.
6. The published site is served from a stable project/site identity and remains isolated by workspace.

## Site types

The initial templates should cover:

- business / corporate
- ecommerce / product catalog
- news / magazine
- professional services
- lawyer / appointment booking
- clinic / doctor / appointment booking

Templates are presentation contracts. Business data remains canonical in the existing domain layer.

## Assets

Assets are first-class, workspace-scoped records. Uploads must support:

- product images
- logo and brand assets
- hero/header banners
- section banners
- gallery images
- future downloadable assets

Every asset must have bounded size/type validation, immutable identity, ownership metadata, and a storage reference. Runtime HTML must never execute uploaded content as code.

## Integrations

The Site Builder dashboard should expose optional connections for:

- CRM
- payment gateway
- Google Analytics
- future marketing and messaging integrations

Credentials must remain secret references and never be returned by public site APIs.

## Dashboard

Each site project needs an administrative dashboard showing at minimum:

- publication state and last publication time
- page count
- product count
- asset count
- basic traffic/analytics connection state
- CRM connection state
- payment connection state
- appointment capability when enabled

## Security and scale

The public runtime must derive site ownership from the published site identifier and never trust a client-supplied workspace identifier. Published content should be immutable by version. Uploads require MIME, extension, size, path, and content validation. Public rendering must be cache-friendly and must not perform unbounded database work per request.

The architecture should allow SQLite in the current modular monolith and later move site/project metadata to PostgreSQL, assets to object storage/CDN, and publication/rendering to horizontally scalable workers without changing the public contract.

## Legacy removal

No Site Builder navigation, publish action, API, or runtime path should send users to `iportals.ir`. Any legacy iportals reference must be removed or isolated behind an explicitly unsupported migration boundary.
