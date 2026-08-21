import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Copy, FileText, InstagramLogo, MagicWand, Megaphone, Sparkle } from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";
import { withDemo } from "../lib/demoMode";

type Template = { id: string; title: string; description: string; channel: string; placement: string; icon: React.ElementType; requiresCta?: boolean };
type Generation = { generationId: string; status: "SUCCEEDED"; contractId: string; variants: Array<Record<string, unknown>> };

const templates: Template[] = [
  { id: "social_post", title: "پست اینستاگرام", description: "کپشن، هوک، CTA و هشتگ", channel: "اینستاگرام", placement: "instagram.feed.text", icon: InstagramLogo },
  { id: "ad_copy", title: "متن تبلیغاتی", description: "تیتر و توضیح تبلیغ جستجو", channel: "Google Ads", placement: "google_ads.search.text", icon: Megaphone, requiresCta: true },
  { id: "marketing_email", title: "ایمیل بازاریابی", description: "موضوع، بدنه و دعوت به اقدام", channel: "ایمیل", placement: "email.marketing.text", icon: FileText },
  { id: "blog_outline", title: "طرح مقاله و سئو", description: "ساختار مقاله و نکات کلیدی", channel: "بلاگ", placement: "blog.article.text", icon: FileText },
  { id: "landing_page_copy", title: "متن صفحه فرود", description: "Hero، مزایا، بخش‌ها و CTA", channel: "وب‌سایت", placement: "website.landing.text", icon: MagicWand, requiresCta: true },
];

function variantText(contractId: string, value: Record<string, unknown>) {
  if (contractId === "social_post") return [value.hook, value.body, value.cta, ...(value.hashtags as string[] || [])].filter(Boolean).join("\n\n");
  if (contractId === "ad_copy") return [`تیترها:\n${(value.headlines as string[]).join("\n")}`, `توضیحات:\n${(value.descriptions as string[]).join("\n")}`, `CTA: ${value.ctaLabel}`].join("\n\n");
  if (contractId === "marketing_email") return [`موضوع: ${value.subject}`, `پیش‌نمایش: ${value.previewText}`, value.greeting, ...((value.bodySections as string[]) || []), value.cta, value.signoff].filter(Boolean).join("\n\n");
  return JSON.stringify(value, null, 2);
}

