import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Briefcase, CalendarCheck, Newspaper, ShoppingBag, Sparkle, Stethoscope, Scales, ImageSquare, CheckCircle } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Snapshot = {
  identity?: { businessName?: string | null; industry?: string | null; description?: string | null; website?: string | null };
  strategy?: { valueProposition?: string | null; positioning?: string | null; differentiators?: string[]; goals?: string[] };
  audiences?: { targetAudiences?: string[] };
  offerings?: Array<{ name?: string; description?: string } | string>;
  brand?: { voice?: string | null; tone?: string | null };
  visual?: { direction?: string | null; imageryDirection?: string | null; colors?: { primary?: string[]; secondary?: string[] } };
};

type ContextResponse = { activeContext?: { id: string; status: string; snapshot?: Snapshot } | null; isStale?: boolean };
type SiteType = "BUSINESS" | "STORE" | "NEWS" | "LEGAL" | "MEDICAL";

const TYPES: Array<{ id: SiteType; title: string; description: string; icon: typeof Briefcase; sections: string[] }> = [
  { id: "BUSINESS", title: "شرکتی و خدماتی", description: "معرفی کسب‌وکار، خدمات، مزیت‌ها و تماس", icon: Briefcase, sections: ["Hero", "خدمات", "مزیت رقابتی", "درباره ما", "تماس"] },
  { id: "STORE", title: "فروشگاهی", description: "ویترین محصول، دسته‌بندی و مسیر خرید", icon: ShoppingBag, sections: ["Hero", "محصولات", "دسته‌بندی‌ها", "مزیت خرید", "تماس"] },
  { id: "NEWS", title: "خبری و مجله‌ای", description: "صفحه خبر، موضوعات و محتوای تازه", icon: Newspaper, sections: ["خبر ویژه", "آخرین خبرها", "موضوعات", "درباره رسانه", "تماس"] },
  { id: "LEGAL", title: "وکلاء و خدمات حقوقی", description: "معرفی وکیل، تخصص‌ها و درخواست نوبت", icon: Scales, sections: ["Hero", "تخصص‌ها", "درباره وکیل", "رزرو نوبت", "تماس"] },
  { id: "MEDICAL", title: "پزشکان و کلینیک", description: "معرفی پزشک، خدمات، نوبت‌دهی و تماس", icon: Stethoscope, sections: ["Hero", "خدمات درمانی", "پزشک / تیم", "رزرو نوبت", "تماس"] },
];

const text = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;
const list = (value: unknown) => Array.isArray(value) ? value.filter((x): x is string => typeof x === "string" && x.trim()).slice(0, 6) : [];

