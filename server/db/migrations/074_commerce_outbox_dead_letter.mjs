export const migration074CommerceOutboxDeadLetter={version:74,name:"commerce_outbox_dead_letter",up(db){db.exec(`
ALTER TABLE business_builder_commerce_outbox ADD COLUMN dead_lettered_at TEXT;
ALTER TABLE business_builder_commerce_outbox ADD COLUMN dead_letter_reason TEXT;
ALTER TABLE business_builder_commerce_outbox ADD COLUMN requeue_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_bb_commerce_outbox_dead_letter ON business_builder_commerce_outbox(workspace_id,dead_lettered_at,created_at);
`);}};
