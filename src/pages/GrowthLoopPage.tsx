import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";
import { describeGrowthContext, describeGrowthGoal, formatGrowthWindowDate } from "../lib/growthLoopPresentation";

type Experiment = { id:string; goalRef:string; goalContextVersionId:string; hypothesis:string; treatmentDefinition:string; goalContract:{metric:string;direction:string;target:number;unit:string;measurementWindow:{start:string;end:string};baseline:{state:string}} };
type Candidate = { id:string; brief_id:string; state:string; body:string|null; provider:string|null; model:string|null };
type Finding = { id:string; state:"ACTIONABLE"|"INCONCLUSIVE"; value:{reasons:string[];observedCount:number;meaning:string;effectiveness:string;causality:string}; evidenceReferences:{kind:string;id:string}[] };
type Recommendation = { id:string; considerationCode:string; rationaleCode:string; provenance:{assessmentId:string;requiredApproval:string;executable:boolean;proposedAction:string;uncertainty:string} };
type Decision = { id:string; decisionType:string; observedFreshness:string };
type Evidence = { state:string; references:{evidenceLinkId:string;eventId:string}[]; truncated:boolean };
type Lead = { id:string; name:string; company:string|null; maskedPhone:string|null; status:string; treatmentLinked:false };

const copy:Record<string,string>={
  ACTIONABLE:"آمادهٔ بازبینی انسانی", INCONCLUSIVE:"شواهد ناکافی", GATHER_MORE_EVIDENCE:"گردآوری شواهد بیشتر",
  INSPECT_FUNNEL_BOTTLENECK:"بررسی گلوگاه تبدیل", INCOMPLETE_WINDOW:"پنجرهٔ اندازه‌گیری کامل نشده است",
  INSUFFICIENT_EVIDENCE:"شواهد معتبر کافی ثبت نشده است", BASELINE_UNKNOWN_OR_UNVERIFIED:"خط مبنا معتبر یا قابل مقایسه نیست",
  STALE_OR_UNSUPPORTED_EVIDENCE:"بخشی از شواهد قدیمی یا فاقد مرجع معتبر است", TRUNCATED_EVIDENCE:"فهرست شواهد از حد مجاز بزرگ‌تر است",
  UNKNOWN:"نامشخص", OBSERVED:"مشاهده‌شده", APPROVED:"تأییدشده", PENDING:"در انتظار", REJECTED:"ردشده", VALIDATION_FAILED:"نامعتبر",
  RECONCILIATION_REQUIRED:"نیازمند تطبیق انسانی", HUMAN_REVIEW:"بازبینی انسانی",
};

async function request<T>(path:string, init?:RequestInit):Promise<T>{
  const response=await apiFetch(path,init); const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.code||data.message||"درخواست ناموفق بود"); return data;
}
const post=<T,>(path:string,body:unknown,key?:string)=>request<T>(path,{method:"POST",headers:{"Content-Type":"application/json",...(key?{"Idempotency-Key":key}:{})},body:JSON.stringify(body)});
const fa=(value:string)=>copy[value]||(/^[A-Z][A-Z0-9_]*$/.test(value)?"وضعیت ثبت‌شده":value);

