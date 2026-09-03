import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBusinessBuilderRepository } from "../app/repositories/business-builder-repository.mjs";
import { createBusinessBuilderProjectService } from "../app/business-builder/project-service.mjs";
import { createContractPreviewAdapter } from "../app/business-builder/contract-preview-adapter.mjs";
import { loadderBusinessBuilderService } from "../app/business-builder/business-builder-service.mjs";

function setup(){const db=new Database(":memory:");db.pragma("foreign_keys = ON");migration001Identity.up(db);migration050BusinessBuilderProjects.up(db);const at=new Date().toISOString();db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES ('w1','Commercial','commercial','active',?,?)").run(at,at);return db;}

test("commercial acceptance: build -> edit -> preview -> restore works without AI provider",async()=>{const db=setup();await runWithWorkspace("w1",async()=>{const repository=createBusinessBuilderRepository(db),previewAdapter=createContractPreviewAdapter(),projects=createBusinessBuilderProjectService({repository,builder:loadderBusinessBuilderService,previewAdapter});const created=projects.createProject({intent:"برای شرکت لجستیک CRM فروش و مدیریت محموله بساز",name:"Loadder Ops",locale:"fa-IR"},"u1");assert.ok(created.version.definition.entities.length>=4);assert.equal(created.version.buildPlan.productionDeploymentAllowed,false);const edited=projects.applyEditorPatch(created.project.id,{theme:{density:"compact"}},"u1");assert.equal(edited.version.versionNumber,2);assert.equal(edited.version.ui.theme.density,"compact");const preview=await projects.startPreview(created.project.id);assert.equal(preview.version.id,edited.version.id);assert.match(previewAdapter.render({version:preview.version}),/Loadder Contract Preview/);const restored=projects.restoreVersion(created.project.id,created.version.id,"u1");assert.equal(restored.version.versionNumber,3);assert.notEqual(restored.version.id,created.version.id);assert.equal(projects.canDeployProduction(created.project.id),false);});db.close();});
