import { expect, test } from "@playwright/test";

const fact=(label:string,value:string,id:string)=>({label,value,sourceRef:{type:"TEST",id}});
const item=(signalId:string,index:number)=>({
  signalId,band:index===0?"NOW":"NEXT",
  facts:signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION"?[fact("DECISION_STATE","DEFERRED",`f-${index}`),fact("MEASUREMENT_WINDOW_ENDED_AT","2026-09-09T10:00:00.000Z",`f-${index}`)]:[fact("CANDIDATE_STATE",index===1?"RECONCILIATION_REQUIRED":"PENDING",`f-${index}`)],
  beliefs:[],unknown:["CAUSALITY"],action:{label:signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION"?"REVIEW_EXPERIMENT_OUTCOME":"REVIEW_CONTENT_CANDIDATE",requiredApproval:"HUMAN_REVIEW",executable:false,deepLink:signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION"?"/dashboard/growth-loop/experiment-1":"/dashboard/content"},explainability:{index},whyThisIsHere:signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION"?"MEASUREMENT_WINDOW_ENDED_WITHOUT_GOVERNED_DECISION":"PROVIDER_OUTCOME_REQUIRES_RECONCILIATION",
});

test("Mission Control is a bounded mobile-safe dashboard front door",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route("**/api/auth/me",route=>route.fulfill({json:{user:{id:"user-1",name:"آزاده",mobile:"",email:null,status:"active"},memberships:[{id:"m-1",role:"member",status:"active",workspace:{id:"w-1",name:"آزمایش",slug:"test",status:"active"}}],activeWorkspace:{id:"w-1",name:"آزمایش",slug:"test",status:"active"}}}));
  await page.route("**/api/mission-control",route=>route.fulfill({json:{success:true,missionControl:{contractVersion:1,generatedAt:"2026-09-09T12:00:00.000Z",items:Array.from({length:7},(_,i)=>item(i===0?"EXPERIMENT_WINDOW_CLOSED_NO_DECISION":"CONTENT_CANDIDATE_STUCK",i)),banners:[{code:"STALE_BUSINESS_CONTEXT",staleReasons:["BUSINESS_PROFILE_CHANGED"]}],signalStatus:[{signalId:"S1",status:"ok"},{signalId:"S2",status:"ok"},{signalId:"S3",status:"ok"},{signalId:"S4",status:"failed"}],bounds:{maxItems:7,truncated:false}}}}));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading",{name:/آزاده، چه چیزی الان به توجهت نیاز دارد/})).toBeVisible();
  await expect(page.getByText("بخشی از سیگنال‌ها در دسترس نیست",{exact:false})).toBeVisible();
  await expect(page.getByText("پروفایل کسب‌وکار تغییر کرده است")).toBeVisible();
  await expect(page.getByText("نمایش ۳ مورد دیگر")).toBeVisible();
  await expect(page.getByRole("link",{name:"بررسی نتیجه آزمایش"})).toHaveAttribute("href","/dashboard/growth-loop/experiment-1");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
