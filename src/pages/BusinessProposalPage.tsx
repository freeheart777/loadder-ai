import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpLeft, Briefcase, Buildings, ChartLineUp, CheckCircle, FileText, Flag, Package, Sparkle, Target, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";

type BusinessProfile = { name?: string | null; industry?: string | null; description?: string | null; website?: string | null };
type BusinessDna = { valueProposition?: string | null; targetAudiences?: string[]; offerings?: string[]; positioning?: string | null; differentiators?: string[] };
type BrandVersion = { versionNumber?: number; status?: string; brandIdentity?: Record<string, string>; brandPersonality?: string[]; toneOfVoice?: string | null; visualDirection?: string | null; primaryColors?: string[]; typography?: Record<string, string> };
type ProposalData = { profile: BusinessProfile | null; dna: BusinessDna | null; brand: BrandVersion | null; loading: boolean; errors: string[] };

function present(...values: Array<string | null | undefined>) { return values.find((value) => typeof value === "string" && value.trim())?.trim() || ""; }
function joined(values?: string[]) { return values?.filter(Boolean).join("، ") || ""; }

function ProposalSection({ icon: Icon, title, description, value, source, missingLabel = "این اطلاعات هنوز در منبع موجود نیست." }: { icon: React.ElementType; title: string; description: string; value: string; source: string; missingLabel?: string }) {
  return <article className={`rounded-2xl border p-5 ${value ? "border-white/10 bg-white/[.035]" : "border-dashed border-white/10 bg-white/[.015]"}`}>
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><Icon size={19} weight="duotone" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{title}</h3><span className={`rounded-full px-2 py-1 text-[9px] ${value ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[.05] text-white/35"}`}>{value ? source : "نیازمند اطلاعات"}</span></div><p className="mt-1 text-[11px] leading-5 text-white/35">{description}</p><p className={`mt-4 whitespace-pre-wrap text-sm leading-7 ${value ? "text-white/75" : "text-white/30"}`}>{value || missingLabel}</p></div></div>
  </article>;
}

