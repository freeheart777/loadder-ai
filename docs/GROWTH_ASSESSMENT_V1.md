# Growth review readiness v1

Ownership: `semantic_findings` holds immutable assessments;
`intelligence_recommendations` holds `EXPERIMENT_OUTCOME_REVIEW`; existing review and
decision APIs own human governance. No parallel store or automatic execution exists.

`POST /api/growth/assessments` accepts only experimentId, contextVersionId and
approved candidateId. Active owner/admin and pinned active context are required.
Existing semantic/recommendation read APIs expose the resulting identities.

Policy **growth-review-readiness/1** is deterministic and has no AI/provider call:
- Assess `lead_count` canonical CRM facts only. Other metrics remain INCONCLUSIVE.
- ACTIONABLE means enough recorded evidence to review, never successful/effective.
- Minimum one distinct canonical lead is the minimum existence proof for review,
  not a statistical sample threshold. Duplicate lead identities count once.
- Read at most 201 candidate links; retain at most 200. Overflow is INCONCLUSIVE.
- Complete means the configured measurement window has ended and the bounded scan
  covers all recorded candidate links. This is NOT proof of all real-world outcomes.
- Freshness means active nonstale context, unsuperseded evidence and event timestamp
  inside the measurement window, with no future event/record. No invented age TTL.
- Accept CRM_CONVERSION/REPORTED only after independently resolving reserved CRM
  source and real lead/customer relationship. A label alone provides no authority.
- Missing/unverified baseline provenance is INCONCLUSIVE. An existing baseline does
  not establish comparable period/population; comparison remains UNKNOWN and uplift
  is null even when review-ready. No denominators, rates or causal claims are inferred.
- Any unsupported or out-of-window evidence makes the result INCONCLUSIVE.

The NBA can only propose GATHER_MORE_EVIDENCE or INSPECT_FUNNEL_BOTTLENECK. It records
the exact finding/manifest, observed condition, hypothetical benefit, UNKNOWN cost,
low review-only risk and human-review requirement. Adoption remains BUSINESS_INTENT,
not execution permission. Legacy last-touch attribution is not consumed or upgraded.

Content-addressed identity includes policy, pinned references, goal contract, selected
evidence and readiness state. Identical replay converges; changed evidence/policy
creates a new immutable finding. No caller idempotency key or conflict-prone overwrite.
Both finding and NBA persist in one transaction; failure rolls both back.

Migration 085 changes only the manifest allowlist trigger and adds the Growth
reference guard. No rows/hashes/tables/columns are rewritten. Existing guards remain;
transaction failure restores them. Disable the producer on rollback, retain findings.

Lean footprint: indexed candidate scan plus joins, bounded manifest, no N+1, polling,
worker or dependencies. Cost follows assessment requests, not registered users at
50/500/5,000 scale. Production latency/SQLite contention still need measurement.

## LOADDER_IMPROVEMENT_BACKLOG

- P2/NEXT/M: comparable baseline window/population is absent; define authoritative
  comparison provenance before effectiveness analysis. Contract/schema review and
  negative comparison tests required; no inferred uplift now.
- P2/NEXT/M: capture completeness is not evidenced; add source coverage proof before
  business-wide totals. Reuse event/evidence owners; review persistence separately.
- P2/NEXT/S: current recommendation freshness tracks context and newer recommendation,
  not all newly arriving evidence. Recalculate before consequential review; extend the
  existing freshness resolver with bounded evidence identity checks in a focused PR.
- P2/LATER/M: model-assigned legacy attribution is not causal evidence. Preserve its
  explicit label; independent attribution validation is outside this PR.
- P2/NEXT/S: measure assessment query cost on a normal VPS before increasing the cap.

Existing immutable findings, recommendation identities and non-executing governance
are strong and deliberately reused.
