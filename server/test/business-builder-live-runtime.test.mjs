import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration051BusinessBuilderRuntimeRecords } from "../db/migrations/051_business_builder_runtime_records.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { LoadderDataRuntime } from "../app/business-builder/data-adapter.mjs";
import { LoadderSqliteDataAdapter } from "../app/business-builder/sqlite-data-adapter.mjs";
import { importLoadderApplication, exportLoadderApplication } from "../app/business-builder/portability.mjs";
import { loadderBusinessBuilderService } from "../app/business-builder/business-builder-service.mjs";

function setup(){const db=new Database(":memory:");db.pragma("foreign_keys=ON");migration001Identity.up(db);migration050BusinessBuilderProjects.up(db);migration051BusinessBuilderRuntimeRecords.up(db);const ts=new Date().toISOString();db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES ('w1','W1','w1','active',?,?)").run(ts,ts);return db;}

test("generated app records persist in owned workspace-scoped SQLite runtime",async()=>{const db=setup();await runWithWorkspace("w1",async()=>{const plan=loadderBusinessBuilderService.preview({intent:"برای شرکت پخش CRM فروش بساز",name:"CRM"});const runtime=new LoadderDataRuntime({adapter:new LoadderSqliteDataAdapter(db)});const entity=plan.definition.entities[0];const payload={};for(const f of entity.fields||[]){if(f.required)payload[f.id]=f.type==="number"?1:"test";}const created=await runtime.execute({definition:plan.definition,action:"create",entityId:entity.id,payload});assert.ok(created.id);const listed=await runtime.execute({definition:plan.definition,action:"list",entityId:entity.id});assert.equal(listed.length,1);});db.close();});

test("Loadder export/import roundtrip preserves provider-independent definition",()=>{const plan=loadderBusinessBuilderService.preview({intent:"برای آژانس یک CRM بساز",name:"Agency"});const payload=exportLoadderApplication({project:{name:"Agency",intent:"CRM",locale:"fa-IR"},version:{versionNumber:1,definition:plan.definition,ui:plan.ui,bundle:plan.sourceBundle}});const imported=importLoadderApplication(payload);assert.equal(imported.version.definition.id,plan.definition.id);assert.equal(imported.version.definition.ownership.providerIndependent,true);});
