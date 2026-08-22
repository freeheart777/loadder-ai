import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, FloppyDisk } from "@phosphor-icons/react";
import ContractContentEditor from "../components/content/ContractContentEditor";
import { apiFetch } from "../lib/api";

const contracts = [
  { id: "social_post", title: "پست اینستاگرام", placementId: "instagram.feed.text", content: { hook: "", body: "", cta: "", hashtags: [""] } },
  { id: "ad_copy", title: "متن تبلیغاتی", placementId: "google_ads.search.text", content: { headlines: [""], descriptions: [""], ctaLabel: "" } },
  { id: "marketing_email", title: "ایمیل بازاریابی", placementId: "email.marketing.text", content: { subject: "", previewText: "", greeting: "", bodySections: [""], cta: "", signoff: "" } },
  { id: "blog_outline", title: "طرح مقاله", placementId: "blog.article.text", content: { title: "", seoTitle: "", metaDescription: "", primaryKeyword: "", slug: "", sections: [{ heading: "", keyPoints: [""] }] } },
  { id: "landing_page_copy", title: "متن صفحه فرود", placementId: "website.landing.text", content: { hero: { headline: "", subheadline: "", cta: "" }, benefits: [""], sections: [{ heading: "", body: "" }], proofPoints: [], faq: [], finalCta: "" } },
] as const;

export default function ManualContentPage() {
  const navigate = useNavigate();
  const [contractId, setContractId] = useState<string>(contracts[0].id), [title, setTitle] = useState(""), [content, setContent] = useState<Record<string, unknown>>({ ...contracts[0].content }), [error, setError] = useState("");
  const selected = useMemo(() => contracts.find((entry) => entry.id === contractId) || contracts[0], [contractId]);
  const choose = (id: string) => { const entry = contracts.find((item) => item.id === id) || contracts[0]; setContractId(entry.id); setContent(structuredClone(entry.content) as Record<string, unknown>); setError(""); };
  async function save() {
    if (!title.trim()) { setError("عنوان لازم است."); return; }
    const response = await apiFetch("/api/content/items/manual", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ contractId: selected.id, contractVersion: 1, placementId: selected.placementId, placementVersion: 1, title, content }) });
    const data = await response.json(); if (!response.ok) { setError("محتوا با ساختار انتخاب‌شده سازگار نیست."); return; } navigate(`/dashboard/library/${data.item.id}`);
  }
  return <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white"><header className="border-b border-white/10"><div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-5"><Link to="/dashboard/library" className="rounded-full border border-white/10 p-3"><ArrowRight size={18}/></Link><div><h1 className="text-xl font-bold">ساخت متن دستی</h1><p className="text-sm text-white/40">بدون استفاده از هوش مصنوعی</p></div></div></header><section className="mx-auto max-w-5xl px-6 py-8"><label className="text-sm text-white/50">نوع محتوا و جایگاه</label><div className="mt-3 flex flex-wrap gap-2">{contracts.map((entry) => <button key={entry.id} onClick={() => choose(entry.id)} className={`rounded-xl px-4 py-2 text-sm ${entry.id === selected.id ? "bg-violet-600" : "border border-white/10 bg-white/5"}`}>{entry.title}</button>)}</div><p dir="ltr" className="mt-2 text-xs text-white/35">{selected.placementId}</p><label className="mt-6 block text-sm text-white/50">عنوان</label><input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3"/><div className="mt-6 rounded-3xl border border-white/10 bg-[#080d1d]/75 p-6"><ContractContentEditor value={content} onChange={setContent}/></div>{error && <p className="mt-4 text-red-300">{error}</p>}<button onClick={save} className="mt-6 flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3"><FloppyDisk/>ذخیره متن دستی</button><p className="mt-4 text-xs text-white/35">این عمل هیچ AI، انتشار یا اجرایی را فراخوانی نمی‌کند.</p></section></main>;
}
