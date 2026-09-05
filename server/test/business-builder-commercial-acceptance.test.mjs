import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration055BusinessBuilderIntegrations } from "../db/migrations/055_business_builder_integrations.mjs";
import { migration065BusinessBuilderPreviewQualityEvidence } from "../db/migrations/065_business_builder_preview_quality_evidence.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBusinessBuilderRepository } from "../app/repositories/business-builder-repository.mjs";
import { createBusinessBuilderProjectService } from "../app/business-builder/project-service.mjs";
import { createContractPreviewAdapter } from "../app/business-builder/contract-preview-adapter.mjs";
import { loadderBusinessBuilderService } from "../app/business-builder/business-builder-service.mjs";
import { LoadderIntegrationStore } from "../app/business-builder/integration-store.mjs";
import { createLocalObjectStorage } from "../app/business-builder/local-object-storage.mjs";
import { createMemoryPaymentIdempotencyStore,createPaymentRuntime } from "../app/business-builder/payment-runtime.mjs";

function setup(){const db=new Database(":memory:");db.pragma("foreign_keys = ON");migration001Identity.up(db);migration050BusinessBuilderProjects.up(db);migration055BusinessBuilderIntegrations.up(db);migration065BusinessBuilderPreviewQualityEvidence.up(db);const at=new Date().toISOString();db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES ('w1','Commercial','commercial','active',?,?),('w2','Isolation','isolation','active',?,?)").run(at,at,at,at);return db;}

test("commercial acceptance: build edit preview restore integration storage and payment work without AI dependency",async()=>{const db=setup(),dir=await fs.mkdtemp(path.join(os.tmpdir(),"loadder-commercial-"));try{let projectId;await runWithWorkspace("w1",async()=>{const repository=createBusinessBuilderRepository(db),previewAdapter=createContractPreviewAdapter(),projects=createBusinessBuilderProjectService({repository,builder:loadderBusinessBuilderService,previewAdapter});const created=projects.createProject({intent:"برای شرکت لجستیک CRM فروش و مدیریت محموله بساز",name:"Loadder Ops",locale:"fa-IR"},"u1");projectId=created.project.id;assert.ok(created.version.definition.entities.length>=4);assert.equal(created.version.buildPlan.productionDeploymentAllowed,false);const edited=projects.applyEditorPatch(created.project.id,{theme:{density:"compact"}},"u1");assert.equal(edited.version.versionNumber,2);assert.equal(edited.version.ui.theme.density,"compact");const preview=await projects.startPreview(created.project.id);assert.equal(preview.version.id,edited.version.id);assert.match(previewAdapter.render({version:preview.version}),/Loadder Design Preview/);const restored=projects.restoreVersion(created.project.id,created.version.id,"u1");assert.equal(restored.version.versionNumber,3);assert.notEqual(restored.version.id,created.version.id);assert.equal(projects.canDeployProduction(created.project.id),false);
const integrations=new LoadderIntegrationStore(db),connection=integrations.create({projectId:created.project.id,definition:{id:"crm-api",type:"rest",name:"CRM API",config:{baseUrl:"https://example.test"}}});assert.equal(connection.definition.config.baseUrl,"https://example.test");assert.equal(integrations.list({projectId:created.project.id}).length,1);
const storage=createLocalObjectStorage({rootDir:dir,signingSecret:"commercial-test-secret"}),stored=await storage.put({key:`${created.project.id}/invoice.txt`,body:Buffer.from("invoice")}),signed=storage.sign(stored.key,{ttlMs:60_000});assert.equal((await storage.get(stored.key)).toString(),"invoice");assert.equal(storage.verify(signed),true);
const payments=createPaymentRuntime({createIntent:async intent=>({providerId:`demo-${intent.reference}`,checkoutUrl:"https://pay.example.test/checkout"}),verifyEvent:async()=>({id:"evt-1",type:"payment.succeeded",reference:"order-1",status:"succeeded",amount:12500,currency:"USD"}),idempotencyStore:createMemoryPaymentIdempotencyStore()}),intent=await payments.start({provider:"demo",amount:12500,currency:"USD",reference:"order-1"});assert.equal(intent.checkoutUrl,"https://pay.example.test/checkout");const first=await payments.handleWebhook({payload:"{}",signature:"ok"}),second=await payments.handleWebhook({payload:"{}",signature:"ok"});assert.equal(first.idempotent,false);assert.equal(second.idempotent,true);});await runWithWorkspace("w2",async()=>{const integrations=new LoadderIntegrationStore(db);assert.equal(integrations.list({projectId}).length,0);});}finally{await fs.rm(dir,{recursive:true,force:true});db.close();}});
