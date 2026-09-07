# Context-pinned experiment authoring v1

Extends experiments only. Migration 081 adds five nullable columns and two indexes;
no new table, runtime executor, provider, UI or dependency. Existing rows remain
legacy records, with null goal contract fields. No backfill or automatic matching.
Rollback disables authoring and retains columns/rows; never delete history.

POST /api/experiments and GET /api/experiments/:id inherit authenticated workspace
middleware. Authoring additionally resolves active owner/admin membership from
the database. Reads allow active workspace members. Client workspace/role/status
fields are rejected. New experiments are DRAFT, not execution-authorized.

Goal identity is (goal_context_version_id, goal_ref). Contract version 1 describes
the measurement schema, not a global goal revision number. Context goals remain
authoritative strings; objective is copied from the resolved immutable snapshot.
Each experiment row is a definition version; revisions reference a predecessor
and require a distinct valid, non-superseded ADOPT decision. Existing one-decision/
experiment uniqueness is preserved. No approvals or recommendations are invented.

New authoring requires the current non-stale context, including canonical source
freshness checks. Historical rows remain readable after context archival. A new
context establishes a different goal identity; cross-context successor matching
is rejected even when the goal text or array position is identical.

Measurement schema: lead_count or order_count with COUNT; revenue_minor with a
three-letter currency unit; INCREASE/DECREASE; nonnegative safe integer target;
strict UTC window up to 366 days. No measured outcome is inferred from this target.
UNKNOWN baseline contains no value. EVIDENCED baseline cites a current same-tenant,
same-goal Growth Evidence Link of the appropriate kind; currency is checked for
revenue. Its value is an explicitly authored baseline with a citation, not an
automatic verified aggregate or causal claim. Source evidence retains its original
authority. Future aggregation/assessment is outside this PR.

Hypothesis, treatment, metric, window, baseline and goal identity become immutable
for authored rows. Existing lifecycle status semantics are not modified. One direct
successor is enforced in SQL; definition corrections append a new experiment.
Natural replay identity is the existing decision ID: matching definitions converge,
different definitions conflict. Freshness/permission are rechecked on authoring.

## Lean / backlog

Constant indexed lookups and one short immediate transaction; no polling, background
processes, external requests or aggregate scans. Goal index is tenant/context/ref.
50/500/5000-user capacity depends on actual authoring concurrency; measure SQLite
writer contention before adding infrastructure. No capacity claim is made.

P2/NEXT: typed aggregation provenance (sample/window/count semantics) belongs in a
future assessment PR; this PR stores explicit cited baseline values only. Existing
decision requirements intentionally constrain first-party authoring to approved
recommendations; do not bypass them to manufacture onboarding approvals.
