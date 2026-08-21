import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  BookOpenText,
  Buildings,
  UsersThree,
  Target,
  ChatCircleText,
  Palette,
  Trophy,
  Sparkle,
  Check,
} from "@phosphor-icons/react";

const steps = [
  {
    title: "اطلاعات کسب‌وکار",
    icon: Buildings,
    fields: [
      ["brandName", "نام برند", "مثلاً Loadder", false],
      ["industry", "حوزه فعالیت", "مثلاً فناوری، لجستیک یا فروشگاه اینترنتی", false],
      ["description", "معرفی کسب‌وکار", "چه محصول یا خدماتی ارائه می‌کنی؟", true],
    ],
  },
  {
    title: "مخاطب هدف",
    icon: UsersThree,
    fields: [
      ["audience", "مخاطب اصلی برند", "مشتریان اصلی شما چه کسانی هستند؟", true],
      ["audienceProblem", "نیاز اصلی مخاطب", "چه مسئله‌ای را برای مشتری حل می‌کنی؟", true],
    ],
  },
  {
    title: "جایگاه برند",
    icon: Target,
    fields: [
      ["valueProposition", "ارزش اصلی برند", "چه ارزش مهمی برای مشتری ایجاد می‌کنی؟", true],
      ["differentiation", "مزیت متفاوت", "چرا مشتری باید شما را انتخاب کند؟", true],
    ],
  },
  {
    title: "شخصیت و لحن",
    icon: ChatCircleText,
    fields: [
      ["personality", "شخصیت برند", "مثلاً جسور، حرفه‌ای، صمیمی یا خلاق", true],
      ["tone", "لحن برند", "مثلاً حرفه‌ای اما صمیمی", false],
    ],
  },
  {
    title: "هویت بصری",
    icon: Palette,
    fields: [
      ["visualStyle", "سبک بصری", "مثلاً مینیمال، تکنولوژیک یا لوکس", true],
      ["colors", "رنگ‌های برند", "مثلاً بنفش، آبی، مشکی", false],
    ],
  },
  {
    title: "رقبا",
    icon: Trophy,
    fields: [
      ["competitors", "رقبای اصلی", "رقبای مهم برند را معرفی کن", true],
      ["competitorDifference", "تفاوت مطلوب با رقبا", "دوست داری نسبت به رقبا چگونه دیده شوی؟", true],
    ],
  },
] as const;

type FormData = {
  [key: string]: string;
};

