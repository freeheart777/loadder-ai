import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration051BusinessBuilderRuntimeRecords } from "../db/migrations/051_business_builder_runtime_records.mjs";
import { migration057BusinessBuilderAppUsers } from "../db/migrations/057_business_builder_app_users.mjs";
import { migration059BusinessBuilderAppInvites } from "../db/migrations/059_business_builder_app_invites.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBusinessBuilderRepository } from "../app/repositories/business-builder-repository.mjs";
import { LoadderAppUserAuth } from "../app/business-builder/app-user-auth.mjs";
import { createPublicBusinessAppRouter } from "../app/business-builder/public-app-router.mjs";

const definition={schemaVersion:"1.0",id:"secure-app",name:"Secure",vertical:"crm",locale:"fa-IR",entities:[{id:"ticket",name:"Ticket",fields:[{id:"title",name:"Title",type:"string",required:true},{id:"internalNote",name:"Internal",type:"text",required:false}]}],relationships:[],roles:[{id:"admin"}],permissions:[],workflows:[],pages:[],agents:[],integrations:[],automations:[],deployment:{targets:["web"],provider:"loadder"},ownership:{runtimeContract:"loadder-runtime/v1",sourceOfTruth:"loadder-app-definition",providerIndependent:true},accessPolicy:{defaultRole:"public",rules:[{role:"customer",resource:"ticket",actions:["read","create"],fields:["title"]}]}};
const ui={appId:"secure-app",renderContract:"loadder.ui.v1",navigation:[],views:[]};

test("public bootstrap and CRUD never expose or accept fields outside the app role",async()=>{
  const db=new Database(":memory:");
  for(const migration of[migration001Identity,migration050BusinessBuilderProjects,migration051BusinessBuilderRuntimeRecords,migration057BusinessBuilderAppUsers,migration059BusinessBuilderAppInvites])migration.up(db);
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES('w1','W1','w1','active','x','x')").run();
  let invite;
  runWithWorkspace("w1",()=>{
    const repo=createBusinessBuilderRepository(db);
    db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,created_at,updated_at) VALUES('p1','w1','App','secure app','fa-IR','ready','x','x')").run();
    repo.createVersion("p1",{definition,ui,bundle:{},buildPlan:{}});
    const auth=new LoadderAppUserAuth(db),user=auth.createUser({projectId:"p1",email:"c@test",role:"customer"});invite=auth.createInvite(user.id);
  });
  const app=express();app.use(createPublicBusinessAppRouter({db}));
  const server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    let response=await fetch(`${base}/public/apps/p1/invite/exchange`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:invite.token})});
    const session=(await response.json()).session;
    const headers={"content-type":"application/json","x-loadder-app-token":session.token};
    response=await fetch(`${base}/public/apps/p1/bootstrap`,{headers:{"x-loadder-app-token":session.token}});
    const bootstrap=await response.json();
    assert.deepEqual(bootstrap.definition.entities[0].fields.map(field=>field.id),["title"]);
    response=await fetch(`${base}/public/apps/p1/data/ticket`,{method:"POST",headers,body:JSON.stringify({title:"ok",internalNote:"must reject"})});
    assert.equal(response.status,400);
    assert.equal((await response.json()).code,"APP_FIELD_ACCESS_FORBIDDEN");
    response=await fetch(`${base}/public/apps/p1/data/ticket`,{method:"POST",headers,body:JSON.stringify({title:"safe"})});
    assert.equal(response.status,201);
    runWithWorkspace("w1",()=>db.prepare("UPDATE business_builder_runtime_records SET data_json=? WHERE workspace_id='w1' AND app_id='secure-app' AND entity_id='ticket'").run(JSON.stringify({title:"safe",internalNote:"server-secret"})));
    response=await fetch(`${base}/public/apps/p1/data/ticket`,{headers:{"x-loadder-app-token":session.token}});
    const list=await response.json();
    assert.equal(list.records[0].title,"safe");
    assert.equal("internalNote" in list.records[0],false);
  }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});
