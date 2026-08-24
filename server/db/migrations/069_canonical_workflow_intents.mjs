export const migration069CanonicalWorkflowIntents={version:69,name:"canonical_workflow_intents",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS workflow_intents(
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 actor_user_id TEXT NOT NULL REFERENCES users(id),
 workflow_type TEXT NOT NULL CHECK(workflow_type='GROWTH_STRATEGY'),
 workflow_version INTEGER NOT NULL CHECK(workflow_version=1),
 operation_version INTEGER NOT NULL CHECK(operation_version=1),
 request_identity_hash TEXT NOT NULL CHECK(length(request_identity_hash)=64),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 started_at TEXT NOT NULL,
 completed_entity_id TEXT REFERENCES growth_strategies(id),
 terminal_posture TEXT NOT NULL CHECK(terminal_posture IN('STARTED','COMPLETED','FAILED')),
 error_code TEXT CHECK(error_code IS NULL OR (length(error_code) BETWEEN 1 AND 80 AND error_code NOT GLOB '*[^A-Z0-9_]*')),
 created_at TEXT NOT NULL,
 UNIQUE(workspace_id,actor_user_id,workflow_type,request_identity_hash),
 CHECK((terminal_posture='STARTED' AND completed_entity_id IS NULL AND error_code IS NULL) OR (terminal_posture='COMPLETED' AND completed_entity_id IS NOT NULL AND error_code IS NULL) OR (terminal_posture='FAILED' AND completed_entity_id IS NULL AND error_code IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_workflow_intents_workspace_history ON workflow_intents(workspace_id,workflow_type,started_at DESC,id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_intents_completed_entity ON workflow_intents(workspace_id,completed_entity_id) WHERE completed_entity_id IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS trg_workflow_intent_insert_guard BEFORE INSERT ON workflow_intents WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=NEW.actor_user_id AND m.status='active') BEGIN SELECT RAISE(ABORT,'workflow intent actor scope invalid'); END;
CREATE TRIGGER IF NOT EXISTS trg_workflow_intent_update_guard BEFORE UPDATE ON workflow_intents WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.actor_user_id IS NOT OLD.actor_user_id OR NEW.workflow_type IS NOT OLD.workflow_type OR NEW.workflow_version IS NOT OLD.workflow_version OR NEW.operation_version IS NOT OLD.operation_version OR NEW.request_identity_hash IS NOT OLD.request_identity_hash OR NEW.request_hash IS NOT OLD.request_hash OR NEW.started_at IS NOT OLD.started_at OR NEW.created_at IS NOT OLD.created_at OR OLD.terminal_posture!='STARTED' OR NEW.terminal_posture NOT IN('COMPLETED','FAILED') OR (NEW.terminal_posture='COMPLETED' AND NOT EXISTS(SELECT 1 FROM growth_strategies s WHERE s.id=NEW.completed_entity_id AND s.workspace_id=OLD.workspace_id AND s.created_by_user_id=OLD.actor_user_id)) BEGIN SELECT RAISE(ABORT,'workflow intent immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_workflow_intent_delete_guard BEFORE DELETE ON workflow_intents BEGIN SELECT RAISE(ABORT,'workflow intents immutable'); END;
`);}};
