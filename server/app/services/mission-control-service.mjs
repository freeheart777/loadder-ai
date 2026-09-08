import { MISSION_CONTROL_RANKING_POLICY as policy, missionControlBand, overduePoints } from "../mission-control/ranking-policy.mjs";

const UNKNOWN = Object.freeze(["BUSINESS_IMPACT_VALUE", "CAUSALITY", "ATTRIBUTION"]);
const sourceRef = (type, id) => ({ type, id });
const fact = (label, value, type, id) => ({ label, value, sourceRef: sourceRef(type, id) });

export function createMissionControlService({ repository, businessContextService, now = () => new Date() }) {
  function getMissionControl() {
    const generated = now();
    const generatedAt = generated.toISOString();
    const pendingBefore = new Date(generated.getTime() - policy.pendingAgeFloorMs).toISOString();
    const conversionSince = new Date(generated.getTime() - policy.conversionLookbackMs).toISOString();
    const candidates = [];
    const signalStatus = [];
    let truncated = false;
    const collect = (signalId, read, map) => {
      try {
        const result = read();
        truncated ||= result.truncated;
        candidates.push(...result.items.map(map));
        signalStatus.push({ signalId, status: "ok" });
      } catch {
        signalStatus.push({ signalId, status: "failed" });
      }
    };

    collect("S2", () => repository.closedExperimentDecisionState(generatedAt, policy.maxItems, policy.maxRecommendationsPerExperiment), row => {
      const recommendationIds=new Set(row.recommendations.map(item=>item.id));
      const heads=row.recommendations.filter(item=>item.decisionId);
      const decisionState=row.recommendationsTruncated||recommendationIds.size>1||heads.length>1 ? "AMBIGUOUS"
        : heads.length===0 ? "NO_DECISION" : heads[0].decisionType==="DEFER" ? "DEFERRED"
        : ["ADOPT","DECLINE"].includes(heads[0].decisionType) ? "DECIDED" : "AMBIGUOUS";
      if(decisionState==="DECIDED")return null;
      return {
      signalId: "EXPERIMENT_WINDOW_CLOSED_NO_DECISION", subjectIdentity:`experiment:${row.id}`, relevantAt: row.window_end,
      score: 3 + overduePoints(row.window_end, generated) + 2,
      facts: [fact("EXPERIMENT_STATUS", row.status, "EXPERIMENT", row.id), fact("MEASUREMENT_WINDOW_ENDED_AT", row.window_end, "EXPERIMENT", row.id),fact("DECISION_STATE",decisionState,"EXPERIMENT",row.id)],
      beliefs: [], unknown: [...UNKNOWN, "EXPERIMENT_EFFECTIVENESS"],
      action: { label: "REVIEW_EXPERIMENT_OUTCOME", requiredApproval: "HUMAN_REVIEW", executable: false, deepLink: `/dashboard/growth-loop/${row.id}` },
      explainability: { experimentId: row.id }, whyThisIsHere: "MEASUREMENT_WINDOW_ENDED_WITHOUT_GOVERNED_DECISION",
    };});
    collect("S4", () => repository.unlinkedCrmConversions(conversionSince, policy.maxItems), row => ({
      signalId: "CONVERTED_LEAD_WITHOUT_TREATMENT_LINKAGE", relevantAt: row.occurred_at, score: 3 + 2 + 2,
      facts: [fact("CRM_EVENT_TYPE", "lead.converted", "BUSINESS_EVENT", row.id), fact("OCCURRED_AT", row.occurred_at, "BUSINESS_EVENT", row.id), fact("EVIDENCE_AUTHORITY", "CANONICAL_RECORD", "BUSINESS_EVENT", row.id)],
      beliefs: [], unknown: [...UNKNOWN, "TREATMENT_LINKAGE"],
      action: { label: "REVIEW_EVIDENCE_LINKAGE", requiredApproval: "HUMAN_REVIEW", executable: false, deepLink: "/dashboard/crm" },
      explainability: { eventId: row.id }, whyThisIsHere: "CANONICAL_CRM_CONVERSION_HAS_NO_GROWTH_EVIDENCE_LINK",
    }));
    collect("S1", () => repository.undecidedRecommendations(policy.maxUndecidedRecommendations), row => ({
      signalId: "UNDECIDED_RECOMMENDATION", subjectIdentity:`${row.subject_type}:${row.subject_id??row.subject_key}`, relevantAt: row.calculated_at, score: 2,
      facts: [fact("RECOMMENDATION_TYPE", row.recommendation_type, "RECOMMENDATION", row.id), fact("CALCULATED_AT", row.calculated_at, "RECOMMENDATION", row.id)],
      beliefs: [{ recommendationId: row.id, code: row.consideration_code, state: row.rationale_code, confidence: null, confidenceReason: "CANONICAL_RECOMMENDATION_CONFIDENCE_UNAVAILABLE" }],
      unknown: [...UNKNOWN], action: { label: "REVIEW_RECOMMENDATION", requiredApproval: "HUMAN_DECISION", executable: false, deepLink: "/intelligence" },
      explainability: { recommendationId: row.id, experimentId: row.subject_type === "experiment" ? row.subject_id : undefined },
      whyThisIsHere: "GOVERNED_RECOMMENDATION_HAS_NO_DECISION",
    }));
    collect("S3", () => repository.stuckCandidates(pendingBefore, policy.maxItems), row => ({
      signalId: "CONTENT_CANDIDATE_STUCK", relevantAt: row.created_at, score: (row.state === "RECONCILIATION_REQUIRED" ? 2 : 0) + 2,
      facts: [fact("CANDIDATE_STATE", row.state, "CONTENT_CANDIDATE", row.id), fact("CREATED_AT", row.created_at, "CONTENT_CANDIDATE", row.id)],
      beliefs: [], unknown: [...UNKNOWN, "PROVIDER_OUTCOME"],
      action: { label: "REVIEW_CONTENT_CANDIDATE", requiredApproval: "HUMAN_REVIEW", executable: false, deepLink: "/dashboard/content" },
      explainability: { candidateId: row.id, experimentId: row.experiment_id }, whyThisIsHere: row.state === "RECONCILIATION_REQUIRED" ? "PROVIDER_OUTCOME_REQUIRES_RECONCILIATION" : "CANDIDATE_PENDING_BEYOND_AGE_FLOOR",
    }));

    const validCandidates=candidates.filter(Boolean);
    const closedSubjects=new Set(validCandidates.filter(item=>item.signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION").map(item=>item.subjectIdentity));
    const deduplicated=validCandidates.filter(item=>item.signalId!=="UNDECIDED_RECOMMENDATION"||!closedSubjects.has(item.subjectIdentity));
    deduplicated.sort((a, b) => b.score - a.score || Date.parse(a.relevantAt) - Date.parse(b.relevantAt) || a.signalId.localeCompare(b.signalId) || JSON.stringify(a.explainability).localeCompare(JSON.stringify(b.explainability)));
    if (deduplicated.length > policy.maxItems) truncated = true;
    const items = deduplicated.slice(0, policy.maxItems).map(({ score, relevantAt: _relevantAt, subjectIdentity: _subjectIdentity, ...item }) => ({ ...item, band: missionControlBand(score) }));
    let banners = [];
    try {
      const context = businessContextService.getCurrentState();
      if (context.isStale) banners = [{ code: "STALE_BUSINESS_CONTEXT", staleReasons: [...context.staleReasons] }];
    } catch { /* Signal results remain visible when banner state is unavailable. */ }
    return { contractVersion: 1, generatedAt, items, banners, signalStatus, bounds: { maxItems: policy.maxItems, truncated } };
  }
  return Object.freeze({ getMissionControl });
}

export const MISSION_CONTROL_LIMITS = policy;
