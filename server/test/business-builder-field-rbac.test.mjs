import test from "node:test";
import assert from "node:assert/strict";
import { appFieldAccess, assertAppPayloadFields, filterDefinitionForRole, filterUiForRole, redactAppRecord } from "../app/business-builder/app-field-access.mjs";

const definition={
  id:"crm",entities:[{id:"customer",fields:[{id:"name"},{id:"email"},{id:"internalNote"}]},{id:"secret",fields:[{id:"value"}]}],relationships:[],pages:[],
  accessPolicy:{defaultRole:"public",rules:[
    {role:"customer",resource:"customer",actions:["read"],fields:["name","email"]},
    {role:"manager",resource:"customer",actions:["read","create","update"],fields:["name","email","internalNote"]},
    {role:"manager",resource:"secret",actions:["read"],fields:["value"]}
  ]}
};

test("field RBAC redacts forbidden fields while preserving system metadata",()=>{
  const access=appFieldAccess({definition,role:"customer",resource:"customer",action:"read"});
  assert.equal(access.allowed,true);
  assert.deepEqual([...access.fields].sort(),["email","name"]);
  assert.deepEqual(redactAppRecord({id:"1",name:"A",email:"a@x.com",internalNote:"hidden",createdAt:"t"},access),{id:"1",name:"A",email:"a@x.com",createdAt:"t"});
});

test("field RBAC rejects unauthorized writes instead of silently storing hidden data",()=>{
  const customer=appFieldAccess({definition,role:"customer",resource:"customer",action:"update"});
  assert.equal(customer.allowed,false);
  assert.throws(()=>assertAppPayloadFields({internalNote:"x"},customer),e=>e.code==="APP_FIELD_ACCESS_FORBIDDEN"&&e.fields.includes("internalNote"));
  const manager=appFieldAccess({definition,role:"manager",resource:"customer",action:"update"});
  assert.doesNotThrow(()=>assertAppPayloadFields({name:"A",internalNote:"ok"},manager));
});

test("role-filtered definition removes inaccessible resources and fields",()=>{
  const customer=filterDefinitionForRole(definition,"customer");
  assert.deepEqual(customer.entities.map(e=>e.id),["customer"]);
  assert.deepEqual(customer.entities[0].fields.map(f=>f.id),["name","email"]);
  const manager=filterDefinitionForRole(definition,"manager");
  assert.deepEqual(manager.entities.map(e=>e.id),["customer","secret"]);
});

test("role-filtered UI removes hidden resources and field references without losing layout metadata",()=>{
  const ui={theme:{density:"compact"},navigation:[{id:"dashboard"},{id:"customer"},{id:"secret"}],views:[
    {id:"dashboard",type:"dashboard",blocks:[]},
    {id:"customer-list",resource:"customer",blocks:[{type:"data-table",resource:"customer",columns:[{id:"name"},{id:"internalNote"}]}]},
    {id:"customer-form",resource:"customer",blocks:[{type:"form",resource:"customer",fields:[{id:"email"},{id:"internalNote"}]}]},
    {id:"secret-list",resource:"secret",blocks:[{type:"data-table",resource:"secret",columns:[{id:"value"}]}]}
  ]};
  const customer=filterUiForRole(ui,definition,"customer");
  assert.deepEqual(customer.navigation.map(x=>x.id),["dashboard","customer"]);
  assert.equal(customer.views.some(v=>v.resource==="secret"),false);
  assert.deepEqual(customer.views.find(v=>v.id==="customer-list").blocks[0].columns.map(x=>x.id),["name"]);
  assert.deepEqual(customer.views.find(v=>v.id==="customer-form").blocks[0].fields.map(x=>x.id),["email"]);
  assert.equal(customer.theme.density,"compact");
});
