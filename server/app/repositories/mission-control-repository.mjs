import { requireWorkspaceId } from "../tenant-context.mjs";
import { CRM_GROWTH_SOURCE } from "../growth/crm-evidence-contract.mjs";

export function createMissionControlRepository(db) {
  const workspace = () => requireWorkspaceId();

  function undecidedRecommendations(limit) {
    const rows = db.prepare(`SELECT r.id,r.recommendation_type,r.consideration_code,r.rationale_code,
      r.context_version_id,r.subject_type,r.subject_id,r.calculated_at,r.confidence_reason
      FROM intelligence_recommendations r WHERE r.workspace_id=?
      AND NOT EXISTS(SELECT 1 FROM decision_records d WHERE d.workspace_id=r.workspace_id AND d.recommendation_id=r.id)
      ORDER BY r.calculated_at ASC,r.id ASC LIMIT ?`).all(workspace(), limit + 1);
    return { items: rows.slice(0, limit), truncated: rows.length > limit };
  }

  function closedExperimentsWithoutDecision(at, limit) {
    const rows = db.prepare(`SELECT e.id,e.status,e.ends_at,e.context_version_id,e.goal_ref
      FROM experiments e WHERE e.workspace_id=? AND e.ends_at IS NOT NULL AND e.ends_at<=? AND e.status<>'CANCELLED'
      AND NOT EXISTS(
        SELECT 1 FROM intelligence_recommendations r JOIN decision_records d
          ON d.workspace_id=r.workspace_id AND d.recommendation_id=r.id
        WHERE r.workspace_id=e.workspace_id AND r.recommendation_type='EXPERIMENT_OUTCOME_REVIEW'
          AND r.subject_type='experiment' AND r.subject_id=e.id)
      ORDER BY e.ends_at ASC,e.id ASC LIMIT ?`).all(workspace(), at, limit + 1);
    return { items: rows.slice(0, limit), truncated: rows.length > limit };
  }

  function stuckCandidates(pendingBefore, limit) {
    const rows = db.prepare(`SELECT c.id,c.state,c.created_at,c.updated_at,b.experiment_id
      FROM growth_content_candidates c JOIN growth_content_briefs b
        ON b.id=c.brief_id AND b.workspace_id=c.workspace_id
      WHERE c.workspace_id=? AND (c.state='RECONCILIATION_REQUIRED' OR(c.state='PENDING' AND c.created_at<=?))
      ORDER BY CASE c.state WHEN 'RECONCILIATION_REQUIRED' THEN 0 ELSE 1 END,
        c.created_at ASC,c.id ASC LIMIT ?`).all(workspace(), pendingBefore, limit + 1);
    return { items: rows.slice(0, limit), truncated: rows.length > limit };
  }

  function unlinkedCrmConversions(since, limit) {
    const rows = db.prepare(`SELECT e.id,e.occurred_at,e.subject_id,e.context_version_id
      FROM business_events e WHERE e.workspace_id=? AND e.event_type='lead.converted'
      AND e.source_type=? AND e.subject_type='lead' AND e.occurred_at>=?
      AND NOT EXISTS(SELECT 1 FROM growth_evidence_links g WHERE g.workspace_id=e.workspace_id
        AND (g.source_event_id=e.id OR(g.object_type='EVENT' AND g.object_id=e.id)))
      ORDER BY e.occurred_at ASC,e.id ASC LIMIT ?`).all(workspace(), CRM_GROWTH_SOURCE, since, limit + 1);
    return { items: rows.slice(0, limit), truncated: rows.length > limit };
  }

  return Object.freeze({ undecidedRecommendations, closedExperimentsWithoutDecision, stuckCandidates, unlinkedCrmConversions });
}
