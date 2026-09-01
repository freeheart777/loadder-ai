# Loadder Open-Source Intake Policy

## Goal
Open-source may accelerate Loadder, but no upstream project, vendor, cloud service, telemetry endpoint, maintainer account, package registry event, or proprietary control plane may become a single point of failure for Loadder.

## Ownership and licensing
- Loadder-owned code, adapters, schemas, UI, workflows, integrations, tests, deployment manifests, and custom business logic remain Loadder-owned.
- Third-party source remains subject to its original license. We do not relabel third-party authorship or copyright as our own.
- Any third-party engine adopted into Loadder must be pinned to an exact version/commit and accompanied by its license, notices, source snapshot or reproducible source reference, dependency lockfile, and build instructions.
- Copyleft or source-available licenses require explicit legal review before production adoption.

## Mandatory intake checks
Before any external code can be enabled in runtime, all of the following must pass:

1. **Source provenance**
   - exact upstream repository, tag and commit recorded
   - signed release/tag checked when available
   - checksum/SBOM recorded for vendored artifacts

2. **Backdoor and execution review**
   - search for `eval`, `new Function`, dynamic module loading, shell execution, `child_process`, `exec`, `spawn`, encoded payload loaders and remote code download
   - inspect install lifecycle scripts (`preinstall`, `install`, `postinstall`, `prepare`)
   - inspect binary blobs and prebuilt native modules; provenance must be documented

3. **Network and telemetry review**
   - enumerate every outbound host contacted at build time and runtime
   - telemetry/analytics/crash reporting must be removable or disabled by default
   - no upstream SaaS, license server, feature flag server, hosted admin, CDN, or control-plane dependency may be required for storefront availability

4. **Secrets and credentials**
   - no embedded API keys, tokens, private keys or default production credentials
   - secrets must come from Loadder-owned secret management/environment configuration

5. **Dependency security**
   - dependency tree and lockfiles reviewed
   - known critical/high vulnerabilities triaged before release
   - dependency confusion / typosquatting risks checked
   - registries and package names must be explicit and pinned through lockfiles

6. **Isolation and permissions**
   - least-privilege filesystem, database and network permissions
   - external commerce providers live behind Loadder's provider contract
   - provider-specific models must not leak into Studio, CRM, Ads, Business Brain, public APIs or analytics contracts

7. **Data portability and exit test**
   - all products, variants, inventory, customers, carts, orders, promotions and fulfillment data must be exportable to Loadder-owned formats
   - migration path back to `loadder-native` or another provider must be documented and tested

8. **Offline/upstream-outage drill**
   - block upstream GitHub/vendor/cloud endpoints after installation
   - Product -> Cart -> Checkout -> Order must continue to work
   - restart/deploy must work from Loadder-controlled artifacts without contacting upstream

## Production rule
A third-party commerce engine is never called directly by product code. Runtime access must go through the Loadder Commerce Provider Contract. A provider failing this policy may be used only as a research reference, not production infrastructure.

## Security statement
Passing these checks reduces risk but does not prove the absence of all vulnerabilities or backdoors. Security is maintained through repeated review, dependency monitoring, penetration testing, incident response and controlled upgrades.