import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  Compass,
  FileText,
  Globe,
  InstagramLogo,
  Megaphone,
  Sparkle,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";

import {
  DIAGNOSIS_AREAS,
  DIAGNOSIS_STATE_OPTIONS,
  EMPTY_DIAGNOSIS_ANSWERS,
  diagnosisComplete,
  recommendDiagnosisNextSteps,
  type DiagnosisAnswers,
  type DiagnosisAreaId,
  type DiagnosisAreaState,
  type DiagnosisGoal,
} from "../lib/businessDiagnosis";

const icons = {
  website: Globe,
  social: InstagramLogo,
  content: FileText,
  ads: Megaphone,
  crm: UsersThree,
} satisfies Record<DiagnosisAreaId, React.ElementType>;

const goals: Array<{ value: DiagnosisGoal; title: string }> = [
  { value: "UNSURE", title: "هنوز مطمئن نیستم" },
  { value: "PRESENCE", title: "حضور دیجیتال حرفه‌ای‌تر" },
  { value: "LEADS", title: "لید و درخواست بیشتر" },
  { value: "CONTENT", title: "محتوای منظم و مؤثر" },
  { value: "SALES", title: "فروش بیشتر" },
];

export default function BusinessDiagnosisPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<DiagnosisAnswers>({ ...EMPTY_DIAGNOSIS_ANSWERS });
  const [goal, setGoal] = useState<DiagnosisGoal>("UNSURE");
  const [reviewed, setReviewed] = useState(false);

  const complete = diagnosisComplete(answers);
  const recommendations = useMemo(
    () => reviewed ? recommendDiagnosisNextSteps(answers, goal) : [],
    [answers, goal, reviewed],
  );

  const setArea = (id: DiagnosisAreaId, value: DiagnosisAreaState) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setReviewed(false);
  };

  return (
    <main dir="rtl" className="loadder-dashboard-bg min-h-screen px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-start gap-4">
          <Link
            to="/dashboard/intent"
            aria-label="بازگشت به انتخاب مسیر"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"
          >
            <ArrowRight size={19} />
          </Link>
          <div>
            <p className="text-sm text-cyan-300">ارزیابی وضعیت فعلی</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">اول بفهمیم امروز کسب‌وکارت کجاست</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/50">
              این مرحله فقط از پاسخ‌های خودت استفاده می‌کند. هیچ داده‌ای حدس زده نمی‌شود و هیچ پیشنهاد AI یا اجرای خودکاری در پس‌زمینه انجام نمی‌شود.
            </p>
          </div>
        </header>

        <section className="mt-8 rounded-[30px] border border-cyan-400/15 bg-cyan-500/[0.04] p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <Compass size={24} className="mt-1 text-cyan-300" />
            <div>
              <h2 className="text-xl font-bold">هدف اصلی الان چیست؟</h2>
              <p className="mt-1 text-sm leading-7 text-white/45">این پاسخ فقط برای مرتب‌کردن پیشنهادهای بعدی استفاده می‌شود.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {goals.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => { setGoal(item.value); setReviewed(false); }}
                className={`min-h-12 rounded-2xl border px-4 py-3 text-sm transition ${goal === item.value ? "border-cyan-300/35 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-white/65"}`}
              >
                {item.title}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[30px] border border-white/10 bg-[#080d1d]/70 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <Sparkle size={24} className="mt-1 text-violet-300" />
            <div>
              <h2 className="text-xl font-bold">وضعیت واقعی کانال‌ها و زیرساخت‌ها</h2>
              <p className="mt-1 text-sm leading-7 text-white/45">برای هر مورد همان چیزی را انتخاب کن که امروز واقعاً می‌دانی؛ «مطمئن نیستم» هم یک پاسخ معتبر است.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {DIAGNOSIS_AREAS.map((area) => {
              const Icon = icons[area.id];
              const selected = answers[area.id];
              return (
                <article key={area.id} className="rounded-2xl border border-white/[0.08] bg-black/15 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-violet-200"><Icon size={21}/></div>
                    <div><h3 className="font-bold">{area.title}</h3><p className="mt-1 text-xs leading-6 text-white/40">{area.description}</p></div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {DIAGNOSIS_STATE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setArea(area.id, option.value)}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-right text-xs leading-5 transition ${selected === option.value ? "border-violet-300/35 bg-violet-500/15 text-violet-100" : "border-white/[0.08] bg-white/[0.025] text-white/55"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          {!complete && (
            <div className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-300/15 bg-amber-500/[0.05] p-4 text-sm leading-7 text-amber-100/75">
              <WarningCircle size={19} className="mt-1 shrink-0" />
              برای اینکه نتیجه نشان داده شود، برای هر پنج بخش یک پاسخ انتخاب کن. اگر اطلاعات دقیق نداری، «مطمئن نیستم» را انتخاب کن.
            </div>
          )}

          <button
            type="button"
            disabled={!complete}
            onClick={() => setReviewed(true)}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-35"
          >
            <CheckCircle size={20} weight="fill" />
            بررسی پاسخ‌های من
          </button>
        </section>

        {reviewed && (
          <section className="mt-6 rounded-[30px] border border-emerald-400/15 bg-emerald-500/[0.035] p-5 sm:p-7">
            <div>
              <p className="text-sm text-emerald-300">نتیجه بر اساس پاسخ‌های ثبت‌شده</p>
              <h2 className="mt-1 text-2xl font-black">مرحله بعد پیشنهادی</h2>
              <p className="mt-2 text-sm leading-7 text-white/45">این نتیجه تحلیل خودکار نیست؛ صرفاً تطبیق شفاف پاسخ‌های تو با سرویس‌های فعلی لودر است.</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {recommendations.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">{item.title}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] ${item.priority === "HIGH" ? "bg-rose-500/10 text-rose-200" : item.priority === "MEDIUM" ? "bg-amber-500/10 text-amber-200" : "bg-white/[0.06] text-white/45"}`}>
                      {item.priority === "HIGH" ? "اولویت بالا" : item.priority === "MEDIUM" ? "اولویت متوسط" : "اطلاعات"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/50">{item.reason}</p>
                  {item.destination && item.actionLabel && (
                    <button
                      type="button"
                      onClick={() => navigate(item.destination!)}
                      className="mt-4 min-h-11 rounded-xl border border-emerald-300/20 bg-emerald-500/[0.08] px-4 py-2 text-sm text-emerald-100"
                    >
                      {item.actionLabel}
                    </button>
                  )}
                </article>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setReviewed(false)} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65">اصلاح پاسخ‌ها</button>
              <Link to="/dashboard/intent" className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65">بازگشت به انتخاب مسیر</Link>
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-xs leading-6 text-white/30">
          این ارزیابی V1 در همین صفحه انجام می‌شود و چیزی را منتشر، اجرا یا به سرویس خارجی ارسال نمی‌کند.
        </p>
      </div>
    </main>
  );
}