export default function NativeSiteBuilderPage() {
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [type, setType] = useState<SiteType>("BUSINESS");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [message, setMessage] = useState("");
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    void apiFetch("/api/business-context/").then(async (response) => {
      const data = await response.json() as ContextResponse;
      if (!response.ok) throw new Error(data?.activeContext ? "خطا" : "BUSINESS_CONTEXT_REQUIRED");
      setContext(data);
      const snapshot = data.activeContext?.snapshot;
      setName(text(snapshot?.identity?.businessName, "کسب‌وکار شما"));
      setTagline(text(snapshot?.strategy?.valueProposition, text(snapshot?.identity?.description, "یک حضور حرفه‌ای که از داده‌های واقعی کسب‌وکار شما ساخته می‌شود.")));
      setItems(list(snapshot?.offerings).map((x) => x));
    }).catch((error) => setMessage(error instanceof Error ? error.message : "Business Context در دسترس نیست."));
  }, []);

  const selected = useMemo(() => TYPES.find((x) => x.id === type) || TYPES[0], [type]);
  const snapshot = context?.activeContext?.snapshot;
  const differentiators = list(snapshot?.strategy?.differentiators);
  const audiences = list(snapshot?.audiences?.targetAudiences);
  const goals = list(snapshot?.strategy?.goals);

  function generate() {
    if (!context?.activeContext) return setMessage("ابتدا Business Context فعال را تکمیل کن.");
    if (context.isStale) return setMessage("Business Context تغییر کرده؛ ابتدا آن را بازسازی کن.");
    setGenerated(true);
    setMessage("پیش‌نمایش اولیه بر اساس داده‌های قبلی ساخته شد.");
  }

  const theme = snapshot?.visual?.direction || snapshot?.brand?.tone || "هویت بصری برند شما";
  const primary = snapshot?.visual?.colors?.primary?.[0] || "#7c3aed";

  if (!context?.activeContext) {
    return <main dir="rtl" className="min-h-screen bg-[#050507] text-white"><section className="mx-auto max-w-3xl p-6 pt-16"><Link to="/dashboard" className="inline-flex items-center gap-2 text-white/60 hover:text-white"><ArrowRight /> بازگشت به داشبورد</Link><div className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.04] p-8"><Sparkle size={32} className="text-violet-300" /><h1 className="mt-5 text-3xl font-black">اول کسب‌وکارت را می‌شناسیم، بعد سایت را می‌سازیم.</h1><p className="mt-4 leading-8 text-white/60">اطلاعات Brand Book، Business DNA و Business Profile دوباره از تو پرسیده نمی‌شود. آن‌ها منبع ساخت سایت هستند.</p><Link to="/dashboard/business-brain" className="mt-7 inline-flex rounded-2xl bg-violet-600 px-6 py-3 font-bold">تکمیل Business Brain</Link></div></section></main>;
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#050507] text-white">
      <section className="mx-auto max-w-7xl p-5 pb-16 md:p-8">
        <div className="flex items-center justify-between"><Link to="/dashboard" className="inline-flex items-center gap-2 text-white/60 hover:text-white"><ArrowRight /> داشبورد</Link><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200">Builder بومی Loadder</span></div>
        <header className="mt-6 rounded-[32px] border border-white/10 bg-gradient-to-br from-violet-500/15 via-white/[0.03] to-cyan-500/10 p-7 md:p-9"><div className="flex flex-wrap items-start justify-between gap-6"><div className="max-w-3xl"><div className="flex items-center gap-2 text-sm text-violet-200"><Sparkle weight="fill" /> ساخت هوشمند از داده‌های واقعی</div><h1 className="mt-3 text-3xl font-black md:text-5xl">سایتت را بساز؛ بدون شروع دوباره.</h1><p className="mt-4 leading-8 text-white/60">Loadder از اطلاعات قبلی کسب‌وکار، ارزش پیشنهادی، مخاطب، خدمات و هویت برند استفاده می‌کند و یک ساختار مناسب برای نوع سایتت می‌سازد.</p></div><div className="min-w-[220px] rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-white/40">Business Context</div><div className="mt-2 font-bold">{name}</div><div className="mt-2 text-xs text-emerald-300">منبع داده فعال</div></div></div></header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-bold">۱. نوع سایت</h2><div className="mt-4 space-y-2">{TYPES.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setType(item.id)} className={`w-full rounded-2xl border p-4 text-right transition ${type === item.id ? "border-violet-300/40 bg-violet-500/10" : "border-white/10 bg-black/10 hover:bg-white/[0.04]"}`}><div className="flex items-center gap-3"><Icon size={22} className="text-cyan-200" /><div><div className="font-semibold">{item.title}</div><div className="mt-1 text-xs text-white/40">{item.description}</div></div></div></button>; })}</div></section>
            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-bold">۲. شخصی‌سازی سریع</h2><div className="mt-4 space-y-4"><label className="block text-sm text-white/60">نام سایت<input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white" /></label><label className="block text-sm text-white/60">عنوان اصلی<textarea rows={3} value={tagline} onChange={(e) => setTagline(e.target.value)} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 leading-7 text-white" /></label><label className="block text-sm text-white/60">لوگو (اختیاری)<input dir="ltr" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white" /></label><label className="block text-sm text-white/60">عکس اصلی / محصول (اختیاری)<input dir="ltr" value={heroImage} onChange={(e) => setHeroImage(e.target.value)} placeholder="https://..." className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white" /></label><button type="button" onClick={generate} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 font-bold hover:bg-violet-500"><Sparkle /> ساخت پیش‌نمایش</button></div>{message && <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-6 text-white/60">{message}</p>}</section>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 md:p-6"><div className="mb-4 flex items-center justify-between"><div><div className="text-xs text-white/35">پیش‌نمایش زنده</div><h2 className="mt-1 text-xl font-bold">{selected.title}</h2></div><div className="flex items-center gap-2 text-xs text-white/40"><CheckCircle className="text-emerald-300" /> Context connected</div></div><div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0b10]">
            <div className="border-b border-white/10 px-5 py-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3">{logoUrl ? <img src={logoUrl} alt="logo" className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20"><Sparkle size={17} /></div>}<strong>{name}</strong></div><div className="hidden gap-4 text-xs text-white/40 sm:flex">{selected.sections.slice(1,4).map((s) => <span key={s}>{s}</span>)}</div></div></div>
            <div className="relative min-h-[280px] overflow-hidden p-8 md:p-12" style={{ background: `radial-gradient(circle at 80% 20%, ${primary}33, transparent 42%)` }}>{heroImage && <img src={heroImage} alt="hero" className="absolute inset-0 h-full w-full object-cover opacity-20" />}<div className="relative max-w-2xl"><div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-cyan-200">{theme}</div><h3 className="mt-5 text-3xl font-black md:text-5xl">{tagline}</h3><p className="mt-4 max-w-xl leading-8 text-white/55">{text(snapshot?.identity?.description, "محتوای این سایت از Business Context و اطلاعات معتبر کسب‌وکار ساخته می‌شود.")}</p><button type="button" className="mt-6 rounded-xl px-5 py-3 font-bold" style={{ backgroundColor: primary }}>شروع گفتگو</button></div></div>
            <div className="grid gap-3 border-t border-white/10 p-5 md:grid-cols-3">{(items.length ? items : selected.sections.slice(1,4)).map((item, index) => <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><ImageSquare size={20} className="text-cyan-200" /><div className="mt-3 font-semibold">{item}</div><div className="mt-1 text-xs leading-5 text-white/35">محتوا بر اساس داده‌های کسب‌وکار</div></div>)}</div>
            {generated && <div className="border-t border-white/10 bg-violet-500/[0.04] p-5"><div className="flex items-center gap-2 font-semibold text-emerald-200"><CheckCircle /> ساختار اولیه آماده است</div><p className="mt-2 text-sm leading-7 text-white/50">مخاطب: {audiences.join("، ") || "از Business Context"} · هدف: {goals[0] || "حضور حرفه‌ای"} · تمایز: {differentiators.join("، ") || "از برند و DNA"}</p></div>}
          </div></section>
        </div>
      </section>
    </main>
  );
}
