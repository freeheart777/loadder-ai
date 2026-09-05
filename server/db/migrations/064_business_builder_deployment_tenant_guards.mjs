export const migration064BusinessBuilderDeploymentTenantGuards={version:64,name:"business_builder_deployment_tenant_guards",up(db){db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_bb_deployment_insert_tenant_guard
BEFORE INSERT ON business_builder_deployments
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM business_builder_projects p
    WHERE p.id=NEW.project_id AND p.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'deployment project workspace mismatch') END;
  SELECT CASE WHEN NEW.version_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM business_builder_versions v
    WHERE v.id=NEW.version_id AND v.project_id=NEW.project_id AND v.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'deployment version project workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_bb_deployment_update_tenant_guard
BEFORE UPDATE OF workspace_id,project_id,version_id ON business_builder_deployments
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM business_builder_projects p
    WHERE p.id=NEW.project_id AND p.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'deployment project workspace mismatch') END;
  SELECT CASE WHEN NEW.version_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM business_builder_versions v
    WHERE v.id=NEW.version_id AND v.project_id=NEW.project_id AND v.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'deployment version project workspace mismatch') END;
END;
`);}};
