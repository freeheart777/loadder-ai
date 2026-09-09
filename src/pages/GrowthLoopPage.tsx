import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";

type Experiment = { id:string; goalRef:string; goalContextVersionId:string; hypothesis:string; treatmentDefinition:string; goalContract:{metric:string;direction:string;target:number;unit:string;measurementWindow:{start:string;end:string};baseline:{state:string}} };
type Brief = { id:string; experiment_id:string; goal_context_version_id:string; goal_ref:string; contract_json:string };
type Candidate = { id:string; brief_id:string; state:string; body:string|null; provider:string|null; model:string|null };
type CopilotReceipt = { id:string; status:string; result:{evidence?:{state:string;references:unknown[];truncated:boolean}} };
type Finding = { id:string; state:"ACTIONABLE"|"INCONCLUSIVE"; value:{reasons:string[];observedCount:number;meaning:string;effectiveness:string;causality:string}; evidenceReferences:{kind:string;id:string}[] };
type Recommendation = { id:string; considerationCode:string; rationaleCode:string; provenance:{assessmentId:string;requiredApproval:string;executable:boolean;proposedAction:string;uncertainty:string} };
type Decision = { id:string; decisionType:string; observedFreshness:string };

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
  const [copilot,setCopilot]=useState<CopilotReceipt|null>(null),[finding,setFinding]=useState<Finding|null>(null),[recommendation,setRecommendation]=useState<Recommendation|null>(null),[decision,setDecision]=useState<Decision|null>(null);
  const [leadId,setLeadId]=useState(""),[busy,setBusy]=useState(""),[error,setError]=useState("");
  const contextId=experiment?.goalContextVersionId||"",goalRef=experiment?.goalRef||"";

  const load=useCallback(async()=>{
    if(!experimentId)return;
    const exp=await request<{experiment:Experiment}>(`/api/experiments/${encodeURIComponent(experimentId)}`); setExperiment(exp.experiment);
    const b=await request<{result:Brief[]}>(`/api/growth/experiments/${encodeURIComponent(experimentId)}/briefs?page=1&pageSize=25`);
    const candidates=(await Promise.all((b.result||[]).map(x=>request<{result:Candidate[]}>(`/api/growth/content/briefs/${x.id}/candidates?page=1&pageSize=10`)))).flatMap(x=>x.result||[]);
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
  const act=async(name:string,fn:()=>Promise<void>)=>{setBusy(name);setError("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"خطای ناشناخته");}finally{setBusy("");}};
  const readCopilot=async(key:string)=>{const x=await post<{result:{receipt:CopilotReceipt}}>("/api/growth/copilot/runs",{capability:"READ_CRM_OUTCOME_EVIDENCE",experimentId,contextVersionId:contextId,goalRef,candidateId:candidate?.id,idempotencyKey:key});setCopilot(x.result.receipt);};
  const runCopilot=()=>act("copilot",()=>readCopilot(`growth-ui-evidence:${experimentId}:${candidate?.id}:initial`));
  const convert=()=>act("convert",async()=>{await post(`/api/growth/leads/${encodeURIComponent(leadId)}/convert`,{candidateId:candidate?.id,experimentId,contextVersionId:contextId,goalRef,idempotencyKey:`growth-ui-convert:${leadId}`});await readCopilot(`growth-ui-evidence:${experimentId}:${candidate?.id}:lead:${leadId}`);});
  const assess=()=>act("assess",async()=>{const x=await post<{result:{assessment:Finding;recommendation:Recommendation}}>("/api/growth/assessments",{experimentId,contextVersionId:contextId,candidateId:candidate?.id});setFinding(x.result.assessment);setRecommendation(x.result.recommendation);setDecision(null);});
  const adopt=()=>act("adopt",async()=>{if(!recommendation)return;const x=await post<{decision:Decision}>(`/api/intelligence/recommendations/${recommendation.id}/decisions`,{decisionType:"ADOPT",allowStale:false,supersedesDecisionId:null},`growth-ui-adopt:${recommendation.id}`);setDecision(x.decision);});
  const reasons=useMemo(()=>finding?.value.reasons||[],[finding]);

  if(!experiment)return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#05060a] p-6 text-white">{error?<div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-rose-200">{error}</div>:<CircleNotch className="animate-spin" size={28}/>}</main>;
  return <main dir="rtl" className="min-h-screen bg-[#05060a] text-white"><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="min-w-0 rounded-3xl border border-white/10 bg-gradient-to-bl from-violet-500/15 to-cyan-400/5 p-5 sm:p-8"><Link to="/dashboard" className="inline-flex min-h-11 items-center gap-2 text-sm text-white/60"><ArrowRight/> داشبورد</Link><p className="mt-5 text-xs font-bold text-violet-300">همراه تصمیم‌گیری رشد</p><h1 className="mt-2 text-2xl font-black sm:text-4xl">چرخهٔ رشد قابل توضیح</h1><p className="mt-3 max-w-3xl leading-8 text-white/55">از هدف و محتوای تأییدشده تا شواهد واقعی CRM و تصمیم انسانی؛ بدون انتشار، هزینه یا اجرای خودکار.</p></header>
    <nav aria-label="دسترسی سریع" className="mt-4 grid grid-cols-3 gap-2 lg:hidden"><Link to="/dashboard" className="grid min-h-11 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-sm">داشبورد</Link><Link to="/dashboard/crm" className="grid min-h-11 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-sm">CRM</Link><Link to="/dashboard/content" className="grid min-h-11 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-sm">محتوا</Link></nav>
    {error&&<div role="alert" className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200"><WarningCircle className="ml-2 inline"/> {error}</div>}
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <Card n="۱" title="هدف و زمینه"><Fact label="هدف" value="افزایش لیدهای واجد شرایط"/><Fact label="معیار" value={`تعداد لید · هدف ${experiment.goalContract.target}`}/><Fact label="زمینهٔ کسب‌وکار" value="نسخه معتبر و متصل"/><Fact label="خط مبنا" value={fa(experiment.goalContract.baseline.state)}/></Card>
      <Card n="۲" title="آزمایش"><Fact label="فرضیه" value={experiment.hypothesis}/><Fact label="درمان" value={experiment.treatmentDefinition}/><Fact label="پنجره" value={`${experiment.goalContract.measurementWindow.start} ← ${experiment.goalContract.measurementWindow.end}`}/></Card>
      <Card n="۳" title="محتوای پیشنهادی">{candidates.map((item,index)=><div key={item.id} data-candidate-state={item.state} className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between gap-3 text-sm"><span>نسخه محتوایی {new Intl.NumberFormat("fa-IR").format(index+1)}</span><span className="text-violet-200">{fa(item.state)}</span></div>{item.body&&<p className="mt-2 line-clamp-3 text-sm leading-7 text-white/60">{item.body}</p>}</div>)}<p className="mt-3 text-xs text-white/40">فقط نسخهٔ تأییدشده هویت محتوای آزمایش است؛ تأیید محتوا مجوز انتشار نیست.</p></Card>
      <Card n="۴" title="شواهد CRM"><button disabled={!candidate||busy!==""} onClick={runCopilot} className="min-h-11 rounded-xl bg-white/10 px-4 text-sm disabled:opacity-40">خواندن شواهد موجود</button><div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row"><input aria-label="شناسه سرنخ در CRM" value={leadId} onChange={e=>setLeadId(e.target.value)} className="min-h-11 min-w-0 w-full flex-1 rounded-xl border border-white/10 bg-black/30 px-3" placeholder="شناسه سرنخ در CRM"/><button disabled={!candidate||!leadId||busy!==""} onClick={convert} className="min-h-11 w-full rounded-xl bg-cyan-500 px-4 font-bold text-black disabled:opacity-40 sm:w-auto">ثبت تبدیل در CRM</button></div><Fact label="وضعیت شواهد" value={fa(copilot?.result.evidence?.state||"UNKNOWN")}/><Fact label="تعداد مراجع" value={String(copilot?.result.evidence?.references?.length||0)}/></Card>
      <Card n="۵" title="ارزیابی"><button disabled={!candidate||busy!==""} onClick={assess} className="min-h-11 rounded-xl bg-violet-500 px-4 font-bold disabled:opacity-40">ارزیابی شواهد</button><Fact label="نتیجه" value={finding?fa(finding.state):"نامشخص"}/><Fact label="شمارش ثبت‌شده" value={finding?String(finding.value.observedCount):"نامشخص"}/>{reasons.map(x=><p key={x} className="mt-2 text-sm text-amber-200">• {fa(x)}</p>)}<p className="mt-3 text-xs leading-6 text-white/40">آمادهٔ بازبینی فقط یعنی شواهد برای بررسی محدود انسانی کافی است؛ نه اثبات موفقیت، افزایش اثر، درآمد یا رابطهٔ علّی.</p></Card>
      <Card n="۶" title="پیشنهاد و تصمیم انسانی"><Fact label="پیشنهاد" value={recommendation?fa(recommendation.considerationCode):"نامشخص"}/><Fact label="نیازمند" value={fa(recommendation?.provenance.requiredApproval||"HUMAN_REVIEW")}/><button disabled={!recommendation||Boolean(decision)||busy!==""} onClick={adopt} className="mt-3 min-h-11 rounded-xl bg-emerald-500 px-4 font-bold text-black disabled:opacity-40">پذیرش برای بررسی</button>{decision&&<div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle className="ml-2 inline"/>پیشنهاد پذیرفته شد؛ هیچ اقدام خارجی هنوز اجرا نشده است.</div>}</Card>
    </div><footer className="mt-5 rounded-2xl border border-white/10 p-4 text-xs leading-6 text-white/40">مجوز اجرای خارجی صادر نشده است؛ تبلیغ، انتشار و تغییر مالی انجام نمی‌شود.</footer>
  </div></main>;
}
function Card({n,title,children}:{n:string;title:string;children:ReactNode}){return <section className="min-w-0 rounded-3xl border border-white/10 bg-white/[.035] p-5"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">{n}</span><h2 className="min-w-0 font-bold">{title}</h2></div><div className="mt-4 min-w-0">{children}</div></section>}
function Fact({label,value}:{label:string;value:string}){return <div className="mt-2 flex min-h-8 min-w-0 items-start justify-between gap-4 text-sm"><span className="shrink-0 text-white/40">{label}</span><span className="min-w-0 break-all text-left text-white/75">{value}</span></div>}
