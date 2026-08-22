export const migration053CreativeIntents = {
  version: 53,
  name: "creative_intents",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS creative_intents (
        id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        created_by_user_id TEXT NOT NULL REFERENCES users(id),
        intent_type TEXT NOT NULL CHECK(intent_type IN ('AWARENESS','TRUST_BUILDING','LEAD_GENERATION','SALES','EDUCATION','ENGAGEMENT')),
        title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
        description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 2000),
        goal TEXT NOT NULL CHECK(length(goal) BETWEEN 1 AND 500),
        audience_summary TEXT CHECK(audience_summary IS NULL OR length(audience_summary) BETWEEN 1 AND 1000),
        successor_intent_id TEXT REFERENCES creative_intents(id),
        operation_kind TEXT NOT NULL CHECK(operation_kind='creative_intent.create'),
        idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
        request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
        created_at TEXT NOT NULL CHECK(length(created_at) BETWEEN 20 AND 40),
        updated_at TEXT NOT NULL CHECK(length(updated_at) BETWEEN 20 AND 40),
        CHECK(successor_intent_id IS NULL OR successor_intent_id<>id),
        CHECK(updated_at>=created_at)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_creative_intents_idempotency
        ON creative_intents(workspace_id,created_by_user_id,operation_kind,idempotency_key);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_creative_intents_successor
        ON creative_intents(successor_intent_id) WHERE successor_intent_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_creative_intents_workspace_history
        ON creative_intents(workspace_id,created_at DESC,id DESC);

      CREATE TRIGGER IF NOT EXISTS trg_creative_intents_insert_guard BEFORE INSERT ON creative_intents BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id AND status='active') THEN RAISE(ABORT,'creative intent workspace must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'creative intent user must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'creative intent membership must be active') END;
        SELECT CASE WHEN NEW.successor_intent_id IS NOT NULL THEN RAISE(ABORT,'creative intent successor is assigned after creation') END;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_creative_intents_meaning_immutable BEFORE UPDATE ON creative_intents WHEN
        NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR
        NEW.intent_type IS NOT OLD.intent_type OR NEW.title IS NOT OLD.title OR NEW.description IS NOT OLD.description OR
        NEW.goal IS NOT OLD.goal OR NEW.audience_summary IS NOT OLD.audience_summary OR NEW.operation_kind IS NOT OLD.operation_kind OR
        NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.created_at IS NOT OLD.created_at
      BEGIN SELECT RAISE(ABORT,'creative intent meaning is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_creative_intents_successor_guard BEFORE UPDATE OF successor_intent_id ON creative_intents WHEN
        OLD.successor_intent_id IS NOT NULL OR NEW.successor_intent_id IS NULL OR NEW.successor_intent_id=OLD.id OR
        NOT EXISTS(SELECT 1 FROM creative_intents successor WHERE successor.id=NEW.successor_intent_id AND successor.workspace_id=OLD.workspace_id)
      BEGIN SELECT RAISE(ABORT,'creative intent successor is invalid'); END;
      CREATE TRIGGER IF NOT EXISTS trg_creative_intents_delete_reject BEFORE DELETE ON creative_intents
      BEGIN SELECT RAISE(ABORT,'creative intents are immutable'); END;

      ALTER TABLE content_generations ADD COLUMN intent_id TEXT REFERENCES creative_intents(id);
      ALTER TABLE content_items ADD COLUMN intent_id TEXT REFERENCES creative_intents(id);

      CREATE TRIGGER IF NOT EXISTS trg_content_generations_intent_guard BEFORE INSERT ON content_generations WHEN
        NEW.intent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM creative_intents i WHERE i.id=NEW.intent_id AND i.workspace_id=NEW.workspace_id)
      BEGIN SELECT RAISE(ABORT,'content generation intent mismatch'); END;
      CREATE TRIGGER IF NOT EXISTS trg_content_items_intent_guard BEFORE INSERT ON content_items WHEN
        (NEW.intent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM creative_intents i WHERE i.id=NEW.intent_id AND i.workspace_id=NEW.workspace_id)) OR
        (NEW.source_type='AI_GENERATED' AND NEW.intent_id IS NOT (SELECT g.intent_id FROM content_generations g WHERE g.id=NEW.source_generation_id))
      BEGIN SELECT RAISE(ABORT,'content item intent mismatch'); END;
      CREATE TRIGGER IF NOT EXISTS trg_content_items_intent_immutable BEFORE UPDATE OF intent_id ON content_items WHEN NEW.intent_id IS NOT OLD.intent_id
      BEGIN SELECT RAISE(ABORT,'content item intent is immutable'); END;
    `);
  },
};
