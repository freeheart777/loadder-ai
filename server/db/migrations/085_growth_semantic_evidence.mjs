export const migration085GrowthSemanticEvidence = {
  version:85,
  name:'growth_semantic_evidence',
  up(db) {
    db.transaction(()=>{
      const row=db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='trg_semantic_findings_insert_guard'").get();
      const original="'listening_topic_match','listening_trend_signal','listening_anomaly_result'";
      if(!row?.sql.includes(original)) throw new Error('Unexpected semantic guard definition');
      if(!row.sql.includes("'growth_evidence_link'")) {
        db.exec('DROP TRIGGER trg_semantic_findings_insert_guard');
        db.exec(row.sql.replace(original,original+",'growth_evidence_link'"));
      }
      db.exec(`CREATE TRIGGER IF NOT EXISTS trg_semantic_growth_evidence_guard BEFORE INSERT ON semantic_findings BEGIN
        SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.evidence_manifest_json) e
          WHERE json_extract(e.value,'$.kind')='growth_evidence_link' AND NOT EXISTS(
            SELECT 1 FROM growth_evidence_links g WHERE g.id=json_extract(e.value,'$.id')
              AND g.workspace_id=NEW.workspace_id AND g.context_version_id=NEW.context_version_id))
          THEN RAISE(ABORT,'growth semantic evidence mismatch') END;
      END;`);
    }).immediate();
  },
};
