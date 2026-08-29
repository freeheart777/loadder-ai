import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  CurrencyDollar,
  Globe,
  Key,
  MagnifyingGlass,
  Plus,
  RocketLaunch,
  Sparkle,
  Target,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";

const API = "/api/google-ads/search-drafts";

type MatchType = "BROAD" | "PHRASE" | "EXACT";
type Keyword = { text: string; matchType: MatchType };
type ValidationIssue = { field: string; message: string };
type DraftResponse = {
  id: string;
  status: string;
  validation?: ValidationIssue[];
  googleResource?: { initialCampaignStatus?: string; operations?: Array<{ entity: string }> };
};

type FormState = {
  name: string;
  dailyBudget: string;
  biddingStrategy: "MAXIMIZE_CLICKS" | "MAXIMIZE_CONVERSIONS";
  adGroupName: string;
  finalUrl: string;
  headlines: string[];
  descriptions: string[];
  keywords: Keyword[];
};

const initialForm: FormState = {
  name: "",
  dailyBudget: "",
  biddingStrategy: "MAXIMIZE_CLICKS",
  adGroupName: "",
  finalUrl: "",
  headlines: ["", "", ""],
  descriptions: ["", ""],
  keywords: [{ text: "", matchType: "PHRASE" }],
};

function toPayload(form: FormState) {
  const numericBudget = Number(String(form.dailyBudget).replaceAll(",", ""));
  return {
    name: form.name.trim(),
    dailyBudgetMicros: Number.isFinite(numericBudget) ? Math.round(numericBudget * 1_000_000) : 0,
    biddingStrategy: form.biddingStrategy,
    adGroupName: form.adGroupName.trim(),
    finalUrl: form.finalUrl.trim(),
    headlines: form.headlines.map((x) => x.trim()).filter(Boolean),
    descriptions: form.descriptions.map((x) => x.trim()).filter(Boolean),
    keywords: form.keywords
      .map((x) => ({ text: x.text.trim(), matchType: x.matchType }))
      .filter((x) => x.text),
  };
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || "ارتباط با سرویس تبلیغات ناموفق بود.");
  return body;
}

export default function GoogleAdsSearchWizardPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(1);

  const steps = [
    { id: 1, title: "کمپین و بودجه", icon: CurrencyDollar },
    { id: 2, title: "صفحه مقصد", icon: Globe },
    { id: 3, title: "کلمات کلیدی", icon: Key },
    { id: 4, title: "متن تبلیغ", icon: Sparkle },
    { id: 5, title: "بررسی نهایی", icon: RocketLaunch },
  ];

  const summary = useMemo(() => ({
    keywords: form.keywords.filter((x) => x.text.trim()).length,
    headlines: form.headlines.filter((x) => x.trim()).length,
    descriptions: form.descriptions.filter((x) => x.trim()).length,
  }), [form]);

  const updateList = (field: "headlines" | "descriptions", index: number, value: string) => {
    setForm((current) => ({ ...current, [field]: current[field].map((item, i) => (i === index ? value : item)) }));
  };

  const createOrUpdateDraft = async () => {
    const payload = toPayload(form);
    const response = await fetch(draft ? `${API}/${draft.id}` : API, {
      method: draft ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await readJson(response);
    const nextDraft: DraftResponse = body.draft;
    setDraft(nextDraft);
    setIssues(nextDraft.validation || []);
    return nextDraft;
  };

  const saveDraft = async (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const saved = await createOrUpdateDraft();
      setMessage(saved.status === "VALID" ? "پیش‌نویس ذخیره شد و از نظر فنی معتبر است." : "پیش‌نویس ذخیره شد؛ چند مورد نیاز به اصلاح دارد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره پیش‌نویس انجام نشد.");
    } finally {
      setBusy(false);
    }
  };

  const prepare = async () => {
    setBusy(true);
    setMessage("");
    try {
      const saved = await createOrUpdateDraft();
      if (saved.status !== "VALID" && saved.status !== "READY_FOR_AUTH") {
        setMessage("قبل از اتصال به گوگل، خطاهای فرم را اصلاح کن.");
        setStep(5);
        return;
      }
      const response = await fetch(`${API}/${saved.id}/prepare`, { method: "POST" });
      const body = await readJson(response);
      setDraft(body.draft);
      setIssues(body.draft?.validation || []);
      setMessage("کمپین آماده اتصال به Google Ads است. هنوز هیچ تبلیغی اجرا یا هزینه‌ای مصرف نشده است.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "آماده‌سازی کمپین انجام نشد.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/ads" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white">
              <ArrowRight size={18} />
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
              <MagnifyingGlass size={25} weight="duotone" className="text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold lg:text-2xl">ساخت کمپین جست‌وجوی گوگل</h1>
              <p className="mt-1 text-xs text-white/45 lg:text-sm">نسخه فارسی و ساده‌شده Google Ads داخل Loadder</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-500/[0.07] px-4 py-2 text-xs text-emerald-200 md:flex">
            <CheckCircle size={15} />
            حالت امن: بدون اجرای تبلیغ
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-6 py-7 lg:px-8">
        <section className="overflow-hidden rounded-[30px] border border-blue-400/15 bg-[#080d1d]/70 p-6 backdrop-blur-xl lg:p-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/15 bg-blue-500/[0.08] px-4 py-2 text-sm text-blue-200">
                <Target size={16} weight="duotone" />
                Search Campaign Builder v1
              </div>
              <h2 className="mt-5 text-2xl font-bold leading-[1.7] lg:text-3xl">فرم را فارسی پر کن؛ لودر آن را به ساختار استاندارد Google Ads تبدیل می‌کند.</h2>
              <p className="mt-3 max-w-3xl leading-8 text-white/50">در این نسخه کمپین به‌صورت Draft ذخیره و اعتبارسنجی می‌شود. مرحله OAuth، انتخاب حساب تبلیغاتی و انتشار واقعی در قدم بعدی فعال خواهد شد.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="کلمه کلیدی" value={String(summary.keywords)} />
              <Stat label="عنوان" value={`${summary.headlines}/3+`} />
              <Stat label="توضیح" value={`${summary.descriptions}/2+`} />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-5">
          {steps.map(({ id, title, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setStep(id)} className={`rounded-2xl border px-4 py-4 text-right transition ${step === id ? "border-blue-400/30 bg-blue-500/[0.12] text-blue-100" : "border-white/[0.07] bg-white/[0.025] text-white/45 hover:bg-white/[0.05]"}`}>
              <div className="flex items-center gap-2"><Icon size={17} /><span className="text-xs">مرحله {id}</span></div>
              <div className="mt-2 text-sm font-semibold">{title}</div>
            </button>
          ))}
        </section>

        <form onSubmit={saveDraft} className="mt-6 grid gap-6 xl:grid-cols-[1fr_350px]">
          <section className="rounded-[28px] border border-white/[0.08] bg-[#080d1d]/66 p-6 lg:p-8">
            {step === 1 && <div className="space-y-5"><SectionTitle title="کمپین و بودجه" subtitle="نام کمپین، بودجه روزانه و استراتژی پیشنهاد قیمت" />
              <Field label="نام کمپین"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="مثلاً فروش تابستانه لودر" /></Field>
              <Field label="بودجه روزانه"><div className="relative"><input inputMode="numeric" value={form.dailyBudget} onChange={(e) => setForm({ ...form, dailyBudget: e.target.value })} className="input pl-20" placeholder="مثلاً 500000" /><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white/35">واحد حساب</span></div></Field>
              <Field label="استراتژی پیشنهاد قیمت"><select value={form.biddingStrategy} onChange={(e) => setForm({ ...form, biddingStrategy: e.target.value as FormState["biddingStrategy"] })} className="input"><option value="MAXIMIZE_CLICKS">بیشترین کلیک</option><option value="MAXIMIZE_CONVERSIONS">بیشترین تبدیل</option></select></Field>
            </div>}

            {step === 2 && <div className="space-y-5"><SectionTitle title="صفحه مقصد" subtitle="جایی که کاربر بعد از کلیک روی تبلیغ وارد می‌شود" />
              <Field label="نام گروه تبلیغ"><input value={form.adGroupName} onChange={(e) => setForm({ ...form, adGroupName: e.target.value })} className="input" placeholder="مثلاً سایت ساز" /></Field>
              <Field label="آدرس صفحه مقصد"><input dir="ltr" value={form.finalUrl} onChange={(e) => setForm({ ...form, finalUrl: e.target.value })} className="input text-left" placeholder="https://example.com/landing" /></Field>
              <Info>برای انتشار واقعی، Google Ads صفحه مقصد را نیز از نظر سیاست‌های تبلیغاتی خودش بررسی می‌کند.</Info>
            </div>}

            {step === 3 && <div className="space-y-5"><SectionTitle title="کلمات کلیدی" subtitle="عبارت‌هایی که می‌خواهی تبلیغت با جست‌وجوی آن‌ها نمایش داده شود" />
              {form.keywords.map((keyword, index) => <div key={index} className="grid gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4 md:grid-cols-[1fr_180px_44px]"><input value={keyword.text} onChange={(e) => setForm({ ...form, keywords: form.keywords.map((x, i) => i === index ? { ...x, text: e.target.value } : x) })} className="input" placeholder="مثلاً سایت ساز" /><select value={keyword.matchType} onChange={(e) => setForm({ ...form, keywords: form.keywords.map((x, i) => i === index ? { ...x, matchType: e.target.value as MatchType } : x) })} className="input"><option value="BROAD">گسترده</option><option value="PHRASE">عبارتی</option><option value="EXACT">دقیق</option></select><button type="button" onClick={() => setForm({ ...form, keywords: form.keywords.filter((_, i) => i !== index) })} className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400/15 bg-rose-500/[0.06] text-rose-300"><Trash size={17} /></button></div>)}
              <button type="button" onClick={() => setForm({ ...form, keywords: [...form.keywords, { text: "", matchType: "PHRASE" }] })} className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/[0.08] px-4 py-3 text-sm text-blue-200"><Plus size={16} /> افزودن کلمه کلیدی</button>
            </div>}

            {step === 4 && <div className="space-y-7"><SectionTitle title="متن تبلیغ" subtitle="Responsive Search Ad؛ حداقل ۳ عنوان و ۲ توضیح" />
              <div><div className="mb-3 text-sm font-semibold">عنوان‌ها</div><div className="space-y-3">{form.headlines.map((value, index) => <input key={index} value={value} onChange={(e) => updateList("headlines", index, e.target.value)} className="input" placeholder={`عنوان ${index + 1}`} />)}</div><button type="button" onClick={() => setForm({ ...form, headlines: [...form.headlines, ""] })} className="mt-3 text-sm text-blue-300">+ عنوان بیشتر</button></div>
              <div><div className="mb-3 text-sm font-semibold">توضیحات</div><div className="space-y-3">{form.descriptions.map((value, index) => <textarea key={index} value={value} onChange={(e) => updateList("descriptions", index, e.target.value)} className="input min-h-24 resize-none" placeholder={`توضیح ${index + 1}`} />)}</div><button type="button" onClick={() => setForm({ ...form, descriptions: [...form.descriptions, ""] })} className="mt-3 text-sm text-blue-300">+ توضیح بیشتر</button></div>
            </div>}

            {step === 5 && <div className="space-y-6"><SectionTitle title="بررسی نهایی" subtitle="قبل از اتصال به Google Ads، ساختار کمپین را بررسی کن" />
              <Review label="نام کمپین" value={form.name || "—"} /><Review label="بودجه روزانه" value={form.dailyBudget || "—"} /><Review label="استراتژی" value={form.biddingStrategy === "MAXIMIZE_CLICKS" ? "بیشترین کلیک" : "بیشترین تبدیل"} /><Review label="صفحه مقصد" value={form.finalUrl || "—"} /><Review label="کلمات کلیدی" value={`${summary.keywords} مورد`} /><Review label="متن تبلیغ" value={`${summary.headlines} عنوان · ${summary.descriptions} توضیح`} />
              {issues.length > 0 && <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4"><div className="flex items-center gap-2 font-semibold text-amber-200"><WarningCircle size={18} /> موارد نیازمند اصلاح</div><ul className="mt-3 space-y-2 text-sm text-amber-100/70">{issues.map((issue, index) => <li key={`${issue.field}-${index}`}>• {issue.message}</li>)}</ul></div>}
            </div>}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
              <button type="submit" disabled={busy} className="rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold disabled:opacity-50">ذخیره پیش‌نویس</button>
              <div className="flex gap-2">{step > 1 && <button type="button" onClick={() => setStep(step - 1)} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/60">قبلی</button>}{step < 5 ? <button type="button" onClick={() => setStep(step + 1)} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold">ادامه</button> : <button type="button" onClick={prepare} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-violet-600 px-6 py-3 text-sm font-semibold disabled:opacity-50"><RocketLaunch size={17} /> آماده اتصال به گوگل</button>}</div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[26px] border border-white/[0.08] bg-[#080d1d]/66 p-5"><div className="text-sm font-semibold">وضعیت کمپین</div><div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/20 p-4"><div className="text-xs text-white/35">وضعیت Draft</div><div className="mt-2 font-semibold text-blue-200">{draft?.status || "هنوز ذخیره نشده"}</div></div>{draft?.googleResource?.initialCampaignStatus && <div className="mt-3 text-xs leading-6 text-white/45">کمپین در Google Ads ابتدا با وضعیت <span className="text-amber-300">PAUSED</span> آماده می‌شود تا بدون تأیید صریح اجرا نشود.</div>}</div>
            <div className="rounded-[26px] border border-emerald-400/15 bg-emerald-500/[0.05] p-5"><div className="flex items-center gap-2 font-semibold text-emerald-200"><CheckCircle size={18} /> کنترل هزینه</div><p className="mt-3 text-sm leading-7 text-white/45">این صفحه فقط Draft می‌سازد. تا OAuth، انتخاب حساب و تأیید انتشار تکمیل نشود، هیچ عملیات هزینه‌زایی اجرا نمی‌شود.</p></div>
            {message && <div className="rounded-[22px] border border-blue-400/15 bg-blue-500/[0.06] p-4 text-sm leading-7 text-blue-100">{message}</div>}
          </aside>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm text-white/65">{label}</span>{children}</label>; }
function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div><h3 className="text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-7 text-white/40">{subtitle}</p></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="flex min-h-24 flex-col justify-center rounded-2xl border border-white/[0.07] bg-black/20 p-4"><div className="text-xl font-bold text-blue-200">{value}</div><div className="mt-1 text-xs text-white/35">{label}</div></div>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4"><span className="text-sm text-white/40">{label}</span><span className="max-w-[70%] break-words text-left text-sm font-semibold">{value}</span></div>; }
function Info({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.05] p-4 text-sm leading-7 text-cyan-100/70">{children}</div>; }
