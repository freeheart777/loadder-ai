import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle, Cube, Database, Lightning, Sparkle, SquaresFour } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Preview = {
  buildId: string;
  definition: { id: string; name: string; vertical: string; entities: Array<{ id: string; name: string }>; workflows: Array<{ id: string; name: string }> };
  ui: { direction: "rtl" | "ltr"; navigation: Array<{ id: string; label: string; route: string }>; views: Array<{ id: string; type: string; title: string; route: string; blocks: Array<{ type: string }> }> };
  sourceBundle: { metrics: { fileCount: number; byteSize: number }; portable: boolean };
  gates: Array<{ id: string; status: string }>;
  productionDeploymentAllowed: boolean;
};

const examples = [
  "برای شرکت پخش مواد غذایی یک CRM فروش، مدیریت انبار، سفارش و گزارش مدیریتی بساز.",
  "برای کلینیک من سیستم رزرو، مشتریان، پرونده خدمات و داشبورد مدیریت بساز.",
  "برای آژانس تبلیغاتی CRM مشتری، پروژه، کمپین، تایید محتوا و گزارش بساز.",
];

export default function BusinessBuilderPage() {
  const [intent, setIntent] = useState(examples[0]);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passedGates = useMemo(() => preview?.gates.filter((gate) => gate.status === "passed").length || 0, [preview]);

  async function buildPreview() {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/business-builder/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, name: name || undefined, locale: "fa-IR" }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "ساخت پیش‌نمایش ناموفق بود.");
      setPreview(body.preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ساخت پیش‌نمایش ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#08090b] text-white">
      <div className="mx-auto max-w-[1500px] px-5 py-6 lg:px-10">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-white/45"><Sparkle size={14} /> LOADDER BUSINESS BUILDER / ALPHA</div>
            <h1 className="text-2xl font-semibold tracking-tight lg:text-4xl">کسب‌وکارت را توضیح بده؛ لودر سیستمش را معماری می‌کند.</h1>
          </div>
          <Link to="/dashboard" className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"><ArrowLeft size={16} /> بازگشت</Link>
        </header>

        <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <label className="mb-2 block text-sm text-white/65">نام اپلیکیشن — اختیاری</label>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثلاً مرکز عملیات فروش" className="mb-5 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-white/25" />
            <label className="mb-2 block text-sm text-white/65">کسب‌وکارت و چیزی که لازم داری</label>
            <textarea value={intent} onChange={(event) => setIntent(event.target.value)} rows={9} className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 leading-7 outline-none focus:border-white/25" />
            <div className="mt-4 space-y-2">
              {examples.map((example, index) => <button key={example} onClick={() => setIntent(example)} className="w-full rounded-xl border border-white/10 px-3 py-2 text-right text-xs leading-5 text-white/55 hover:bg-white/5">نمونه {index + 1}: {example}</button>)}
            </div>
            <button disabled={loading || !intent.trim()} onClick={buildPreview} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:opacity-40"><Lightning size={18} weight="fill" />{loading ? "در حال معماری..." : "ساخت پیش‌نمایش"}</button>
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          </aside>

          <div className="min-h-[680px] rounded-3xl border border-white/10 bg-[#0d0f12] p-5 lg:p-7">
            {!preview ? (
              <div className="flex h-full min-h-[600px] flex-col items-center justify-center text-center text-white/35"><Cube size={52} /><p className="mt-4 max-w-md leading-7">لودر ابتدا مدل کسب‌وکار، داده‌ها، صفحات، نقش‌ها و Workflow را می‌سازد؛ بعد از تایید، وارد Runtime و Preview اجرایی می‌شود.</p></div>
            ) : (
              <div dir={preview.ui.direction}>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div><p className="text-xs text-white/35">{preview.definition.vertical} · {preview.buildId}</p><h2 className="mt-1 text-3xl font-semibold">{preview.definition.name}</h2></div>
                  <div className="flex gap-2"><span className="rounded-full border border-white/10 px-3 py-1 text-xs">{preview.definition.entities.length} موجودیت</span><span className="rounded-full border border-white/10 px-3 py-1 text-xs">{passedGates} Gate پاس‌شده</span></div>
                </div>

                <div className="mb-5 grid gap-3 md:grid-cols-4">
                  {[{ icon: Database, label: "مدل داده", value: preview.definition.entities.length }, { icon: SquaresFour, label: "صفحات", value: preview.ui.views.length }, { icon: Lightning, label: "Workflow", value: preview.definition.workflows.length }, { icon: Cube, label: "Bundle", value: `${preview.sourceBundle.metrics.fileCount} فایل` }].map(({ icon: Icon, label, value }) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><Icon size={20} className="mb-5 text-white/50" /><div className="text-2xl font-semibold">{value}</div><div className="mt-1 text-xs text-white/40">{label}</div></div>)}
                </div>

                <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                  <nav className="rounded-2xl border border-white/10 p-3"><p className="px-2 py-2 text-xs text-white/35">Navigation</p>{preview.ui.navigation.slice(0, 12).map((item) => <div key={item.id} className="rounded-lg px-3 py-2 text-sm text-white/65 first:bg-white/8">{item.label}</div>)}</nav>
                  <div className="rounded-2xl border border-white/10 p-5">
                    <div className="mb-5 flex items-center justify-between"><div><p className="text-xs text-white/35">Generated dashboard</p><h3 className="mt-1 text-xl font-medium">داشبورد مدیریتی</h3></div><Sparkle size={22} /></div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{preview.definition.entities.slice(0, 4).map((entity) => <div key={entity.id} className="rounded-xl bg-white/[0.045] p-4"><p className="text-xs text-white/40">{entity.name}</p><p className="mt-4 text-2xl font-semibold">—</p><p className="mt-1 text-[11px] text-white/25">پس از اتصال داده</p></div>)}</div>
                    <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-sm leading-7 text-white/40">این Preview از قرارداد <code>loadder.ui.v1</code> ساخته شده است؛ هنوز Production Deploy عمداً غیرفعال است.</div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">{preview.gates.map((gate) => <span key={gate.id} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50"><CheckCircle size={13} />{gate.id}: {gate.status}</span>)}</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
