export const migration012BusinessContextLifecycleGuards = {
  version: 12,
  name: "business_context_lifecycle_guards",
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_business_context_status_forward_only
      BEFORE UPDATE OF status ON business_context_versions
      WHEN (OLD.status = 'archived' AND NEW.status <> 'archived')
        OR (OLD.status = 'active' AND NEW.status NOT IN ('active', 'archived'))
      BEGIN
        SELECT RAISE(ABORT, 'Business Context lifecycle cannot move backward');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_business_context_preserve_history
      BEFORE DELETE ON business_context_versions
      WHEN OLD.status IN ('active', 'archived')
      BEGIN
        SELECT RAISE(ABORT, 'active and archived Business Context versions cannot be deleted');
      END;
    `);
  },
};
