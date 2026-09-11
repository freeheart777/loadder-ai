import { expect, test } from "@playwright/test";

const fact=(label:string,value:string,id:string)=>({label,value,sourceRef:{type:"TEST",id}});
const item=(signalId:string,index:number,band:string,decision?:string)=>({
  signalId,band,
  facts:signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION"?[fact("DECISION_STATE",decision||"DEFERRED",`f-${index}`),fact("EXPERIMENT_STATUS","COMPLETED",`s-${index}`),fact("MEASUREMENT_WINDOW_ENDED_AT","2026-09-09T10:00:00.000Z",`f-${index}`)]:[fact("CANDIDATE_STATE",index===1?"RECONCILIATION_REQUIRED":"PENDING",`f-${index}`)],
  beliefs:signalId==="UNDECIDED_RECOMMENDATION"?[{recommendationId:"r-1",code:"INSPECT_FUNNEL_BOTTLENECK",state:"EXPERIMENT_OUTCOME_REVIEW",confidence:null,confidenceReason:"UNKNOWN"}]:[],unknown:["CAUSALITY"],action:{label:signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION"?"REVIEW_EXPERIMENT_OUTCOME":"REVIEW_CONTENT_CANDIDATE",requiredApproval:"HUMAN_REVIEW",executable:false,deepLink:signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION"?"/dashboard/growth-loop/experiment-1":"/dashboard/content"},explainability:{index},whyThisIsHere:signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION"?"MEASUREMENT_WINDOW_ENDED_WITHOUT_GOVERNED_DECISION":"PROVIDER_OUTCOME_REQUIRES_RECONCILIATION",
});

test("the full attention surface is bounded and mobile-safe",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route("**/api/auth/me",route=>route.fulfill({json:{user:{id:"user-1",name:"آزاده",mobile:"",email:null,status:"active"},memberships:[{id:"m-1",role:"member",status:"active",workspace:{id:"w-1",name:"آزمایش",slug:"test",status:"active"}}],activeWorkspace:{id:"w-1",name:"آزمایش",slug:"test",status:"active"}}}));
  const items=[item("EXPERIMENT_WINDOW_CLOSED_NO_DECISION",0,"DECIDE_TODAY","DEFERRED"),item("CONTENT_CANDIDATE_STUCK",1,"REVIEW"),item("EXPERIMENT_WINDOW_CLOSED_NO_DECISION",2,"REVIEW","AMBIGUOUS"),item("UNDECIDED_RECOMMENDATION",3,"FYI"),...Array.from({length:3},(_,i)=>item("CONTENT_CANDIDATE_STUCK",i+4,"FYI"))];
  await page.route("**/api/mission-control",route=>route.fulfill({json:{success:true,missionControl:{contractVersion:1,generatedAt:"2026-09-09T12:00:00.000Z",items,banners:[{code:"STALE_BUSINESS_CONTEXT",staleReasons:["BUSINESS_PROFILE_CHANGED"]}],signalStatus:[{signalId:"S1",status:"ok"},{signalId:"S2",status:"ok"},{signalId:"S3",status:"ok"},{signalId:"S4",status:"failed"}],bounds:{maxItems:7,truncated:false}}}}));
  await page.goto("/dashboard/attention");
  await expect(page.getByRole("heading",{name:/آزاده، چه چیزی الان به توجهت نیاز دارد/})).toBeVisible();
  await expect(page.getByText("بخشی از بررسی‌های هوشمند فعلاً در دسترس نیست",{exact:false})).toBeVisible();
  await expect(page.getByText("پروفایل کسب‌وکار تغییر کرده است")).toBeVisible();
  await expect(page.getByText("نمایش ۳ مورد دیگر")).toBeVisible();
  await expect(page.getByText("امروز تصمیم بگیرید")).toBeVisible();
  await expect(page.getByText("به تعویق افتاده")).toBeVisible();
  await expect(page.getByText("مبهم؛ نیازمند بررسی")).toBeVisible();
  await expect(page.getByText("بررسی گلوگاه قیف")).toBeVisible();
  const decide=page.locator('[data-band="DECIDE_TODAY"]'),review=page.locator('[data-band="REVIEW"]').first();
  await expect(decide).toHaveAttribute("data-priority-tone","strong");
  await expect(review).toHaveAttribute("data-priority-tone","normal");
  await expect(page.locator('[data-band="REVIEW"]').filter({hasText:"نیازمند تطبیق"}).first()).not.toHaveClass(/bg-rose-500/);
  await expect(page.getByRole("link",{name:"بررسی نتیجه آزمایش"}).first()).toHaveAttribute("href","/dashboard/growth-loop/experiment-1");
  const visibleText=await page.locator("body").innerText();
  for(const raw of ["DECIDE_TODAY","REVIEW","EXPERIMENT_OUTCOME_REVIEW","INSPECT_FUNNEL_BOTTLENECK","COMPLETED"])expect(visibleText).not.toContain(raw);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
