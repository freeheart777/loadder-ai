// Rebuild only the subject CHECK. Copy all columns without normalization/backfill.
export const migration083GrowthCandidateEvidence = {
  version: 83,
  name: 'growth_candidate_evidence',
  up(db) {
    const wasDeferred = db.pragma('defer_foreign_keys', { simple: true });
    db.transaction(() => {
      const original = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='growth_evidence_links'").get()?.sql;
      if (!original) throw new Error('Growth evidence prerequisite missing');
      if (!original.includes("'CONTENT_CANDIDATE'")) {
        const oldCheck = "subject_type IN('CAMPAIGN','EXPERIMENT')";
        if (!original.includes(oldCheck)) throw new Error('Unexpected growth evidence schema');
        const guards = db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='growth_evidence_links' AND type IN('index','trigger') AND sql IS NOT NULL ORDER BY type,name").all();
        // Self-referencing supersedes chains are checked after the atomic replacement.
        db.pragma('defer_foreign_keys = ON');
        db.exec(original.replace('CREATE TABLE growth_evidence_links', 'CREATE TABLE growth_evidence_links_next').replace(oldCheck,"subject_type IN('CAMPAIGN','EXPERIMENT','CONTENT_CANDIDATE')"));
        db.exec('INSERT INTO growth_evidence_links_next SELECT * FROM growth_evidence_links');
        db.exec('DROP TABLE growth_evidence_links');
        db.exec('ALTER TABLE growth_evidence_links_next RENAME TO growth_evidence_links');
        for (const guard of guards) db.exec(guard.sql);
      }
      db.exec(`CREATE TRIGGER IF NOT EXISTS trg_growth_evidence_candidate BEFORE INSERT ON growth_evidence_links WHEN NEW.subject_type='CONTENT_CANDIDATE' BEGIN
 SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM growth_content_candidates c JOIN growth_content_briefs b ON b.id=c.brief_id AND b.workspace_id=c.workspace_id
 JOIN experiments e ON e.id=b.experiment_id AND e.workspace_id=b.workspace_id
 WHERE c.id=NEW.subject_id AND c.workspace_id=NEW.workspace_id AND c.state='APPROVED'
 AND b.goal_context_version_id=NEW.context_version_id AND b.goal_ref=NEW.goal_reference
 AND e.goal_context_version_id=b.goal_context_version_id AND e.goal_ref=b.goal_ref
 ) THEN RAISE(ABORT,'growth approved treatment mismatch') END;
END;`);
      if (db.pragma('foreign_key_check').length) throw new Error('Growth evidence migration foreign key failure');
      // DROP records deferred violations against the old b-tree even after the
      // identical parent IDs are restored. Validate the complete final graph
      // first, then clear that obsolete deferred counter before commit.
      db.pragma('defer_foreign_keys = OFF');
      if (wasDeferred) db.pragma('defer_foreign_keys = ON');
    }).immediate();
  },
};
