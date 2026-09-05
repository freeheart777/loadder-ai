import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration051BusinessBuilderRuntimeRecords } from "../db/migrations/051_business_builder_runtime_records.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { LoadderSqliteDataAdapter } from "../app/business-builder/sqlite-data-adapter.mjs";
import { LoadderRuntimeCopilot } from "../app/business-builder/runtime-copilot.mjs";
import { loadderBusinessCompiler } from "../app/business-builder/business-compiler.mjs";

function setup(){const db=new Database(":memory:");db.pragma("foreign_keys=ON");migration001Identity.up(db);migration051BusinessBuilderRuntimeRecords.up(db);const ts=new Date().toISOString();db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES ('w1','W1','w1','active',?,?)").run(ts,ts);return db;}

test("owned runtime supports server search pagination and total counts",async()=>{const db=setup();await runWithWorkspace("w1",async()=>{const definition=loadderBusinessCompiler.compile({intent:"برای فروش CRM بساز",name:"CRM"});const entity=definition.entities.find(e=>e.id==="customer")||definition.entities[0];const adapter=new LoadderSqliteDataAdapter(db);for(const name of ["Alpha","Beta","Alpha Two"]){await adapter.create({appId:definition.id,entityId:entity.id,payload:{name}});}const page=await adapter.list({appId:definition.id,entityId:entity.id,query:{q:"Alpha",limit:1,offset:0}});const total=await adapter.count({appId:definition.id,entityId:entity.id,query:{q:"Alpha"}});assert.equal(page.length,1);assert.equal(total,2);});db.close();});

test("runtime copilot remains useful without any external AI provider",async()=>{const db=setup();await runWithWorkspace("w1",async()=>{const definition=loadderBusinessCompiler.compile({intent:"برای فروش CRM بساز",name:"CRM"});const adapter=new LoadderSqliteDataAdapter(db);const entity=definition.entities[0];await adapter.create({appId:definition.id,entityId:entity.id,payload:{name:"Customer"}});const copilot=new LoadderRuntimeCopilot({dataAdapter:adapter});const result=await copilot.summarize({definition,projectId:"p1",message:"وضعیت را بگو"});assert.equal(result.mode,"owned-fallback");assert.match(result.answer,/رکورد/);assert.equal(result.snapshot.entities[0].total,1);});db.close();});
