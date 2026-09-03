# Loadder Low-Cost Production Runbook

Goal: operate Loadder professionally without paying for unnecessary always-on infrastructure.

## Default commercial topology

```text
TLS / Reverse Proxy
  -> Loadder Web + API
  -> PostgreSQL
  -> Object Storage
  -> Queue only when asynchronous work exists
  -> Ephemeral workers for builds, heavy AI and risky execution
```

Do not require Kubernetes or one container/server per customer by default.

## Small installation profile
- 1 web/API instance with health checks and restart policy.
- Managed or self-hosted PostgreSQL with automated daily backups.
- S3-compatible object storage; local disk only for development/single-node controlled installations.
- No always-on AI worker pool. Start workers only for queued heavy tasks.
- Reverse proxy terminates TLS and applies request/body limits.

## Scale triggers
Add another web/API instance only when measured CPU, memory, latency or availability requires it. Add queue workers when background-job wait time becomes measurable. Add read replicas/caching only after database evidence shows they are needed. Kubernetes is a scale decision, never a starting assumption.

## Mandatory production gates
1. Server Tests, Frontend Build and Security Supply Chain green on exact release SHA.
2. Database migrations tested on a backup/copy before production rollout.
3. Backup exists and restore procedure has been verified.
4. Secrets are outside repository/database payloads and rotated through environment/secret manager.
5. Production approval exists for the active app version.
6. Canary + synthetic health check succeeds before promotion.
7. Rollback target/artifact/version is known before deploy starts.
8. Health endpoints and structured error logs are visible.
9. Tenant/workspace isolation tests are green.
10. AI provider outage does not break deterministic builder/runtime paths.

## Backup / restore standard work
- PostgreSQL: automated daily backup + retention appropriate to plan; create an on-demand backup before schema migrations.
- Object storage: versioning/lifecycle policy where available.
- Loadder app definitions and versions remain exportable through owned contracts.
- Restore drill: restore database to an isolated environment, boot Loadder, authenticate, open a generated project, verify active version and representative runtime records.
- A backup that has never been restored is not considered verified.

## Availability / Jidoka
- API readiness must fail if required persistence is unavailable.
- Heavy worker failure must not kill control plane.
- Failed canary must rollback automatically and block promotion.
- Invalid app definitions, unsafe sandbox capabilities and unapproved external actions fail closed.

## Cost discipline
- Measure AI tokens/cost per workspace/app/task.
- Prefer deterministic paths with zero token cost.
- Keep idle tenant cost near database/storage overhead.
- Ephemeral compute is reserved for builds, high-risk execution and sustained workloads.
- Introduce services only when a measured bottleneck justifies them.

## Release sequence (Standard Work)
`backup -> migrate/check -> deploy candidate -> smoke -> canary -> health -> promote -> observe -> close release`

If any gate is red: stop the line, diagnose root cause, correct it, add prevention/regression coverage, then restart the release sequence.
