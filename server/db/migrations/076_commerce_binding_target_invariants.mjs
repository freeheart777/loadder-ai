export const migration076CommerceBindingTargetInvariants={version:76,name:"commerce_binding_target_invariants",up(db){db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_target_keep_active_version
BEFORE UPDATE OF active_version_id ON business_builder_projects
WHEN NEW.active_version_id IS NULL
  AND OLD.active_version_id IS NOT NULL
  AND EXISTS(
    SELECT 1
    FROM business_builder_commerce_bindings b
    JOIN site_projects s ON s.id=b.site_project_id AND s.workspace_id=b.workspace_id
    WHERE b.workspace_id=OLD.workspace_id
      AND b.business_builder_project_id=OLD.id
      AND b.status='active'
      AND s.site_type='STORE'
      AND s.status='PUBLISHED'
  )
BEGIN
  SELECT RAISE(ABORT,'commerce target active version required while published storefront bound');
END;

CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_target_no_archive
BEFORE UPDATE OF status ON business_builder_projects
WHEN NEW.status='archived'
  AND OLD.status<>'archived'
  AND EXISTS(
    SELECT 1
    FROM business_builder_commerce_bindings b
    JOIN site_projects s ON s.id=b.site_project_id AND s.workspace_id=b.workspace_id
    WHERE b.workspace_id=OLD.workspace_id
      AND b.business_builder_project_id=OLD.id
      AND b.status='active'
      AND s.site_type='STORE'
      AND s.status='PUBLISHED'
  )
BEGIN
  SELECT RAISE(ABORT,'commerce target cannot be archived while published storefront bound');
END;

CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_target_no_delete
BEFORE DELETE ON business_builder_projects
WHEN EXISTS(SELECT 1 FROM workspaces w WHERE w.id=OLD.workspace_id)
  AND EXISTS(
    SELECT 1
    FROM business_builder_commerce_bindings b
    JOIN site_projects s ON s.id=b.site_project_id AND s.workspace_id=b.workspace_id
    WHERE b.workspace_id=OLD.workspace_id
      AND b.business_builder_project_id=OLD.id
      AND b.status='active'
      AND s.site_type='STORE'
      AND s.status='PUBLISHED'
  )
BEGIN
  SELECT RAISE(ABORT,'commerce target cannot be deleted while published storefront bound');
END;
`);}};
