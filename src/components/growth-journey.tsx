import { motion } from "framer-motion";
import {
  RocketLaunch,
  Megaphone,
  ChartLineUp,
  Globe,
  Sparkle,
  UsersThree,
  Robot,
  ArrowLeft,
} from "@phosphor-icons/react";

const stages = [
  {
    number: "01",
    en: "LAUNCH",
    title: "شروع",
    headline: "ایده‌ات را آنلاین کن.",
    description:
      "از ساخت سایت و تولید محتوا تا آماده‌سازی زیرساخت حضور دیجیتال؛ همه‌چیز برای شروع سریع‌تر کسب‌وکارت.",
    icon: RocketLaunch,
    accent: "from-cyan-400 to-blue-500",
    glow: "bg-cyan-500/10",
    features: [
      { icon: Globe, label: "سایت‌ساز هوشمند" },
      { icon: Sparkle, label: "تولید محتوا با AI" },
    ],
  },
  {
    number: "02",
    en: "GROW",
    title: "رشد",
    headline: "دیده شو. مشتری جذب کن.",
    description:
      "کمپین‌ها، شبکه‌های اجتماعی و تبلیغات را در یک مسیر هماهنگ مدیریت کن و توجه را به لید و فروش تبدیل کن.",
    icon: Megaphone,
    accent: "from-fuchsia-400 to-violet-500",
    glow: "bg-fuchsia-500/10",
    features: [
      { icon: Megaphone, label: "تبلیغات و کمپین" },
      { icon: UsersThree, label: "مدیریت شبکه‌های اجتماعی" },
    ],
  },
  {
    number: "03",
    en: "SMART",
    title: "هوشمندسازی",
    headline: "رشد را به سیستم تبدیل کن.",
    description:
      "CRM، اتوماسیون، هوش مصنوعی و داده را به هم متصل کن تا کسب‌وکارت با وابستگی کمتر و هوشمندی بیشتر رشد کند.",
    icon: Robot,
    accent: "from-amber-300 via-fuchsia-400 to-violet-500",
    glow: "bg-violet-500/10",
    features: [
      { icon: Robot, label: "اتوماسیون و هوش مصنوعی" },
      { icon: ChartLineUp, label: "تحلیل و بهینه‌سازی" },
    ],
  },
];

export function GrowthJourney() {
  return (
    <section
      id="solutions"
      dir="rtl"
      className="relative overflow-hidden bg-black px-6 py-28 text-white md:px-10 md:py-40"
    >
      {/* AMBIENT BACKGROUND */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[650px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/[0.07] blur-[160px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* HEADER */}
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl">
            <span className="text-[11px] font-medium tracking-[0.08em] text-white/50">
              مسیر رشد با لودر
            </span>
          </div>

          <h2 className="text-4xl font-semibold leading-[1.25] tracking-[-0.04em] text-white md:text-6xl">
            از شروع تا رشد،
            <br />

            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,#818cf8 0%,#e879f9 48%,#fcd34d 100%)",
              }}
            >
              یک مسیر یکپارچه.
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-white/50 md:text-lg">
            لودر فقط مجموعه‌ای از ابزارها نیست؛ زیرساختی است که مسیر دیجیتال
            کسب‌وکار شما را از اولین قدم تا رشد و هوشمندسازی مدیریت می‌کند.
          </p>
        </div>

        {/* JOURNEY */}
        <div className="relative">
          {/* DESKTOP CONNECTOR */}
          <div className="absolute left-[16%] right-[16%] top-[55px] hidden h-px bg-white/10 lg:block">
            <motion.div
              className="h-full origin-right bg-gradient-to-l from-cyan-400 via-fuchsia-400 to-violet-500"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{
                duration: 1.4,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {stages.map((stage, index) => {
              const Icon = stage.icon;

              return (
                <motion.article
                  key={stage.en}
                  initial={{
                    opacity: 0,
                    y: 35,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{
                    once: true,
                    amount: 0.25,
                  }}
                  transition={{
                    duration: 0.65,
                    delay: index * 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="group relative"
                >
                  {/* JOURNEY NODE */}
                  <div className="relative z-20 mx-auto mb-8 flex h-[110px] w-[110px] items-center justify-center">
                    <div
                      className={`absolute inset-0 rounded-full ${stage.glow} opacity-0 blur-2xl transition duration-500 group-hover:opacity-100`}
                    />

                    <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition duration-500 group-hover:-translate-y-1 group-hover:border-white/20">
                      <div
                        className={`absolute inset-[1px] rounded-[21px] bg-gradient-to-br ${stage.accent} opacity-[0.08]`}
                      />

                      <Icon
                        size={27}
                        weight="duotone"
                        className="relative text-white/85"
                      />
                    </div>

                    <div
                      dir="ltr"
                      className="absolute bottom-0 rounded-full border border-white/10 bg-black px-2.5 py-1 text-[8px] font-semibold tracking-[0.2em] text-white/35"
                    >
                      {stage.en}
                    </div>
                  </div>

                  {/* CARD */}
                  <div className="relative min-h-[350px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-7 backdrop-blur-xl transition duration-500 group-hover:-translate-y-1 group-hover:border-white/[0.15] group-hover:bg-white/[0.05]">
                    <div
                      className={`pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full ${stage.glow} blur-[70px]`}
                    />

                    <div className="relative z-10">
                      <div className="mb-7 flex items-center justify-between">
                        <span className="text-2xl font-semibold text-white">
                          {stage.title}
                        </span>

                        <span
                          dir="ltr"
                          className="font-mono text-xs text-white/20"
                        >
                          {stage.number}
                        </span>
                      </div>

                      <h3 className="text-xl font-semibold leading-8 text-white/90">
                        {stage.headline}
                      </h3>

                      <p className="mt-4 min-h-[96px] text-sm leading-7 text-white/45">
                        {stage.description}
                      </p>

                      {/* FEATURES */}
                      <div className="mt-7 space-y-2.5">
                        {stage.features.map((feature) => {
                          const FeatureIcon = feature.icon;

                          return (
                            <div
                              key={feature.label}
                              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                                <FeatureIcon
                                  size={15}
                                  weight="duotone"
                                  className="text-white/60"
                                />
                              </div>

                              <span className="text-xs text-white/60">
                                {feature.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <button className="mt-7 flex items-center gap-2 text-xs font-medium text-white/45 transition hover:text-white">
                        بیشتر بدانید
                        <ArrowLeft size={13} />
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default GrowthJourney;