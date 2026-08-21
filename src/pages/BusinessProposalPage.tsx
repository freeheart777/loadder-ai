import { useNavigate } from "react-router-dom";
import { withDemo } from "../lib/demoMode";

import {
  ArrowRight,
  FileText,
  Sparkle,
  Buildings,
  Target,
  Package,
  CurrencyDollar,
  ChartLineUp,
  CheckCircle,
} from "@phosphor-icons/react";

const steps = [
  {
    title: "کسب‌وکار",
    icon: Buildings,
  },
  {
    title: "هدف پروپوزال",
    icon: Target,
  },
  {
    title: "خدمات",
    icon: Package,
  },
  {
    title: "پیشنهاد مالی",
    icon: CurrencyDollar,
  },
  {
    title: "مزیت رقابتی",
    icon: ChartLineUp,
  },
  {
    title: "خروجی",
    icon: CheckCircle,
  },
];

export default function BusinessProposalPage() {
  const navigate = useNavigate();

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
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowRight size={17} />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
              <FileText
                size={20}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div>
              <h1 className="text-sm font-semibold">
                ساخت بیزنس پروپوزال
              </h1>

              <p className="mt-1 text-[10px] text-white/30">
                متخصص هوشمند پیشنهاد تجاری
              </p>
            </div>
          </div>

          <span
            dir="ltr"
            className="text-sm font-semibold text-white/70"
          >
            Loadder AI
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* INTRO */}
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/15 bg-violet-500/[0.08] px-3 py-1.5">
            <Sparkle
              size={12}
              weight="fill"
              className="text-violet-300"
            />

            <span className="text-[10px] text-violet-200/70">
              Proposal AI
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-semibold">
            پیشنهاد تجاری حرفه‌ای بساز.
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">
            اطلاعات اصلی پروژه را وارد کن. Loadder بعداً با استفاده
            از اطلاعات کسب‌وکار، برند بوک و اهداف پروژه یک پروپوزال
            حرفه‌ای و قابل ارائه تولید می‌کند.
          </p>
        </section>

        {/* STEPS */}
        <section className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div
                key={step.title}
                className={`rounded-2xl border p-4 text-center ${
                  index === 0
                    ? "border-violet-300/35 bg-violet-500/15"
                    : "border-white/[0.07] bg-white/[0.025]"
                }`}
              >
                <Icon
                  size={19}
                  weight="duotone"
                  className="mx-auto"
                />

                <span className="mt-2 block text-[10px] text-white/60">
                  {step.title}
                </span>
              </div>
            );
          })}
        </section>

        {/* MAIN CARD */}
        <section className="mt-7 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="rounded-[30px] border border-white/[0.08] bg-white/[0.03] p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-500/10">
                <Buildings
                  size={22}
                  weight="duotone"
                  className="text-violet-200"
                />
              </div>

              <div>
                <span className="text-[9px] text-white/25">
                  مرحله ۱ از ۶
                </span>

                <h3 className="mt-1 text-xl font-semibold">
                  اطلاعات کسب‌وکار
                </h3>
              </div>
            </div>

            <div className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs text-white/50">
                  عنوان پروپوزال
                </span>

                <input
                  placeholder="مثلاً پیشنهاد همکاری دیجیتال مارکتینگ"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-400/40"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs text-white/50">
                  نام شرکت یا مشتری
                </span>

                <input
                  placeholder="نام مشتری یا سازمان"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-400/40"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs text-white/50">
                  درباره پروژه
                </span>

                <textarea
                  rows={5}
                  placeholder="پروژه، نیاز مشتری و هدف همکاری را کوتاه توضیح بده..."
                  className="w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 text-sm leading-7 text-white outline-none placeholder:text-white/20 focus:border-violet-400/40"
                />
              </label>
            </div>

            <div className="mt-8 flex justify-end border-t border-white/[0.06] pt-6">
              <button
                type="button"
                className="rounded-full border border-violet-300/20 bg-violet-500/15 px-6 py-3 text-xs text-white"
              >
                ادامه
              </button>
            </div>
          </div>

          {/* SIDE */}
          <aside className="h-fit rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-5">
            <h3 className="text-sm font-medium">
              پروپوزال جدید
            </h3>

            <p className="mt-1 text-[10px] text-white/25">
              اطلاعات پروژه
            </p>

            <div className="mt-6 rounded-2xl border border-violet-400/10 bg-violet-500/[0.05] p-4">
              <div className="flex items-center gap-2">
                <Sparkle
                  size={12}
                  weight="fill"
                  className="text-violet-300"
                />

                <span className="text-[10px] text-white/60">
                  متصل به Business Brain
                </span>
              </div>

              <p className="mt-2 text-[10px] leading-5 text-white/25">
                در نسخه نهایی، اطلاعات Brand Book و پروفایل کسب‌وکار
                می‌تواند به‌صورت خودکار وارد این متخصص شود.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}