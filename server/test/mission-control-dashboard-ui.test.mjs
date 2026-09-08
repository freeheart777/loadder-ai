import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard=readFileSync(new URL("../../src/pages/DashboardPage.tsx",import.meta.url),"utf8");
const mission=readFileSync(new URL("../../src/components/mission-control/MissionControlDashboard.tsx",import.meta.url),"utf8");

test("Mission Control Dashboard UI V1",async t=>{
  await t.test("is the primary canonical dashboard block with Persian RTL identity",()=>{
    assert.match(dashboard,/dir="rtl"/);assert.match(dashboard,/<MissionControlDashboard/);
    assert.ok(dashboard.indexOf("<MissionControlDashboard")<dashboard.indexOf("<BusinessBrainMotion"));
    assert.match(mission,/چه چیزی الان به توجه/);assert.match(mission,/مرکز مأموریت رشد/);
  });
  await t.test("reads the canonical endpoint once and supports only manual refresh",()=>{
    assert.match(mission,/apiFetch\("\/api\/mission-control"\)/);assert.match(mission,/useEffect\(\(\)=>\{void load\(\);\},\[load\]\)/);
    assert.doesNotMatch(mission,/setInterval|setTimeout|poll/i);assert.match(mission,/به‌روزرسانی/);
  });
  await t.test("shows four primary items, bounded overflow, count, and generated time",()=>{
    assert.match(mission,/items\.slice\(0,4\)/);assert.match(mission,/items\.slice\(4,7\)/);assert.match(mission,/مورد بر پایه شواهد فعلی/);assert.match(mission,/آخرین تولید/);assert.match(mission,/bounds\.maxItems/);
  });
  await t.test("keeps fact, belief, authority, UNKNOWN and explainability visually distinct",()=>{
    assert.match(mission,/واقعیت ·/);assert.match(mission,/برداشت پیشنهادی، نه واقعیت/);assert.match(mission,/رکورد معتبر دامنه/);assert.match(mission,/نامشخص ·/);assert.match(mission,/چرا اینجا نمایش داده شده/);
  });
  await t.test("preserves exact decision semantics, Persian bands, and cautious S4 language",()=>{
    for(const value of ["NO_DECISION","DEFERRED","AMBIGUOUS"])assert.match(mission,new RegExp(value));
    for(const label of ["امروز تصمیم بگیرید","بررسی","اطلاعی"])assert.match(mission,new RegExp(label));
    assert.match(mission,/این به معنی از دست رفتن درآمد یا انتساب نیست/);assert.doesNotMatch(mission,/lost attribution|lost revenue/i);
  });
  await t.test("derives urgency from band while reconciliation remains a factual badge",()=>{
    assert.match(mission,/bandStyles\[item\.band\]/);assert.match(mission,/data-priority-tone/);assert.match(mission,/وضعیت واقعی: نیازمند تطبیق/);assert.doesNotMatch(mission,/item\.signalId===.*CONTENT_CANDIDATE_STUCK.*urgent/);assert.doesNotMatch(mission,/<Siren/);
    assert.match(mission,/staleReasons/);assert.match(mission,/\/dashboard\/business-brain/);
  });
  await t.test("allowlisted Persian labels prevent raw customer-facing enum fallbacks",()=>{for(const token of ["EXPERIMENT_OUTCOME_REVIEW","INSPECT_FUNNEL_BOTTLENECK","DRAFT","READY","RUNNING","COMPLETED"])assert.match(mission,new RegExp(`${token}:`));assert.match(mission,/\^\[A-Z\]\[A-Z0-9_\]\*\$/);assert.match(mission,/وضعیت ثبت‌شده/);});
  await t.test("isolates partial and total failures with retry and truthful empty state",()=>{
    assert.match(mission,/بخشی از بررسی‌های هوشمند فعلاً در دسترس نیست/);assert.match(mission,/هیچ سیگنالی قابل دریافت نیست/);assert.match(mission,/تلاش دوباره/);assert.match(mission,/مورد نیازمند توجهی دیده نمی‌شود/);assert.match(mission,/فقط بر پایه سیگنال‌های موفق فعلی/);
  });
  await t.test("uses deep links only and exposes no execution or client role gate",()=>{
    assert.match(mission,/allowedLinks/);assert.match(mission,/requiredApproval/);assert.doesNotMatch(mission,/method:\s*["']POST|method:\s*["']PATCH|method:\s*["']DELETE/);assert.doesNotMatch(mission,/owner|admin|membership|role\s*===/i);
  });
  await t.test("keeps mobile layout bounded and touch targets accessible",()=>{
    assert.match(dashboard,/overflow-x-hidden/);assert.match(dashboard,/hidden h-screen.*lg:flex/);assert.match(dashboard,/p-4 sm:p-8/);assert.match(mission,/min-h-11/);assert.match(mission,/sm:grid-cols-2/);
  });
  await t.test("does not reconstruct signals or add fake metrics",()=>{
    assert.doesNotMatch(mission,/fetch\([^)]*experiments|fetch\([^)]*recommendations|fetch\([^)]*crm/i);assert.doesNotMatch(mission,/healthScore|successRate|uplift|causalEffect|revenueTotal/);assert.doesNotMatch(mission,/OpenAI|agent\/run|provider prompt/i);
  });
});
