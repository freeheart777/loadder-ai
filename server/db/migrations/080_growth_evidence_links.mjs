export const migration080GrowthEvidenceLinks = {
  version: 80,
  name: "growth_evidence_links",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS growth_evidence_links(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  contract_version INTEGER NOT NULL CHECK(contract_version=1),
  context_version_id TEXT NOT NULL REFERENCES business_context_versions(id),
  goal_reference TEXT NOT NULL,
  goal_version TEXT NOT NULL CHECK(goal_version=context_version_id),
  subject_type TEXT NOT NULL CHECK(subject_type IN('CAMPAIGN','EXPERIMENT')),
  subject_id TEXT NOT NULL,
  relation TEXT NOT NULL CHECK(relation='HAS_EVIDENCE'),
  object_type TEXT CHECK(object_type IN('EVENT','ORDER','FINANCIAL_ENTRY')),
  object_id TEXT,
  evidence_kind TEXT NOT NULL CHECK(evidence_kind IN('REPORTED_CONVERSION','CRM_CONVERSION','ORDER','PAYMENT','VERIFIED_REVENUE','ATTRIBUTED_REVENUE','CAUSAL_LIFT')),
  authority_class TEXT NOT NULL CHECK(authority_class IN('UNKNOWN','REPORTED','CANONICAL_RECORD')),
  producer TEXT NOT NULL CHECK(length(producer) BETWEEN 1 AND 100),
  source TEXT NOT NULL CHECK(length(source) BETWEEN 1 AND 200),
  source_event_id TEXT REFERENCES business_events(id),
  correlation_id TEXT,
  causation_id TEXT,
  idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
  payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64),
  supersedes_id TEXT REFERENCES growth_evidence_links(id),
  recorded_at TEXT NOT NULL,
  CHECK((object_type IS NULL AND object_id IS NULL AND authority_class='UNKNOWN') OR (object_type IS NOT NULL AND object_id IS NOT NULL)),
  UNIQUE(workspace_id,producer,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_growth_evidence_subject ON growth_evidence_links(workspace_id,subject_type,subject_id,recorded_at,id);
CREATE INDEX IF NOT EXISTS idx_growth_evidence_object ON growth_evidence_links(workspace_id,object_type,object_id);
CREATE INDEX IF NOT EXISTS idx_growth_evidence_goal ON growth_evidence_links(workspace_id,context_version_id,goal_reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_evidence_successor ON growth_evidence_links(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS trg_growth_evidence_insert BEFORE INSERT ON growth_evidence_links BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_context_versions WHERE id=NEW.context_version_id AND workspace_id=NEW.workspace_id AND status IN('active','archived')) THEN RAISE(ABORT,'growth context mismatch') END;
 SELECT CASE WHEN NEW.subject_type='CAMPAIGN' AND NOT EXISTS(SELECT 1 FROM marketing_campaigns WHERE id=NEW.subject_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'growth subject mismatch') END;
 SELECT CASE WHEN NEW.subject_type='EXPERIMENT' AND NOT EXISTS(SELECT 1 FROM experiments WHERE id=NEW.subject_id AND workspace_id=NEW.workspace_id AND context_version_id=NEW.context_version_id) THEN RAISE(ABORT,'growth subject mismatch') END;
 SELECT CASE WHEN NEW.object_type='EVENT' AND NOT EXISTS(SELECT 1 FROM business_events WHERE id=NEW.object_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'growth object mismatch') END;
 SELECT CASE WHEN NEW.object_type='ORDER' AND NOT EXISTS(SELECT 1 FROM ecommerce_orders WHERE id=NEW.object_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'growth object mismatch') END;
 SELECT CASE WHEN NEW.object_type='FINANCIAL_ENTRY' AND NOT EXISTS(SELECT 1 FROM ecommerce_financial_ledger WHERE id=NEW.object_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'growth object mismatch') END;
 SELECT CASE WHEN NEW.source_event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM business_events WHERE id=NEW.source_event_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'growth event mismatch') END;
 SELECT CASE WHEN NEW.object_id IS NOT NULL AND NEW.evidence_kind IN('PAYMENT','VERIFIED_REVENUE') AND (NEW.object_type<>'FINANCIAL_ENTRY' OR NEW.authority_class<>'CANONICAL_RECORD' OR NOT EXISTS(SELECT 1 FROM ecommerce_financial_ledger l JOIN ecommerce_orders o ON o.id=l.order_id AND o.workspace_id=l.workspace_id WHERE l.id=NEW.object_id AND l.workspace_id=NEW.workspace_id AND l.entry_type='PAYMENT_CAPTURED' AND l.source_type='ORDER_PAYMENT' AND l.source_id=o.id AND l.site_project_id=o.site_project_id AND l.amount_minor=o.total_minor AND l.currency=o.currency AND length(trim(o.payment_reference))>0 AND o.payment_status IN('PAID','REFUNDED'))) THEN RAISE(ABORT,'growth financial evidence required') END;
 SELECT CASE WHEN NEW.object_id IS NOT NULL AND NEW.evidence_kind='ORDER' AND (NEW.object_type<>'ORDER' OR NEW.authority_class<>'CANONICAL_RECORD') THEN RAISE(ABORT,'growth order evidence required') END;
 SELECT CASE WHEN NEW.object_id IS NOT NULL AND NEW.evidence_kind NOT IN('PAYMENT','VERIFIED_REVENUE','ORDER') AND (NEW.object_type<>'EVENT' OR NEW.authority_class<>'REPORTED') THEN RAISE(ABORT,'growth reported evidence required') END;
 SELECT CASE WHEN NEW.supersedes_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM growth_evidence_links WHERE id=NEW.supersedes_id AND workspace_id=NEW.workspace_id AND context_version_id=NEW.context_version_id AND goal_reference=NEW.goal_reference AND subject_type=NEW.subject_type AND subject_id=NEW.subject_id AND relation=NEW.relation AND evidence_kind=NEW.evidence_kind AND recorded_at<=NEW.recorded_at) THEN RAISE(ABORT,'growth predecessor mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_growth_evidence_update BEFORE UPDATE ON growth_evidence_links BEGIN SELECT RAISE(ABORT,'Growth evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_growth_evidence_delete BEFORE DELETE ON growth_evidence_links BEGIN SELECT RAISE(ABORT,'Growth evidence is append-only'); END;
`);
  },
};