export default function ContentStudioPage() {
  const [searchParams] = useSearchParams();
  const initial = searchParams.get("template") === "instagram" ? "social_post" : templates[0].id;
  const [templateId, setTemplateId] = useState(initial);
  const [goal, setGoal] = useState("افزایش تعامل");
  const [offering, setOffering] = useState("");
  const [audience, setAudience] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [cta, setCta] = useState("");
  const [tone, setTone] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = useMemo(() => templates.find((item) => item.id === templateId) || templates[0], [templateId]);
  const currentText = generation?.variants[selectedVariant] ? variantText(generation.contractId, generation.variants[selectedVariant]) : "";

  async function generate(forceNew = false) {
    if (!offering.trim() || !keyMessage.trim() || (selected.requiresCta && !cta.trim())) { setError("پیشنهاد، پیام کلیدی و CTA لازم را کامل کن."); return; }
    const key = forceNew || !requestKey ? crypto.randomUUID() : requestKey;
    setRequestKey(key); setLoading(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/content/generate", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ contractId: selected.id, contractVersion: 1, placementId: selected.placement, placementVersion: 1, brief: { goal, offering, audienceRefinement: audience || undefined, keyMessage, cta: cta || undefined, language: "fa-IR", toneOverride: tone || undefined, constraints: [], referenceText: referenceText || undefined }, variantCount: 3 }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.code || "CONTENT_GENERATION_FAILED");
      setGeneration(data.generation); setSelectedVariant(0); setNotice(data.reusedResult ? "نتیجه امن قبلی بازیابی شد." : "سه نسخه جدید آماده است.");
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "CONTENT_GENERATION_FAILED";
      const messages: Record<string, string> = { CONTENT_CONTEXT_MISSING: "ابتدا راه‌اندازی کسب‌وکار را کامل کن.", CONTENT_CONTEXT_STALE: "اطلاعات کسب‌وکار تغییر کرده است؛ Business Context را به‌روزرسانی کن.", CONTENT_PROVIDER_UNAVAILABLE: "موتور تولید متن فعلاً در دسترس نیست.", CONTENT_RATE_LIMITED: "درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کن." };
      setError(messages[code] || "تولید محتوا انجام نشد. دوباره تلاش کن.");
    } finally { setLoading(false); }
  }

  return <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/80 backdrop-blur-2xl"><div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 py-5"><Link to={withDemo("/dashboard")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5"><ArrowRight size={18}/></Link><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-fuchsia-300"><Sparkle size={25} weight="fill"/></div><div><h1 className="text-2xl font-bold">استودیوی خلاقیت برند</h1><p className="mt-1 text-sm text-white/45">تولید متن کنترل‌شده بر اساس Business Context فعال برند</p></div></div></header>
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <section className="rounded-[32px] border border-violet-400/15 bg-[#080d1d]/70 p-7"><div className="flex items-center gap-3"><MagicWand size={24} className="text-violet-300"/><div><h2 className="text-xl font-semibold">۱. قالب و جایگاه را انتخاب کن</h2><p className="mt-1 text-sm text-white/40">هر قالب به یک کانال و جایگاه متنی معتبر متصل است.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{templates.map((item) => <button key={item.id} type="button" onClick={() => { setTemplateId(item.id); setGeneration(null); setRequestKey(null); }} className={`rounded-2xl border p-4 text-right transition ${item.id === templateId ? "border-violet-400/40 bg-violet-500/15" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}><item.icon size={22} className="text-cyan-300"/><div className="mt-3 font-semibold">{item.title}</div><div className="mt-1 text-xs leading-6 text-white/40">{item.description}</div><div className="mt-3 text-[11px] text-violet-300">{item.channel}</div></button>)}</div></section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <div className="rounded-[30px] border border-white/10 bg-[#080d1d]/70 p-7"><h2 className="text-xl font-semibold">۲. بریف محتوا</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="هدف" value={goal} onChange={setGoal} maxLength={300}/><Field label="پیشنهاد / محصول / خدمت *" value={offering} onChange={setOffering} maxLength={500}/><Field label="مخاطب دقیق‌تر" value={audience} onChange={setAudience} maxLength={500}/><Field label="پیام کلیدی *" value={keyMessage} onChange={setKeyMessage} maxLength={500}/><Field label={`دعوت به اقدام${selected.requiresCta ? " *" : ""}`} value={cta} onChange={setCta} maxLength={160}/><Field label="لحن تکمیلی" value={tone} onChange={setTone} maxLength={200}/></div><div className="mt-4"><label className="mb-2 block text-sm text-white/55">متن مرجع اختیاری</label><textarea value={referenceText} onChange={(event) => setReferenceText(event.target.value)} maxLength={2000} rows={4} className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 outline-none focus:border-violet-400/40"/></div>{error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}<button type="button" disabled={loading} onClick={() => generate(false)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-fuchsia-500 px-6 py-4 font-semibold disabled:opacity-50"><Sparkle size={18} weight="fill"/>{loading ? "در حال تولید متن…" : "تولید ۳ نسخه"}</button><p className="mt-3 text-xs leading-6 text-white/35">این بخش فقط محتوا تولید می‌کند؛ هیچ پیام، تبلیغ یا کمپینی منتشر یا اجرا نمی‌شود.</p></div>
        <aside className="rounded-[30px] border border-violet-400/15 bg-[#080d1d]/70 p-7"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">۳. نسخه‌های تولیدشده</h2><p className="mt-1 text-sm text-white/40">یک نسخه را انتخاب و کپی کن.</p></div><button type="button" disabled={!currentText} onClick={async () => { await navigator.clipboard.writeText(currentText); setNotice("نسخه انتخاب‌شده کپی شد."); }} className="rounded-xl border border-white/10 bg-white/5 p-3 disabled:opacity-30"><Copy size={18}/></button></div>{generation ? <><div className="mt-5 flex gap-2">{generation.variants.map((_, index) => <button key={index} type="button" onClick={() => setSelectedVariant(index)} className={`rounded-xl px-4 py-2 text-sm ${index === selectedVariant ? "bg-violet-500 text-white" : "bg-white/5 text-white/50"}`}>نسخه {index + 1}</button>)}</div><pre dir="rtl" className="mt-4 min-h-[300px] whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-5 font-sans text-sm leading-8 text-white/75">{currentText}</pre><button type="button" disabled={loading} onClick={() => generate(true)} className="mt-4 w-full rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-sm">تولید نسخه‌های تازه</button></> : <div className="mt-5 flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-sm leading-8 text-white/35">پس از تکمیل بریف، خروجی ساختاریافته و برندمحور اینجا نمایش داده می‌شود.</div>}{notice && <div className="mt-4 text-sm text-cyan-300">{notice}</div>}</aside>
      </section>
    </div>
  </main>;
}

function Field({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return <div><label className="mb-2 block text-sm text-white/55">{label}</label><input value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-violet-400/40"/></div>;
}