export default function GrowthLoopPage(){
  const {experimentId=""}=useParams();
  const [experiment,setExperiment]=useState<Experiment|null>(null),[candidates,setCandidates]=useState<Candidate[]>([]),[candidate,setCandidate]=useState<Candidate|null>(null);
  const [finding,setFinding]=useState<Finding|null>(null),[recommendation,setRecommendation]=useState<Recommendation|null>(null),[decision,setDecision]=useState<Decision|null>(null);
  const [evidence,setEvidence]=useState<Evidence|null>(null),[leads,setLeads]=useState<Lead[]>([]),[leadId,setLeadId]=useState(""),[busy,setBusy]=useState(""),[error,setError]=useState("");
  const contextId=experiment?.goalContextVersionId||"",goalRef=experiment?.goalRef||"";

  const load=useCallback(async()=>{
    if(!experimentId)return;
    const exp=await request<{experiment:Experiment}>(`/api/experiments/${encodeURIComponent(experimentId)}`); setExperiment(exp.experiment);
    const candidates=(await request<{result:Candidate[]}>(`/api/growth/experiments/${encodeURIComponent(experimentId)}/candidates?page=1&pageSize=25`)).result||[];
    setCandidates(candidates);setCandidate(candidates.find(x=>x.state==="APPROVED")||candidates[0]||null);
  },[experimentId]);
  const loadOutcome=useCallback(async(candidateId:string)=>{
    const recs=await request<{recommendations:Recommendation[]}>(`/api/intelligence/recommendations?limit=25&recommendationType=EXPERIMENT_OUTCOME_REVIEW&subjectKey=${encodeURIComponent(candidateId)}`);
    const rec=recs.recommendations?.[0]||null; setRecommendation(rec);
    if(!rec){setFinding(null);setDecision(null);return;}
    const ref=(await request<{recommendation:Recommendation}>(`/api/intelligence/recommendations/${rec.id}`)).recommendation;
    const findingId=(ref as Recommendation & {semanticFindingReferences?:{id:string}[]}).semanticFindingReferences?.[0]?.id||ref.provenance.assessmentId;
    setFinding((await request<{finding:Finding}>(`/api/intelligence/semantic/findings/${findingId}`)).finding);
    const decisions=await request<{decisions:Decision[]}>(`/api/intelligence/recommendations/${rec.id}/decisions?limit=25`);setDecision(decisions.decisions?.[0]||null);
  },[]);
  useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
  useEffect(()=>{if(candidate?.id)void loadOutcome(candidate.id).catch(e=>setError(e.message));},[candidate?.id,loadOutcome]);
  const loadCanonicalEvidence=useCallback(async()=>{if(!candidate||!experiment)return;const query=new URLSearchParams({experimentId,contextVersionId:contextId,goalRef,candidateId:candidate.id}).toString();const [e,l]=await Promise.all([request<{result:Evidence}>(`/api/growth/copilot/evidence?${query}`),request<{result:Lead[]}>(`/api/growth/copilot/leads?${query}`)]);setEvidence(e.result);setLeads(l.result);setLeadId(current=>l.result.some(item=>item.id===current)?current:"");},[candidate,experiment,experimentId,contextId,goalRef]);
  useEffect(()=>{void loadCanonicalEvidence().catch(e=>setError(e.message));},[loadCanonicalEvidence]);
  const act=async(name:string,fn:()=>Promise<void>)=>{setBusy(name);setError("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"خطای ناشناخته");}finally{setBusy("");}};
  const convert=()=>act("convert",async()=>{await post(`/api/growth/leads/${encodeURIComponent(leadId)}/convert`,{candidateId:candidate?.id,experimentId,contextVersionId:contextId,goalRef,idempotencyKey:`growth-ui-convert:${leadId}`});await loadCanonicalEvidence();});
  const assess=()=>act("assess",async()=>{const x=await post<{result:{assessment:Finding;recommendation:Recommendation}}>("/api/growth/assessments",{experimentId,contextVersionId:contextId,candidateId:candidate?.id});setFinding(x.result.assessment);setRecommendation(x.result.recommendation);setDecision(null);});
  const adopt=()=>act("adopt",async()=>{if(!recommendation)return;const x=await post<{decision:Decision}>(`/api/intelligence/recommendations/${recommendation.id}/decisions`,{decisionType:"ADOPT",allowStale:false,supersedesDecisionId:null},`growth-ui-adopt:${recommendation.id}`);setDecision(x.decision);});
  const reasons=useMemo(()=>finding?.value.reasons||[],[finding]);
  const observed=evidence?.references.length??0,eligible=finding?.value.observedCount;

  if(!experiment)return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#05060a] p-6 text-white">{error?<div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-rose-200">{error}</div>:<CircleNotch className="animate-spin" size={28}/>}</main>;
  return <main dir="rtl" className="min-h-screen bg-[#05060a] text-white"><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="min-w-0 rounded-3xl border border-white/10 bg-gradient-to-bl from-violet-500/15 to-cyan-400/5 p-5 sm:p-8"><Link to="/dashboard" className="inline-flex min-h-11 items-center gap-2 text-sm text-white/60"><ArrowRight/> داشبورد</Link><p className="mt-5 text-xs font-bold text-violet-300">همراه تصمیم‌گیری رشد</p><h1 className="mt-2 text-2xl font-black sm:text-4xl">چرخهٔ رشد قابل توضیح</h1><p className="mt-3 max-w-3xl leading-8 text-white/55">از هدف و محتوای تأییدشده تا شواهد واقعی CRM و تصمیم انسانی؛ بدون انتشار، هزینه یا اجرای خودکار.</p></header>
    <nav aria-label="دسترسی سریع" className="mt-4 grid grid-cols-3 gap-2 lg:hidden"><Link to="/dashboard" className="grid min-h-11 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-sm">داشبورد</Link><Link to="/dashboard/crm" className="grid min-h-11 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-sm">CRM</Link><Link to="/dashboard/content" className="grid min-h-11 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-sm">محتوا</Link></nav>
    {error&&<div role="alert" className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200"><WarningCircle className="ml-2 inline"/> {error}</div>}
    <section aria-label="جمع‌بندی مدیریتی" className="mt-5 rounded-3xl border border-violet-300/20 bg-violet-500/[.08] p-5 sm:p-7"><p className="text-xs font-bold text-violet-200">جمع‌بندی مدیریتی</p><h2 className="mt-2 text-xl font-black sm:text-2xl">{decision?"تصمیم برای بازبینی ثبت شده است":finding?fa(finding.state):observed?"شواهد ثبت شده؛ آمادهٔ ارزیابی":"هنوز شواهد مرتبط ثبت نشده است"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Summary label="آنچه می‌دانیم" value={observed?`${new Intl.NumberFormat("fa-IR").format(observed)} مشاهدهٔ مرتبط در CRM ثبت شده است.`:"هنوز مشاهدهٔ مرتبطی ثبت نشده است."}/><Summary label="آنچه نمی‌دانیم" value="انتساب نتیجه، اثر درآمدی و رابطهٔ علّی هنوز اثبات نشده است."/><Summary label="اقدام امن بعدی" value={recommendation?fa(recommendation.considerationCode):"ارزیابی شواهد موجود"}/><Summary label="مرجع تصمیم" value={fa(recommendation?.provenance.requiredApproval||"HUMAN_REVIEW")}/><Summary label="اجرا" value="هیچ اقدام خارجی مجاز نشده است."/></div></section>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <Card n="۴" title="چه اتفاقی افتاد؟"><div className="grid gap-3 sm:grid-cols-2"><Metric testId="observed-count" label="مشاهدات ثبت‌شده" value={observed}/><Metric testId="eligible-count" label="واجد شرایط ارزیابی" value={eligible}/></div><p className="mt-3 text-sm leading-6 text-white/45">این دو عدد عمداً جدا هستند؛ ثبت مشاهده به‌تنهایی به معنی واجد شرایط بودن برای ارزیابی نیست.</p>{evidence?.truncated&&<p className="mt-3 text-sm text-amber-200">فهرست شواهد کامل نیست و نتیجه‌گیری محدود می‌ماند.</p>}<div className="mt-4 border-t border-white/10 pt-4"><label htmlFor="growth-lead" className="text-sm font-bold">سرنخ CRM</label><select data-testid="growth-lead-select" id="growth-lead" value={leadId} onChange={e=>setLeadId(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#11131a] px-3"><option value="">یک سرنخ را انتخاب کنید</option>{leads.map(lead=><option key={lead.id} value={lead.id}>{[lead.name,lead.company,lead.maskedPhone,fa(lead.status)].filter(Boolean).join(" · ")}</option>)}</select><p className="mt-2 text-xs text-white/40">سرنخ بدون پیوند درمان نمایش داده می‌شود؛ پیوند فقط هنگام ثبت تبدیل canonical ساخته می‌شود.</p><button disabled={!candidate||!leadId||busy!==""} onClick={convert} className="mt-3 min-h-11 w-full rounded-xl bg-cyan-500 px-4 font-bold text-black disabled:opacity-40 sm:w-auto">ثبت تبدیل در CRM</button></div></Card>
      <Card n="۵" title="لودر چه نتیجه‌ای می‌گیرد؟"><div className="rounded-2xl border border-amber-300/20 bg-amber-400/[.07] p-4"><p className="font-black text-amber-100">{finding?.state==="INCONCLUSIVE"?"لودر هنوز نتیجه‌گیری نمی‌کند.":finding?fa(finding.state):"برای نتیجه‌گیری، شواهد را ارزیابی کنید."}</p><p className="mt-2 text-sm leading-7 text-white/60">{observed?`${new Intl.NumberFormat("fa-IR").format(observed)} مشاهده ثبت شده، اما ${eligible===undefined?"تعداد مشاهدات واجد شرایط هنوز محاسبه نشده":`${new Intl.NumberFormat("fa-IR").format(eligible)} مشاهده واجد شرایط است`}.`:"شواهد مرتبطی ثبت نشده است."}</p><p className="mt-2 text-sm leading-7 text-white/60">بنابراین افزایش اثر، انتساب، درآمد یا رابطهٔ علّی ادعا نمی‌شود.</p></div>{reasons.map(x=><p key={x} className="mt-2 text-sm text-amber-200">• {fa(x)}</p>)}<button disabled={!candidate||busy!==""} onClick={assess} className="mt-4 min-h-11 rounded-xl bg-violet-500 px-4 font-bold disabled:opacity-40">ارزیابی شواهد</button></Card>
      <Card n="۶" title="چه تصمیمی لازم است؟"><Fact label="پیشنهاد" value={recommendation?fa(recommendation.considerationCode):"پس از ارزیابی مشخص می‌شود"}/><Fact label="نیازمند" value={fa(recommendation?.provenance.requiredApproval||"HUMAN_REVIEW")}/><button disabled={!recommendation||Boolean(decision)||busy!==""} onClick={adopt} className="mt-3 min-h-11 rounded-xl bg-emerald-500 px-4 font-bold text-black disabled:opacity-40">پذیرش برای بررسی</button>{decision&&<div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100"><p><CheckCircle className="ml-2 inline"/>تصمیم ثبت شد.</p><ul className="mt-3 space-y-2 text-white/60"><li>هیچ تبلیغی اجرا نشده است.</li><li>هیچ محتوایی منتشر نشده است.</li><li>هیچ بودجه‌ای تغییر نکرده است.</li><li>هیچ تراکنش مالی انجام نشده است.</li></ul></div>}</Card>
      <Card n="۳" title="درمان محتوایی">{candidates.map((item,index)=><button key={item.id} onClick={()=>setCandidate(item)} data-candidate-state={item.state} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-right"><span className="flex items-center justify-between gap-3 text-sm"><b>نسخه محتوایی {new Intl.NumberFormat("fa-IR").format(index+1)}</b><span className="text-violet-200">{fa(item.state)}</span></span>{item.body&&<span className="mt-2 line-clamp-3 block text-sm leading-7 text-white/60">{item.body}</span>}</button>)}<p className="mt-3 text-xs text-white/40">فقط نسخهٔ تأییدشده هویت محتوای آزمایش است؛ تأیید محتوا مجوز انتشار نیست.</p></Card>
      <details className="rounded-3xl border border-white/10 bg-white/[.025] p-5 lg:col-span-2"><summary className="min-h-11 cursor-pointer font-bold">جزئیات هدف و آزمایش</summary><div className="mt-3 grid gap-4 lg:grid-cols-2"><div><Fact label="هدف" value={describeGrowthGoal(experiment.goalRef)}/><Fact label="معیار" value={`${fa(experiment.goalContract.metric)} · هدف ${experiment.goalContract.target}`}/><Fact label="زمینهٔ کسب‌وکار" value={describeGrowthContext(experiment.goalContextVersionId)}/><Fact label="خط مبنا" value={fa(experiment.goalContract.baseline.state)}/></div><div><Fact label="فرضیه" value={experiment.hypothesis}/><Fact label="درمان" value={experiment.treatmentDefinition}/><Fact label="پنجره" value={`${formatGrowthWindowDate(experiment.goalContract.measurementWindow.start)} ← ${formatGrowthWindowDate(experiment.goalContract.measurementWindow.end)}`}/></div></div></details>
    </div><footer className="mt-5 rounded-2xl border border-white/10 p-4 text-xs leading-6 text-white/40">مجوز اجرای خارجی صادر نشده است؛ تبلیغ، انتشار و تغییر مالی انجام نمی‌شود.</footer>
  </div></main>;
}
function Card({n,title,children}:{n:string;title:string;children:ReactNode}){return <section className="min-w-0 rounded-3xl border border-white/10 bg-white/[.035] p-5"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">{n}</span><h2 className="min-w-0 font-bold">{title}</h2></div><div className="mt-4 min-w-0">{children}</div></section>}
function Summary({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/40">{label}</p><p className="mt-2 text-sm leading-6 text-white/80">{value}</p></div>}
function Metric({label,value,testId}:{label:string;value:number|undefined;testId:string}){return <div data-testid={testId} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-white/40">{label}</p><p className="mt-2 text-3xl font-black">{value===undefined?"—":new Intl.NumberFormat("fa-IR").format(value)}</p></div>}
function Fact({label,value}:{label:string;value:string}){return <div className="mt-2 flex min-h-8 min-w-0 items-start justify-between gap-4 text-sm"><span className="shrink-0 text-white/40">{label}</span><span className="min-w-0 break-all text-left text-white/75">{value}</span></div>}
