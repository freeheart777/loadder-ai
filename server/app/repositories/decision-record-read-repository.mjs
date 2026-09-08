import { requireWorkspaceId } from '../tenant-context.mjs';

const parse=(value,fallback)=>{try{return JSON.parse(value);}catch{return fallback;}};
const MAX_FINDINGS=50,MAX_EVIDENCE=200;

export function createDecisionRecordReadRepository(db) {
  function get(decisionId) {
    const workspaceId=requireWorkspaceId();
    const row=db.prepare(`SELECT d.*,r.recommendation_type,r.subject_type,r.subject_id,r.subject_key,
      r.semantic_manifest_json,r.point_in_time_cutoff,r.producer AS recommendation_producer,
      r.producer_version AS recommendation_producer_version,r.provenance_json AS recommendation_provenance,
      r.confidence AS recommendation_confidence,r.confidence_reason AS recommendation_confidence_reason,
      (SELECT id FROM decision_records s WHERE s.workspace_id=d.workspace_id AND s.supersedes_decision_id=d.id LIMIT 1) AS superseded_by_decision_id
      FROM decision_records d JOIN intelligence_recommendations r
        ON r.id=d.recommendation_id AND r.workspace_id=d.workspace_id AND r.recommendation_version=d.recommendation_version
      WHERE d.id=? AND d.workspace_id=?`).get(decisionId,workspaceId);
    if(!row)return null;

    const findings=db.prepare(`SELECT s.* FROM json_each(?) m JOIN semantic_findings s
      ON s.id=json_extract(m.value,'$.id') AND s.workspace_id=?
      ORDER BY CAST(m.key AS INTEGER) LIMIT ?`).all(row.semantic_manifest_json,workspaceId,MAX_FINDINGS+1);
    const findingsTruncated=findings.length>MAX_FINDINGS,selectedFindings=findings.slice(0,MAX_FINDINGS);
    const evidenceIds=[...new Set(selectedFindings.flatMap(f=>parse(f.evidence_manifest_json,[])
      .filter(e=>e?.kind==='growth_evidence_link'&&typeof e.id==='string').map(e=>e.id)))].slice(0,MAX_EVIDENCE+1);
    const evidenceTruncated=evidenceIds.length>MAX_EVIDENCE,selectedIds=evidenceIds.slice(0,MAX_EVIDENCE);
    const evidence=selectedIds.length?db.prepare(`SELECT g.*,e.occurred_at FROM growth_evidence_links g
      LEFT JOIN business_events e ON g.object_type='EVENT' AND e.id=g.object_id AND e.workspace_id=g.workspace_id
      WHERE g.workspace_id=? AND g.id IN (${selectedIds.map(()=>'?').join(',')})`).all(workspaceId,...selectedIds):[];
    const evidenceById=new Map(evidence.map(item=>[item.id,item]));
    return {row,findings:selectedFindings,evidence:selectedIds.map(id=>evidenceById.get(id)).filter(Boolean),findingsTruncated,evidenceTruncated};
  }
  return Object.freeze({get});
}

export const DECISION_RECORD_READ_LIMITS=Object.freeze({findings:MAX_FINDINGS,evidence:MAX_EVIDENCE});
