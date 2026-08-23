export const migration065SecureFormsCrmFoundation = { version: 65, name: "secure_forms_crm_foundation", up(db) { db.exec(`
CREATE TABLE IF NOT EXISTS form_definitions(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), created_by_user_id TEXT NOT NULL REFERENCES users(id), public_reference TEXT NOT NULL,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120), purpose TEXT NOT NULL CHECK(purpose IN('LEAD','CONTACT','QUOTE_REQUEST','APPOINTMENT_REQUEST','CALLBACK_REQUEST','NEWSLETTER')),
 status TEXT NOT NULL CHECK(status IN('DRAFT','ACTIVE','INACTIVE')), schema_version INTEGER NOT NULL CHECK(schema_version=1), definition_json TEXT NOT NULL CHECK(json_valid(definition_json) AND length(definition_json)<=32768),
 success_behavior TEXT NOT NULL CHECK(success_behavior IN('SUCCESS_MESSAGE','SAFE_REDIRECT')), success_value TEXT NOT NULL CHECK(length(success_value) BETWEEN 1 AND 500), revision INTEGER NOT NULL CHECK(revision>0), idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL CHECK(length(request_hash)=64), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_form_public_reference ON form_definitions(public_reference);
CREATE UNIQUE INDEX IF NOT EXISTS uq_form_create ON form_definitions(workspace_id,created_by_user_id,idempotency_key);
CREATE INDEX IF NOT EXISTS idx_forms_workspace ON form_definitions(workspace_id,updated_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_forms_identity_guard BEFORE UPDATE ON form_definitions WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.public_reference IS NOT OLD.public_reference OR NEW.created_at IS NOT OLD.created_at BEGIN SELECT RAISE(ABORT,'form identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_forms_delete_reject BEFORE DELETE ON form_definitions BEGIN SELECT RAISE(ABORT,'forms cannot be deleted'); END;

CREATE TABLE IF NOT EXISTS form_submissions(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), form_definition_id TEXT NOT NULL REFERENCES form_definitions(id), form_revision INTEGER NOT NULL CHECK(form_revision>0), public_reference TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(payload_json)<=32768), payload_fingerprint TEXT NOT NULL CHECK(length(payload_fingerprint)=64), privacy_schema_version INTEGER NOT NULL CHECK(privacy_schema_version=1),
 attribution_touch_id TEXT REFERENCES attribution_touches(id), anonymous_correlation_reference TEXT, operational_status TEXT NOT NULL CHECK(operational_status IN('ACCEPTED','SUSPECTED_SPAM')),
 idempotency_key_hash TEXT NOT NULL CHECK(length(idempotency_key_hash)=64), request_hash TEXT NOT NULL CHECK(length(request_hash)=64), submitted_at TEXT NOT NULL, ingested_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_form_submission_retry ON form_submissions(form_definition_id,idempotency_key_hash);
CREATE INDEX IF NOT EXISTS idx_form_submissions_workspace ON form_submissions(workspace_id,submitted_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_form_submission_guard BEFORE INSERT ON form_submissions BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM form_definitions f WHERE f.id=NEW.form_definition_id AND f.workspace_id=NEW.workspace_id AND f.status='ACTIVE') THEN RAISE(ABORT,'form submission scope invalid') END; SELECT CASE WHEN NEW.attribution_touch_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM attribution_touches t WHERE t.id=NEW.attribution_touch_id AND t.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'touch scope invalid') END; END;
CREATE TRIGGER IF NOT EXISTS trg_form_submissions_update_reject BEFORE UPDATE ON form_submissions BEGIN SELECT RAISE(ABORT,'submissions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_form_submissions_delete_reject BEFORE DELETE ON form_submissions BEGIN SELECT RAISE(ABORT,'submissions are immutable'); END;

CREATE TABLE IF NOT EXISTS crm_leads(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), public_reference TEXT NOT NULL, display_name TEXT, primary_phone TEXT, primary_email TEXT,
 status TEXT NOT NULL CHECK(status IN('OPEN','QUALIFIED','UNQUALIFIED','WON','LOST','ARCHIVED')), stage TEXT NOT NULL CHECK(stage IN('NEW','CONTACTED','FOLLOW_UP','PROPOSAL','NEGOTIATION','CLOSED')),
 identity_status TEXT NOT NULL CHECK(identity_status IN('RESOLVED','CONFLICT')), revision INTEGER NOT NULL CHECK(revision>0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_lead_public ON crm_leads(public_reference);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_lead_phone ON crm_leads(workspace_id,primary_phone) WHERE primary_phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_lead_email ON crm_leads(workspace_id,primary_email) WHERE primary_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_history ON crm_leads(workspace_id,created_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_crm_lead_identity_guard BEFORE UPDATE ON crm_leads WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.public_reference IS NOT OLD.public_reference OR NEW.created_at IS NOT OLD.created_at BEGIN SELECT RAISE(ABORT,'lead identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_crm_leads_delete_reject BEFORE DELETE ON crm_leads BEGIN SELECT RAISE(ABORT,'leads cannot be deleted'); END;

CREATE TABLE IF NOT EXISTS crm_lead_identity_evidence(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), lead_id TEXT NOT NULL REFERENCES crm_leads(id), evidence_type TEXT NOT NULL CHECK(evidence_type IN('FORM_SUBMISSION','VERIFIED_PHONE','VERIFIED_EMAIL','AUTHENTICATED_CUSTOMER','CRM_IMPORT','INSTAGRAM_CONVERSATION','SMS_RESPONSE')), source_reference TEXT NOT NULL, observed_at TEXT NOT NULL, method TEXT NOT NULL CHECK(method IN('EXACT_PHONE','EXACT_EMAIL','NEW_IDENTITY','MANUAL','EXTERNAL_VERIFIED')), created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_evidence_source ON crm_lead_identity_evidence(workspace_id,evidence_type,source_reference,lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_evidence_lead ON crm_lead_identity_evidence(workspace_id,lead_id,created_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_crm_evidence_guard BEFORE INSERT ON crm_lead_identity_evidence BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM crm_leads l WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'lead scope invalid') END; END;
CREATE TRIGGER IF NOT EXISTS trg_crm_evidence_update_reject BEFORE UPDATE ON crm_lead_identity_evidence BEGIN SELECT RAISE(ABORT,'lead evidence immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_crm_evidence_delete_reject BEFORE DELETE ON crm_lead_identity_evidence BEGIN SELECT RAISE(ABORT,'lead evidence immutable'); END;

CREATE TABLE IF NOT EXISTS crm_activities(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), lead_id TEXT NOT NULL REFERENCES crm_leads(id), created_by_user_id TEXT REFERENCES users(id), activity_type TEXT NOT NULL CHECK(activity_type IN('LEAD_CREATED','FORM_SUBMITTED','NOTE_ADDED','STATUS_CHANGED','STAGE_CHANGED','CONTACT_ATTEMPT','FOLLOW_UP_SET')), detail_json TEXT NOT NULL CHECK(json_valid(detail_json) AND length(detail_json)<=8192), source_submission_id TEXT REFERENCES form_submissions(id), idempotency_key TEXT, request_hash TEXT CHECK(request_hash IS NULL OR length(request_hash)=64), created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_activity_retry ON crm_activities(workspace_id,created_by_user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activity_lead ON crm_activities(workspace_id,lead_id,created_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_crm_activity_guard BEFORE INSERT ON crm_activities BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM crm_leads l WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'activity lead scope invalid') END; SELECT CASE WHEN NEW.source_submission_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM form_submissions s WHERE s.id=NEW.source_submission_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'activity submission scope invalid') END; END;
CREATE TRIGGER IF NOT EXISTS trg_crm_activities_update_reject BEFORE UPDATE ON crm_activities BEGIN SELECT RAISE(ABORT,'activities are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_crm_activities_delete_reject BEFORE DELETE ON crm_activities BEGIN SELECT RAISE(ABORT,'activities are immutable'); END;
`); } };
