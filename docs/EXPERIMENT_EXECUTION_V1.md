# Experiment Execution V1

The experiment execution boundary is intentionally provider-agnostic.

- `plan()` creates a deterministic, context-pinned execution plan.
- `start()` creates and starts a tenant-scoped run.
- `execute()` accepts an injected executor and runs it against the pinned plan/run.
- Executor output is evaluated by the existing guardrails before completion.
- Executor failures transition the run to `FAILED` with a bounded execution-error outcome.
- No provider, AI vendor, or external execution system is coupled to the experiment domain yet.
