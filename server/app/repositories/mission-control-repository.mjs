import { requireWorkspaceId } from "../tenant-context.mjs";
import { CRM_GROWTH_SOURCE } from "../growth/crm-evidence-contract.mjs";

export function createMissionControlRepository(db) {
  const workspace = () => requireWorkspaceId();

  function undecidedRecommendations(limit) {
    const rows = db.prepare(`SELECT r.id,r.recommendation_type,r.consideration_code,r.rationale_code,
      r.context_version_id,r.subject_type,r.subject_id,r.subject_key,r.calculated_at,r.confidence_reason
      FROM intelligence_recommendations r WHERE r.workspace_id=?
      AND NOT EXISTS(SELECT 1 FROM decision_records d WHERE d.workspace_id=r.workspace_id AND d.recommendation_id=r.id)
      ORDER BY r.calculated_at ASC,r.id ASC LIMIT ?`).all(workspace(), limit + 1);
    return { items: rows.slice(0, limit), truncated: rows.length > limit };
  }

  function closedExperimentDecisionState(at, limit, recommendationLimit) {
    const rows = db.prepare(`WITH ended AS (
        SELECT e.id,e.status,e.context_version_id,e.goal_ref,
          COALESCE(json_extract(e.goal_contract_json,'$.measurementWindow.end'),e.ends_at) AS window_end
        FROM experiments e WHERE e.workspace_id=? AND e.status<>'CANCELLED'
          AND COALESCE(json_extract(e.goal_contract_json,'$.measurementWindow.end'),e.ends_at) IS NOT NULL
          AND COALESCE(json_extract(e.goal_contract_json,'$.measurementWindow.end'),e.ends_at)<=?
        ORDER BY window_end ASC,e.id ASC LIMIT ?
      ), ranked_recommendations AS (
        SELECT r.id,r.subject_id,r.subject_key,r.calculated_at,
          ROW_NUMBER() OVER(PARTITION BY r.subject_id ORDER BY r.calculated_at DESC,r.id DESC) AS position
        FROM intelligence_recommendations r JOIN ended e ON e.id=r.subject_id
        WHERE r.workspace_id=? AND r.recommendation_type='EXPERIMENT_OUTCOME_REVIEW' AND r.subject_type='experiment'
      )
      SELECT e.*,r.id AS recommendation_id,r.subject_key,r.position AS recommendation_position,
        d.id AS decision_id,d.decision_type
      FROM ended e LEFT JOIN ranked_recommendations r ON r.subject_id=e.id AND r.position<=?
      LEFT JOIN decision_records d ON d.workspace_id=? AND d.recommendation_id=r.id
        AND NOT EXISTS(SELECT 1 FROM decision_records successor WHERE successor.workspace_id=d.workspace_id AND successor.supersedes_decision_id=d.id)
      ORDER BY e.window_end ASC,e.id ASC,r.position ASC,d.id ASC`).all(workspace(), at, limit + 1, workspace(), recommendationLimit + 1, workspace());
    const grouped = new Map();
    for (const row of rows) {
      let item = grouped.get(row.id);
      if (!item) { item={id:row.id,status:row.status,window_end:row.window_end,context_version_id:row.context_version_id,goal_ref:row.goal_ref,recommendations:[],recommendationsTruncated:false}; grouped.set(row.id,item); }
      if (row.recommendation_position > recommendationLimit) item.recommendationsTruncated=true;
      else if (row.recommendation_id) item.recommendations.push({id:row.recommendation_id,subjectKey:row.subject_key,decisionId:row.decision_id,decisionType:row.decision_type});
    }
    const experiments=[...grouped.values()];
    return { items: experiments.slice(0, limit), truncated: experiments.length > limit };
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

  return Object.freeze({ undecidedRecommendations, closedExperimentDecisionState, stuckCandidates, unlinkedCrmConversions });
}
