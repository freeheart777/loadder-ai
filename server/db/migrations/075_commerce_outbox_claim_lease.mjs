export const migration075CommerceOutboxClaimLease={version:75,name:"commerce_outbox_claim_lease",up(db){db.exec(`
ALTER TABLE business_builder_commerce_outbox ADD COLUMN claim_token TEXT;
ALTER TABLE business_builder_commerce_outbox ADD COLUMN claimed_at TEXT;
ALTER TABLE business_builder_commerce_outbox ADD COLUMN claim_expires_at TEXT;
CREATE INDEX IF NOT EXISTS idx_bb_commerce_outbox_claimable ON business_builder_commerce_outbox(workspace_id,status,dead_lettered_at,available_at,claim_expires_at,created_at);
`);}};