export default function BrandBookPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);

  const [form, setForm] = useState<FormData>({
    brandName: "",
    industry: "",
    description: "",
    audience: "",
    audienceProblem: "",
    valueProposition: "",
    differentiation: "",
    personality: "",
    tone: "",
    visualStyle: "",
    colors: "",
    competitors: "",
    competitorDifference: "",
  });

  const current = steps[step];
  const CurrentIcon = current.icon;

  const update = (name: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (finished) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-white"
      >
        <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/[0.04] p-10 text-center backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Check size={28} weight="bold" />
          </div>

          <h1 className="mt-6 text-3xl font-semibold">
            اطلاعات برند آماده شد
          </h1>

          <p className="mt-4 text-sm leading-7 text-white/40">
            اطلاعات پایه برند ثبت شد. در مرحله بعد این داده‌ها را به
            موتور هوش مصنوعی Loadder متصل می‌کنیم تا Brand Book واقعی
            ساخته شود.
          </p>

          <div className="mt-8 flex justify-center gap-3">
            <button
              onClick={() => setFinished(false)}
              className="rounded-full border border-white/10 px-5 py-3 text-xs text-white/60"
            >
              ویرایش
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-full border border-violet-300/20 bg-violet-500/15 px-6 py-3 text-xs"
            >
              بازگشت به داشبورد
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#050507] text-white"
    >
      {/* HEADER */}
      <header className="border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]"
            >
              <ArrowRight size={17} />
            </button>

            <BookOpenText
              size={21}
              weight="duotone"
              className="text-cyan-300"
            />

            <div>
              <h1 className="text-sm font-semibold">
                ساخت برند بوک
              </h1>

              <p className="mt-1 text-[10px] text-white/30">
                متخصص هوش مصنوعی برند
              </p>
            </div>
          </div>

          <span dir="ltr" className="font-semibold">
            Loadder AI
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* INTRO */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/15 bg-violet-500/[0.08] px-3 py-1.5">
            <Sparkle
              size={12}
              weight="fill"
              className="text-violet-300"
            />

            <span className="text-[10px] text-violet-200/70">
              برند هوشمند
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-semibold">
            برندت را به Loadder معرفی کن.
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">
            اطلاعاتی که اینجا وارد می‌کنی بعداً توسط سایت‌ساز، تولید
            محتوا، تبلیغات و سایر متخصص‌های هوش مصنوعی استفاده می‌شود.
          </p>
        </div>

        {/* STEPS */}
        <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {steps.map((item, index) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                onClick={() => setStep(index)}
                className={`rounded-2xl border p-4 transition ${
                  index === step
                    ? "border-violet-300/35 bg-violet-500/15"
                    : index < step
                      ? "border-emerald-400/15 bg-emerald-400/[0.05]"
                      : "border-white/[0.07] bg-white/[0.025]"
                }`}
              >
                <Icon
                  size={19}
                  weight="duotone"
                  className="mx-auto"
                />

                <span className="mt-2 block text-[10px] text-white/60">
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* MAIN */}
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* FORM */}
          <section className="rounded-[30px] border border-white/[0.08] bg-white/[0.03] p-8">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-500/10">
                <CurrentIcon
                  size={22}
                  weight="duotone"
                  className="text-violet-200"
                />
              </div>

              <div>
                <span className="text-[9px] text-white/25">
                  مرحله {step + 1} از {steps.length}
                </span>

                <h3 className="mt-1 text-xl font-semibold">
                  {current.title}
                </h3>
              </div>
            </div>

            <div className="space-y-5">
              {current.fields.map(
                ([name, label, placeholder, multiline]) => (
                  <label key={name} className="block">
                    <span className="mb-2 block text-xs text-white/50">
                      {label}
                    </span>

                    {multiline ? (
                      <textarea
                        rows={5}
                        value={form[name]}
                        placeholder={placeholder}
                        onChange={(e) =>
                          update(name, e.target.value)
                        }
                        className="w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 text-sm leading-7 text-white outline-none placeholder:text-white/20 focus:border-violet-400/40"
                      />
                    ) : (
                      <input
                        value={form[name]}
                        placeholder={placeholder}
                        onChange={(e) =>
                          update(name, e.target.value)
                        }
                        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-400/40"
                      />
                    )}
                  </label>
                )
              )}
            </div>

            {/* NAVIGATION */}
            <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-6">
              <button
                disabled={step === 0}
                onClick={() =>
                  setStep((value) =>
                    Math.max(0, value - 1)
                  )
                }
                className="flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-xs text-white/50 disabled:opacity-20"
              >
                <ArrowRight size={14} />
                مرحله قبل
              </button>

              {step < steps.length - 1 ? (
                <button
                  onClick={() =>
                    setStep((value) =>
                      Math.min(
                        steps.length - 1,
                        value + 1
                      )
                    )
                  }
                  className="flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/15 px-6 py-3 text-xs"
                >
                  ادامه
                  <ArrowLeft size={14} />
                </button>
              ) : (
                <button
                  onClick={() => setFinished(true)}
                  className="flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-gradient-to-l from-violet-500/25 to-fuchsia-500/20 px-6 py-3 text-xs"
                >
                  <Sparkle size={14} weight="fill" />
                  ساخت برند بوک
                </button>
              )}
            </div>
          </section>

          {/* SUMMARY */}
          <aside className="h-fit rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-5">
            <h3 className="text-sm font-medium">
              پروفایل برند
            </h3>

            <p className="mt-1 text-[10px] text-white/25">
              خلاصه اطلاعات واردشده
            </p>

            <div className="mt-6 space-y-5">
              <Summary
                label="نام برند"
                value={form.brandName}
              />

              <Summary
                label="حوزه فعالیت"
                value={form.industry}
              />

              <Summary
                label="شخصیت برند"
                value={form.personality}
              />

              <Summary
                label="لحن برند"
                value={form.tone}
              />

              <Summary
                label="رنگ‌ها"
                value={form.colors}
              />
            </div>

            <div className="mt-7 rounded-2xl border border-violet-400/10 bg-violet-500/[0.05] p-4">
              <div className="flex items-center gap-2">
                <Sparkle
                  size={12}
                  weight="fill"
                  className="text-violet-300"
                />

                <span className="text-[10px] text-white/60">
                  حافظه مشترک Loadder
                </span>
              </div>

              <p className="mt-2 text-[10px] leading-5 text-white/25">
                این اطلاعات بعداً در سایر متخصص‌های هوش مصنوعی قابل
                استفاده خواهد بود.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-white/[0.06] pb-4 last:border-0">
      <span className="text-[9px] text-white/25">
        {label}
      </span>

      <p className="mt-1 text-xs leading-5 text-white/60">
        {value || "هنوز مشخص نشده"}
      </p>
    </div>
  );
}