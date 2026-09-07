import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { createPlatformAdminReadModel, createPlatformAdminRouter, createPlatformGrantResolver } from "../app/routes/platform-admin.mjs";
import { parseInventoryPagination } from "../app/repositories/platform-admin-inventory.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createRequireAuth } from "../app/middleware/auth.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";

test("inventory pagination rejects ambiguous and unsafe inputs", () => {
  assert.deepEqual(parseInventoryPagination({}),{page:1,pageSize:25,offset:0});
  assert.deepEqual(parseInventoryPagination({page:"2",pageSize:"100"}),{page:2,pageSize:100,offset:100});
  for (const value of ["0","-1","1.5","1e2",""," 1","01",["1","2"],{},"9007199254740992"]) {
    assert.equal(parseInventoryPagination({page:value}),null);
    assert.equal(parseInventoryPagination({pageSize:value}),null);
  }
  assert.equal(parseInventoryPagination({pageSize:"101"}),null);
  assert.equal(parseInventoryPagination({page:"9007199254740991",pageSize:"100"}),null);
  assert.equal(parseInventoryPagination({search:"anything"}),null);
});

test("inventory API uses canonical records, bounded pages and fail-closed audits", async t => {
  let statements = [];
  const db = new Database(":memory:",{verbose:sql => statements.push(sql)});
  db.pragma("foreign_keys = ON");
  runMigrations(db,[migration001Identity,migration004WorkspaceManagementAudit]);
  const timestamp = "2026-09-07T10:00:00.000Z";
  for (let i=0;i<105;i++) {
    const id = `u${String(i).padStart(3,"0")}`;
    db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)").run(id,`private-mobile-${i}`,`User ${i}`,`private-email-${i}`,i===2?"disabled":"active",timestamp,timestamp);
  }
  for (const [id,status] of [["w1","active"],["w2","disabled"],["w3","active"]]) {
    db.prepare("INSERT INTO workspaces VALUES (?,?,?,?,?,?)").run(id,id,id,status,timestamp,timestamp);
  }
  for (const [id,w,u,role,status] of [
    ["m1","w1","u000","owner","active"],["m2","w2","u000","owner","active"],
    ["m3","w1","u001","admin","inactive"],["m4","w1","u002","member","active"],
  ]) db.prepare("INSERT INTO workspace_memberships VALUES (?,?,?,?,?,?,?)").run(id,w,u,role,status,timestamp,timestamp);
  for (const [id,seen,revoked] of [["s1","2026-08-01T10:00:00.000Z",null],["s2","2026-08-02T10:00:00.000Z",timestamp]]) {
    db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at,revoked_at) VALUES (?,?,?,?,?,?,?)")
      .run(id,"u000",`private-token-${id}`,timestamp,timestamp,seen,revoked);
  }
  const repository = createIdentityRepository(db);
  const readModel = createPlatformAdminReadModel(db);
  const app = express();
  // Session resolution is fixture-only; the canonical middleware and platform grants are exercised.
  app.use(createRequireAuth({resolveSession:token => ["support","owner","admin","member"].includes(token)
    ? {user:{id:token==="support"?"u104":token,role:token}} : null}));
  app.use("/api/platform-admin",createPlatformAdminRouter({readModel,auditRepository:repository,
    resolvePlatformGrant:createPlatformGrantResolver('{"u104":["platform_support"]}'),now:()=>timestamp}));
  const server = await new Promise(resolve => {const listener=app.listen(0,"127.0.0.1",()=>resolve(listener));});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
  const request = (path,token="support",method="GET") => fetch(`http://127.0.0.1:${server.address().port}/api/platform-admin/${path}`,{
    method,headers:{cookie:`loadder_session=${token}`,"x-platform-role":"platform_super_admin","x-workspace-id":"w1"}});
  const audits = () => db.prepare("SELECT * FROM audit_logs").all();

  await t.test("users pages have deterministic ties, redaction and exact counts",async()=>{
    const before=audits().length;
    const response=await request("users");assert.equal(response.status,200);
    const body=await response.json();
    assert.deepEqual(body.pagination,{page:1,pageSize:25,total:105,totalPages:5});
    assert.equal(body.items.length,25);
    assert.equal(body.items[0].id,"u000");
    assert.equal(body.items[0].workspaceCount,2);assert.equal(body.items[0].activeWorkspaceCount,1);
    assert.deepEqual(body.items[0].lastActivity,{status:"evidenced",at:"2026-08-02T10:00:00.000Z",source:"sessions.last_seen_at"});
    assert.deepEqual(body.items[1].lastActivity,{status:"unknown",at:null});
    assert.deepEqual(Object.keys(body.items[0]).sort(),["id","name","status","createdAt","workspaceCount","activeWorkspaceCount","lastActivity"].sort());
    assert.doesNotMatch(JSON.stringify(body),/private-|token|mobile|email|otp|sessionId/);
    assert.equal(audits().length,before+1);
    const audit=audits().at(-1);
    assert.equal(audit.workspace_id,null);assert.equal(audit.action,"platform_admin.read_users");
    assert.deepEqual(JSON.parse(audit.metadata_json),{roles:["platform_support"],page:1,pageSize:25,resultCount:25});
    const next=await(await request("users?page=2")).json();assert.equal(next.items[0].id,"u025");
    assert.deepEqual((await(await request("users")).json()).items,body.items);
    assert.equal((await(await request("users?pageSize=100")).json()).items.length,100);
    assert.deepEqual((await(await request("users?page=100")).json()).items,[]);
  });
  await t.test("workspace pages preserve membership cardinality without session fan-out",async()=>{
    const before=audits().length;
    const response=await request("workspaces?pageSize=2");assert.equal(response.status,200);
    const body=await response.json();
    assert.deepEqual(body.pagination,{page:1,pageSize:2,total:3,totalPages:2});
    assert.deepEqual(body.items[0],{id:"w1",name:"w1",slug:"w1",status:"active",createdAt:timestamp,memberCount:3,activeMemberCount:1,ownerCount:1});
    assert.equal(audits().length,before+1);assert.equal(audits().at(-1).action,"platform_admin.read_workspaces");
    const next=await(await request("workspaces?page=2&pageSize=2")).json();
    assert.equal(next.items[0].id,"w3");assert.equal(next.items[0].memberCount,0);assert.equal(next.items[0].ownerCount,0);
  });
  await t.test("anonymous, unknown and workspace roles cannot read cross-tenant inventory",async()=>{
    const before=audits().length;
    for (const endpoint of ["users","workspaces"]) for (const role of ["unknown","owner","admin","member"]) {
      assert.equal((await request(endpoint,role)).status,role==="unknown"?401:403);
    }
    assert.equal(audits().length,before);
  });
  await t.test("invalid pagination and exports fail without audit or data",async()=>{
    const before=audits().length;
    for (const endpoint of ["users","workspaces"]) for (const query of ["page=0","pageSize=101","page=1&page=2","pageSize=-1","page=1%20OR%201=1","export=csv"]) {
      const response=await request(`${endpoint}?${query}`);assert.equal(response.status,400);assert.equal((await response.json()).items,undefined);
    }
    assert.equal(audits().length,before);
  });
  await t.test("no mutation endpoints or identity record writes",async()=>{
    const snapshot=()=>["users","workspaces","workspace_memberships","sessions"].map(table=>db.prepare(`SELECT * FROM ${table}`).all());
    const before=snapshot();
    for (const endpoint of ["users","workspaces"]) for (const method of ["POST","PATCH","DELETE","PUT"]) assert.equal((await request(endpoint,"support",method)).status,404);
    await request("users");await request("workspaces");assert.deepEqual(snapshot(),before);
  });
  await t.test("read query count stays constant as page size grows",()=>{
    for (const resource of ["users","workspaces"]) for (const size of [1,100]) {
      statements=[];readModel[resource](parseInventoryPagination({pageSize:String(size)}));
      assert.equal(statements.filter(sql=>/^\s*(WITH|SELECT)/i.test(sql)).length,2);
    }
  });
  await t.test("audit persistence failure blocks both responses",async()=>{
    const before=audits().length;
    db.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'private-storage-error'); END");
    for (const endpoint of ["users","workspaces"]) {
      const response=await request(endpoint);assert.equal(response.status,500);
      const body=await response.json();assert.equal(body.items,undefined);assert.doesNotMatch(JSON.stringify(body),/private-storage-error/);
    }
    assert.equal(audits().length,before);
  });
});