export default function BusinessProposalPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ProposalData>({ profile: null, dna: null, brand: null, loading: true, errors: [] });

  useEffect(() => {
    let mounted = true;
    const read = async (path: string) => {
      const response = await apiFetch(path);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `خطا در دریافت ${path}`);
      return body;
    };
    void Promise.allSettled([read("/api/business-profile"), read("/api/business-dna"), read("/api/brand-book")]).then((results) => {
      if (!mounted) return;
      const errors: string[] = [];
      const profileResult = results[0];
      const dnaResult = results[1];
      const brandResult = results[2];
      if (profileResult.status === "rejected") errors.push("پروفایل کسب‌وکار بارگذاری نشد.");
      if (dnaResult.status === "rejected") errors.push("اطلاعات جایگاه و خدمات بارگذاری نشد.");
      if (brandResult.status === "rejected") errors.push("هویت برند بارگذاری نشد.");
      const profileBody = profileResult.status === "fulfilled" ? profileResult.value : {};
      const dnaBody = dnaResult.status === "fulfilled" ? dnaResult.value : {};
      const brandBody = brandResult.status === "fulfilled" ? brandResult.value : {};
      setData({
        profile: profileBody.profile || null,
        dna: dnaBody.latestDraft || dnaBody.activeVersion || null,
        brand: brandBody.latestDraft || brandBody.activeVersion || null,
        loading: false,
        errors,
      });
    });
    return () => { mounted = false; };
  }, []);

  const identity = data.brand?.brandIdentity || {};
  const audience = joined(data.dna?.targetAudiences) || present(identity.audience, identity.audienceProblem);
  const positioning = present(data.dna?.positioning, identity.differentiation);
  const valueProposition = present(data.dna?.valueProposition, identity.valueProposition);
  const services = joined(data.dna?.offerings);
  const brandDirection = [
    present(data.brand?.toneOfVoice) && `لحن: ${data.brand?.toneOfVoice}`,
    present(data.brand?.visualDirection) && `جهت بصری: ${data.brand?.visualDirection}`,
    joined(data.brand?.primaryColors) && `رنگ‌ها: ${joined(data.brand?.primaryColors)}`,
    present(data.brand?.typography?.primary, data.brand?.typography?.body, data.brand?.typography?.fontFamily) && `تایپوگرافی: ${present(data.brand?.typography?.primary, data.brand?.typography?.body, data.brand?.typography?.fontFamily)}`,
  ].filter(Boolean).join("\n");
  const companyOverview = [
    present(data.profile?.name, identity.name) && `نام: ${present(data.profile?.name, identity.name)}`,
    present(data.profile?.industry, identity.industry) && `حوزه فعالیت: ${present(data.profile?.industry, identity.industry)}`,
    present(data.profile?.description, identity.description),
  ].filter(Boolean).join("\n");
  const sections = useMemo(() => [
    { icon: Buildings, title: "معرفی شرکت", description: "هویت پایه و معرفی کسب‌وکار.", value: companyOverview, source: "پروفایل کسب‌وکار و Brand Core" },
    { icon: Flag, title: "جایگاه کسب‌وکار", description: "جایگاه و تمایز تعریف‌شده برای برند.", value: positioning, source: "Business DNA / Brand Core" },
    { icon: UsersThree, title: "مخاطب هدف", description: "گروه‌هایی که کسب‌وکار برای آن‌ها ارزش ایجاد می‌کند.", value: audience, source: "Business DNA / Brand Core" },
    { icon: Package, title: "خدمات و پیشنهادها", description: "خدمات یا پیشنهادهای ثبت‌شده در اطلاعات کسب‌وکار.", value: services, source: "Business DNA" },
    { icon: Target, title: "ارزش پیشنهادی", description: "ارزشی که برای مشتری ایجاد می‌شود.", value: valueProposition, source: "Business DNA / Brand Core" },
    { icon: ChartLineUp, title: "خلاصه بازار", description: "تحلیل بازار باید بر پایه داده معتبر به این بخش افزوده شود.", value: "", source: "", missingLabel: "داده بازار در منابع فعلی در دسترس نیست؛ این بخش تا زمان اتصال اطلاعات معتبر خالی می‌ماند." },
    { icon: Sparkle, title: "جهت‌گیری برند", description: "لحن و اصول بصری برند برای استفاده در پروپوزال.", value: brandDirection, source: "Brand Core" },
  ], [companyOverview, positioning, audience, services, valueProposition, brandDirection]);
  const readyCount = sections.filter((section) => Boolean(section.value)).length;

  return <main dir="rtl" className="min-h-screen bg-[#070910] text-white">
    <header className="border-b border-white/[.07] bg-black/25"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8"><div className="flex items-center gap-3"><button type="button" aria-label="بازگشت به داشبورد" onClick={() => navigate("/dashboard")} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-white/60 hover:text-white"><ArrowRight size={17}/></button><span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200"><FileText size={20} weight="duotone"/></span><div><p className="text-[10px] font-black tracking-[.15em] text-cyan-200">BUSINESS PROPOSAL</p><h1 className="mt-1 text-sm font-semibold">فضای کاری پروپوزال</h1></div></div><Link to="/dashboard/brand-book" className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/60 hover:bg-white/[.05]">مشاهده Brand Core</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <section className="relative overflow-hidden rounded-[28px] border border-violet-300/15 bg-gradient-to-bl from-violet-500/[.13] via-slate-900/70 to-cyan-500/[.07] p-6 sm:p-8"><div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl"/><div className="relative flex flex-wrap items-start justify-between gap-6"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1.5 text-[10px] text-violet-100"><Briefcase size={13}/> طرح پروپوزال</span><h2 className="mt-4 text-2xl font-bold sm:text-3xl">پروپوزالی بر پایه شناخت واقعی کسب‌وکار</h2><p className="mt-3 text-sm leading-7 text-white/50">اطلاعات موجود از پروفایل کسب‌وکار، Business DNA و Brand Core در یک ساختار قابل مرور کنار هم قرار می‌گیرد.</p></div><div className="min-w-44 rounded-2xl border border-white/10 bg-black/20 p-4"><span className="text-[10px] text-white/40">آمادگی اطلاعات</span><div className="mt-2 flex items-end gap-2"><b className="text-2xl">{data.loading ? "—" : `${readyCount}/${sections.length}`}</b><span className="pb-1 text-[10px] text-white/35">بخش دارای داده</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${(readyCount / sections.length) * 100}%` }}/></div></div></div></section>

      {data.loading && <p className="mt-6 rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm text-white/45">در حال خواندن اطلاعات ذخیره‌شده…</p>}
      {!data.loading && data.errors.length > 0 && <p className="mt-6 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-400/[.06] p-4 text-xs leading-6 text-amber-100/70"><WarningCircle className="mt-1 shrink-0"/>{data.errors.join(" ")} بخش‌های موجود همچنان نمایش داده می‌شوند.</p>}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="space-y-3">{sections.map((section) => <ProposalSection key={section.title} {...section}/>)}</section>
        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[.025] p-5 lg:sticky lg:top-6"><div className="flex items-center gap-2"><CheckCircle size={18} className="text-emerald-200"/><h3 className="font-semibold">آماده‌سازی خروجی</h3></div><p className="mt-3 text-xs leading-6 text-white/40">ساخت و دریافت فایل پس از آماده‌شدن قابلیت تولید پروپوزال فعال می‌شود. این صفحه فعلاً ساختار و منابع اطلاعات را آماده می‌کند.</p><button type="button" disabled className="mt-5 flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-violet-500/20 px-4 text-xs font-bold text-violet-100/45" title="تولید و خروجی هنوز در دسترس نیست"><Sparkle size={15}/>تولید و خروجی · به‌زودی</button><div className="mt-5 space-y-2 border-t border-white/10 pt-4"><Link to="/dashboard/business-brain" className="flex items-center justify-between rounded-xl bg-white/[.035] px-3 py-3 text-xs text-white/65 hover:bg-white/[.07]">تکمیل Business DNA<ArrowUpLeft size={15}/></Link><Link to="/dashboard/brand-book" className="flex items-center justify-between rounded-xl bg-white/[.035] px-3 py-3 text-xs text-white/65 hover:bg-white/[.07]">تکمیل Brand Core<ArrowUpLeft size={15}/></Link></div><div className="mt-5 rounded-xl border border-cyan-300/10 bg-cyan-400/[.04] p-3"><span className="text-[10px] font-bold text-cyan-100/80">One brand powers everything</span><p className="mt-1 text-[10px] leading-5 text-white/35">Brand Core → Proposal → Website → Marketing</p></div></aside>
      </div>
    </div>
  </main>;
}
