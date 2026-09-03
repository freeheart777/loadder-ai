import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBusinessBuilderRepository } from "../app/repositories/business-builder-repository.mjs";
import { createBusinessBuilderProjectService } from "../app/business-builder/project-service.mjs";
import { createContractPreviewAdapter } from "../app/business-builder/contract-preview-adapter.mjs";

function setup(){
  const db=new Database(":memory:"); db.pragma("foreign_keys = ON"); migration001Identity.up(db); migration050BusinessBuilderProjects.up(db);
  const at=new Date().toISOString(); db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES ('w1','Test','test','active',?,?)").run(at,at);
  return db;
}

test("business builder persists immutable versions, restores and gates production", async()=>{
  const db=setup();
  await runWithWorkspace("w1", async()=>{
    const repository=createBusinessBuilderRepository(db);
    const previewAdapter=createContractPreviewAdapter();
    const projects=createBusinessBuilderProjectService({repository,previewAdapter});
    const created=projects.createProject({intent:"برای شرکت پخش CRM فروش و انبار بساز",name:"Ops"},"u1");
    assert.equal(created.version.versionNumber,1);
    assert.equal(created.version.bundle.contract,"loadder.source-bundle.v1");
    assert.equal(created.version.bundle.portable,true);
    const saved=projects.saveProject(created.project.id,{intent:"برای شرکت پخش CRM فروش، انبار و رزرو بساز"},"u1");
    assert.equal(saved.version.versionNumber,2);
    assert.equal(saved.version.bundle.contract,"loadder.source-bundle.v1");
    const restored=projects.restoreVersion(created.project.id,created.version.id,"u1");
    assert.equal(restored.version.versionNumber,3);
    assert.equal(repository.listVersions(created.project.id).length,3);
    assert.equal(projects.canDeployProduction(created.project.id),false);
    projects.decide({projectId:created.project.id,versionId:restored.version.id,stage:"production",decision:"approved",actorId:"u1"});
    assert.equal(projects.canDeployProduction(created.project.id),true);
    const preview=await projects.startPreview(created.project.id);
    assert.equal(preview.session.runtimeAdapter,"loadder-contract-html-v1");
    const html=previewAdapter.render({version:preview.version});
    assert.match(html,/Loadder Contract Preview/);
    assert.match(html,/Content|Ops|workspace/i);
  });
  db.close();
});
