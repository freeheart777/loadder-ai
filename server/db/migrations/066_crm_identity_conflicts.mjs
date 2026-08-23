export const migration066CrmIdentityConflicts={version:66,name:"crm_identity_conflicts",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS crm_identity_conflicts(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),public_reference TEXT NOT NULL,conflict_type TEXT NOT NULL CHECK(conflict_type='PHONE_EMAIL_LEAD_MISMATCH'),
 phone_lead_id TEXT NOT NULL REFERENCES crm_leads(id),email_lead_id TEXT NOT NULL REFERENCES crm_leads(id),source_submission_id TEXT NOT NULL REFERENCES form_submissions(id),
 status TEXT NOT NULL CHECK(status IN('OPEN','RESOLVED','DISMISSED')),created_at TEXT NOT NULL,resolved_at TEXT,resolved_by_user_id TEXT REFERENCES users(id),resolution_note TEXT CHECK(resolution_note IS NULL OR length(resolution_note)<=1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_conflict_submission ON crm_identity_conflicts(workspace_id,source_submission_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_conflict_public ON crm_identity_conflicts(public_reference);
CREATE INDEX IF NOT EXISTS idx_crm_conflicts_workspace ON crm_identity_conflicts(workspace_id,status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_crm_conflicts_phone_lead ON crm_identity_conflicts(workspace_id,phone_lead_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_conflicts_email_lead ON crm_identity_conflicts(workspace_id,email_lead_id,status,created_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_crm_conflict_insert_guard BEFORE INSERT ON crm_identity_conflicts BEGIN
 SELECT CASE WHEN NEW.phone_lead_id=NEW.email_lead_id THEN RAISE(ABORT,'conflict candidates must differ') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM crm_leads p,crm_leads e,form_submissions s WHERE p.id=NEW.phone_lead_id AND e.id=NEW.email_lead_id AND s.id=NEW.source_submission_id AND p.workspace_id=NEW.workspace_id AND e.workspace_id=NEW.workspace_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'conflict scope invalid') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_crm_conflict_identity_guard BEFORE UPDATE ON crm_identity_conflicts WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.public_reference IS NOT OLD.public_reference OR NEW.conflict_type IS NOT OLD.conflict_type OR NEW.phone_lead_id IS NOT OLD.phone_lead_id OR NEW.email_lead_id IS NOT OLD.email_lead_id OR NEW.source_submission_id IS NOT OLD.source_submission_id OR NEW.created_at IS NOT OLD.created_at OR OLD.status!='OPEN' BEGIN SELECT RAISE(ABORT,'conflict identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_crm_conflict_delete_reject BEFORE DELETE ON crm_identity_conflicts BEGIN SELECT RAISE(ABORT,'conflicts cannot be deleted'); END;
`);}};
