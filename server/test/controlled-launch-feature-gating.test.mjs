import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CONTROLLED_LAUNCH_POLICY_V1, CONTROLLED_LAUNCH_POLICY_VERSION, projectControlledLaunchMatrix } from "../app/controlled-launch-policy.mjs";
import { createProductPolicy } from "../app/product-policy.mjs";
import { classifyApiRequest, createApiProductGate, createPublicControlledLaunchGate, MEANINGFUL_PRODUCT_ROUTE_GROUPS } from "../app/middleware/product-gating.mjs";

const response = () => ({ statusCode: 200, body: null, status(code){this.statusCode=code;return this;}, json(body){this.body=body;return this;} });
const gate = (middleware, method, path, internalAccess=false) => { const res=response();let next=false;middleware({method,path,internalAccess},res,()=>{next=true;});return{res,next}; };

test("controlled launch contract is versioned, deterministic, and code-owned",()=>{
  assert.equal(CONTROLLED_LAUNCH_POLICY_VERSION,"CONTROLLED_LAUNCH_POLICY_V1");
  assert.equal(new Set(CONTROLLED_LAUNCH_POLICY_V1.map(x=>x.featureId)).size,CONTROLLED_LAUNCH_POLICY_V1.length);
  assert.deepEqual(CONTROLLED_LAUNCH_POLICY_V1.filter(x=>x.customerVisible).map(x=>x.featureId),["business_setup","growth_workflow","content_studio","website_builder","landing_builder","forms_crm","visual_static","continuous_improvement"]);
});

test("core dependencies affect readiness without silently changing exposure",()=>{
  const unavailable=projectControlledLaunchMatrix({OPENAI:false,WEBSITE_PUBLISHING:true,LANDING_PUBLISHING:true});
  assert.equal(unavailable.find(x=>x.featureId==="growth_workflow").customerVisible,true);
  assert.equal(unavailable.find(x=>x.featureId==="growth_workflow").launchReady,false);
  assert.equal(unavailable.find(x=>x.featureId==="website_builder").launchReady,true);
});

test("meaningful route inventory classifies core, hidden, and internal groups",()=>{
  assert.ok(MEANINGFUL_PRODUCT_ROUTE_GROUPS.length>=12);
  for(const [method,path,feature] of [["GET","/api/growth/strategies","growth_workflow"],["GET","/api/websites","website_builder"],["GET","/api/forms","forms_crm"],["POST","/api/content/assets/upload-intents","asset_upload"],["GET","/api/domains","custom_domains"],["GET","/api/commerce/integration-hub","marketplace_integrations"]]) assert.equal(classifyApiRequest(method,path)?.feature,feature);
});

test("controlled production denies hidden and unknown product API bypasses",()=>{
  const middleware=createApiProductGate(createProductPolicy({nodeEnv:"production"}));
  for(const path of ["/api/domains","/api/commerce/catalogs","/api/content/assets/upload-intents","/api/not-registered-product"]) {
    const result=gate(middleware,"POST",path);assert.equal(result.next,false);assert.equal(result.res.statusCode,403);assert.equal(result.res.body.code,"FEATURE_NOT_AVAILABLE_IN_CONTROLLED_LAUNCH");
  }
});

test("controlled production keeps every core route group customer-accessible",()=>{
  const middleware=createApiProductGate(createProductPolicy({nodeEnv:"production"}));
  for(const path of ["/api/onboarding/status","/api/growth/strategies","/api/content/items","/api/websites","/api/landing/projects","/api/forms","/api/crm/leads","/api/improvement/cycles"]) assert.equal(gate(middleware,"GET",path).next,true,path);
});

test("hard launch boundaries deny payment domain marketplace execution and internal visual tools",()=>{
  const middleware=createApiProductGate(createProductPolicy({nodeEnv:"production"}));
  for(const path of ["/api/domains/d/verify","/api/commerce/marketplaces","/api/execution/requests","/api/internal/quality/summary","/api/internal/visual-components"]) assert.equal(gate(middleware,"POST",path).next,false,path);
  const publicGate=createPublicControlledLaunchGate(createProductPolicy({nodeEnv:"production"}));
  for(const path of ["/api/public/commerce/cart","/api/public/commerce/payments","/api/public/commerce/marketplaces/torob/catalogs/c/products"]) assert.equal(gate(publicGate,"POST",path).next,false,path);
});

test("development preserves bounded internal access",()=>{
  const middleware=createApiProductGate(createProductPolicy({nodeEnv:"development"}));
  assert.equal(gate(middleware,"GET","/api/domains",true).next,true);
  assert.equal(gate(middleware,"GET","/api/internal/quality/summary",true).next,true);
  assert.equal(gate(middleware,"GET","/api/internal/quality/summary",false).next,false);
});

test("public forms and landing remain available while commerce is denied",()=>{
  const middleware=createPublicControlledLaunchGate(createProductPolicy({nodeEnv:"production"}));
  assert.equal(gate(middleware,"POST","/api/public/forms/ref/submissions").next,true);
  assert.equal(gate(middleware,"POST","/api/public/landing/events").next,true);
  assert.equal(gate(middleware,"POST","/api/public/commerce/cart").res.body.code,"FEATURE_NOT_AVAILABLE_IN_CONTROLLED_LAUNCH");
});

test("frontend redirects hidden routes and removes their dashboard promises",()=>{
  const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
  const dashboard=readFileSync(new URL("../../src/pages/DashboardPage.tsx",import.meta.url),"utf8");
  for(const path of ["catalog","integrations","domains"]) assert.match(app,new RegExp(`path="/dashboard/${path}" element=\\{controlledLaunchEnabled \\? <Navigate`));
  assert.doesNotMatch(dashboard,/\/dashboard\/(catalog|integrations|domains)|\/store\/(cart|payment)/);
});
