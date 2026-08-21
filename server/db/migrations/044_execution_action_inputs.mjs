export const migration044ExecutionActionInputs={version:44,name:"execution_action_inputs",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS execution_action_inputs(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
 action_type TEXT NOT NULL CHECK(length(action_type) BETWEEN 1 AND 100), action_version INTEGER NOT NULL CHECK(action_version>0),
 input_schema_id TEXT NOT NULL CHECK(length(input_schema_id) BETWEEN 1 AND 100), input_schema_version INTEGER NOT NULL CHECK(input_schema_version>0), canonicalization_version INTEGER NOT NULL CHECK(canonicalization_version>0),
 content_hash TEXT NOT NULL CHECK(length(content_hash)=64 AND content_hash NOT GLOB '*[^0-9a-f]*'), serialized_size INTEGER NOT NULL CHECK(serialized_size>=0 AND serialized_size<=65536),
 sensitivity_class TEXT NOT NULL CHECK(sensitivity_class IN('PUBLIC','INTERNAL','CONFIDENTIAL','SENSITIVE_PII')),
 storage_kind TEXT NOT NULL CHECK(storage_kind IN('TEST_MEMORY','EXTERNAL_ENCRYPTED')), artifact_reference TEXT NOT NULL CHECK(length(artifact_reference) BETWEEN 1 AND 500),
 created_by_kind TEXT NOT NULL CHECK(created_by_kind IN('HUMAN','DETERMINISTIC_PRODUCER','BACKEND_TRANSFORMER','AI_CANDIDATE')),
 created_by_user_id TEXT, created_by_membership_id TEXT,
 producer TEXT NOT NULL CHECK(length(producer) BETWEEN 1 AND 100), producer_version TEXT NOT NULL CHECK(length(producer_version) BETWEEN 1 AND 100), operation_kind TEXT NOT NULL CHECK(length(operation_kind) BETWEEN 1 AND 100),
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200), request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'), created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id), FOREIGN KEY(created_by_user_id) REFERENCES users(id), FOREIGN KEY(created_by_membership_id) REFERENCES workspace_memberships(id),
 CHECK((created_by_kind='HUMAN' AND created_by_user_id IS NOT NULL AND created_by_membership_id IS NOT NULL) OR(created_by_kind!='HUMAN' AND created_by_user_id IS NULL AND created_by_membership_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_action_inputs_idempotency ON execution_action_inputs(workspace_id,created_by_kind,COALESCE(created_by_user_id,''),producer,producer_version,operation_kind,idempotency_key);
CREATE TRIGGER IF NOT EXISTS trg_execution_action_inputs_insert_guard BEFORE INSERT ON execution_action_inputs BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id) THEN RAISE(ABORT,'action input workspace mismatch') END;
 SELECT CASE WHEN NEW.created_by_kind='HUMAN' AND NOT EXISTS(SELECT 1 FROM workspace_memberships m JOIN users u ON u.id=m.user_id WHERE m.id=NEW.created_by_membership_id AND m.workspace_id=NEW.workspace_id AND m.user_id=NEW.created_by_user_id AND m.status='active' AND u.status='active' AND m.role IN('owner','admin','member')) THEN RAISE(ABORT,'action input membership mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_execution_action_inputs_update BEFORE UPDATE ON execution_action_inputs BEGIN SELECT RAISE(ABORT,'action inputs are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_execution_action_inputs_delete BEFORE DELETE ON execution_action_inputs BEGIN SELECT RAISE(ABORT,'action inputs are immutable'); END;
`);}};
