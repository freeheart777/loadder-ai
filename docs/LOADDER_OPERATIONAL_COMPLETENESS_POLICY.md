# Loadder Operational Completeness Policy

This policy is mandatory for Business Builder and any future Loadder product module.

## Definition of Done

A feature is **not done** because a screen, button, mock, contract, or backend method exists. It is done only when the intended user action has a verified operational path.

Required path when applicable:

`UI -> authenticated API -> validation -> service/domain logic -> persistence/runtime -> observable result -> recovery/error behavior`

## Mandatory checks for every added capability

1. **Frontend wiring** — the visible control calls a real authenticated endpoint or a proven local runtime contract.
2. **Backend wiring** — the endpoint reaches the intended service/domain implementation; no placeholder success responses.
3. **Persistence/runtime proof** — state changes survive through the owned persistence layer, or the execution result is observable from the runtime.
4. **Reload proof** — persisted changes can be re-read after a fresh request; UI-only state is insufficient.
5. **Version/restore proof** — builder mutations that alter an application create an immutable version and remain restorable when applicable.
6. **Tenant isolation** — workspace/project identity is enforced server-side, never trusted from arbitrary client payloads.
7. **Validation** — malformed or unsupported inputs fail closed.
8. **Failure behavior** — provider outage, timeout, duplicate request, and partial failure must not silently report success.
9. **Idempotency** — side-effecting actions must not duplicate on retry/double-click.
10. **Audit/governance** — external or material AI/operator actions require traceability and explicit approval where defined.
11. **Test evidence** — add unit/regression/integration tests proving the path. Prefer tests that exercise persistence or runtime, not only pure mocks.
12. **CI evidence** — Server Tests, Frontend Build, and Security Supply Chain must pass on the current head before calling the milestone ready.

## Commercial UI rule

Normal users must not need to understand schemas, containers, migrations, providers, adapters, or source files. Product complexity stays behind a simple studio experience, but simplicity must never be implemented by faking functionality.

## Status language

Use these labels accurately:
- `supported`: operational path exists and required gates pass.
- `alpha`: operational path exists but reliability/coverage is not yet commercial-grade.
- `planned`: architecture/roadmap only; do not market as available.

## Native mobile truth rule

iOS/Android must stay `planned` until native renderer, backend/runtime parity, signing/build pipeline, installable build, smoke tests, and release workflow are proven. PWA must never be presented as equivalent to native App Store delivery.

## Enforcement

When architecture or implementation materially changes, update the canonical Roadmap and relevant commercial spec in the same PR series. If a feature cannot prove its operational path, keep it behind an experimental flag or omit it from the commercial surface.
