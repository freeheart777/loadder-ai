import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpenText,
  FileText,
  Globe,
  Gauge,
  Sparkle,
  InstagramLogo,
  Megaphone,
  UsersThree,
  ChartLineUp,
  Lightning,
  ArrowLeft,
  CheckCircle,
} from "@phosphor-icons/react";

const agents = [
  {
    id: "brandbook",
    step: "01",
    title: "برند بوک",
    en: "Brand Book AI",
    icon: BookOpenText,
    cta: "ساخت Brand Book",
    description:
      "هویت برند، لحن، شخصیت، پیام‌های کلیدی و چارچوب ارتباطی کسب‌وکار را تعریف می‌کند.",
    capabilities: [
      "هویت و شخصیت برند",
      "لحن و پیام‌های اصلی",
      "چارچوب بصری و ارتباطی",
    ],
  },
  {
    id: "proposal",
    step: "02",
    title: "بیزنس پروپوزال",
    en: "Business Proposal AI",
    icon: FileText,
    cta: "ساخت پروپوزال",
    description:
      "پیشنهاد ارزش، خدمات، بازار هدف و ساختار کسب‌وکار را به یک پروپوزال حرفه‌ای تبدیل می‌کند.",
    capabilities: [
      "تعریف پیشنهاد ارزش",
      "ساختار بیزنس پروپوزال",
      "تعریف خدمات و بازار هدف",
    ],
  },
  {
    id: "website",
    step: "03",
    title: "سایت‌ساز هوشمند",
    en: "Website AI",
    icon: Globe,
    cta: "ساخت سایت",
    description:
      "برند و بیزنس شما را به یک وب‌سایت تبدیل می‌کند؛ با ساختار، محتوا و مسیر تبدیل.",
    capabilities: [
      "ساخت ساختار سایت",
      "محتوای اولیه صفحات",
      "CTA و مسیر تبدیل",
    ],
  },
  {
    id: "kpi",
    step: "04",
    title: "KPI هوشمند",
    en: "KPI AI",
    icon: Gauge,
    cta: "تعریف KPI",
    description:
      "معیارهای موفقیت کسب‌وکار را مشخص می‌کند تا قبل از اجرا بدانید دقیقاً چه چیزی باید اندازه‌گیری شود.",
    capabilities: [
      "تعریف KPIهای کلیدی",
      "هدف‌گذاری عددی",
      "چارچوب ارزیابی عملکرد",
    ],
  },
  {
    id: "content",
    step: "05",
    title: "تولید محتوا",
    en: "Content AI",
    icon: Sparkle,
    cta: "ساخت محتوا",
    description:
      "براساس هویت برند و اهداف شما، محتوا برای وب‌سایت، شبکه‌های اجتماعی و کمپین‌ها تولید می‌کند.",
    capabilities: [
      "محتوای وب و لندینگ",
      "کپشن و محتوای سوشال",
      "سناریوی کمپین و ویدئو",
    ],
  },
  {
    id: "social",
    step: "06",
    title: "مدیر سوشال",
    en: "Social AI",
    icon: InstagramLogo,
    cta: "ساخت برنامه سوشال",
    description:
      "محتوا را به برنامه انتشار، تقویم و استراتژی حضور در شبکه‌های اجتماعی تبدیل می‌کند.",
    capabilities: [
      "تقویم محتوایی",
      "برنامه انتشار",
      "تحلیل تعامل مخاطبان",
    ],
  },
  {
    id: "ads",
    step: "07",
    title: "تبلیغات هوشمند",
    en: "Ads AI",
    icon: Megaphone,
    cta: "ساخت کمپین",
    description:
      "کمپین‌های تبلیغاتی را براساس KPIهای مشخص طراحی و برای جذب لید و فروش بهینه می‌کند.",
    capabilities: [
      "طراحی کمپین",
      "پیام و خلاقه تبلیغاتی",
      "بهینه‌سازی عملکرد",
    ],
  },
  {
    id: "crm",
    step: "08",
    title: "CRM هوشمند",
    en: "CRM AI",
    icon: UsersThree,
    cta: "راه‌اندازی CRM",
    description:
      "لیدهای ورودی را جمع‌آوری، دسته‌بندی و برای تبدیل شدن به مشتری مدیریت می‌کند.",
    capabilities: [
      "مدیریت لید",
      "Lead Scoring",
      "پیگیری و Follow-up",
    ],
  },
  {
    id: "analytics",
    step: "09",
    title: "تحلیل و گزارش‌گیری",
    en: "Analytics AI",
    icon: ChartLineUp,
    cta: "تحلیل داده‌ها",
    description:
      "نتایج کمپین، محتوا و فروش را بررسی می‌کند و داده‌ها را به پیشنهادهای اجرایی تبدیل می‌کند.",
    capabilities: [
      "تحلیل KPI",
      "گزارش عملکرد",
      "شناسایی فرصت‌های رشد",
    ],
  },
  {
    id: "automation",
    step: "10",
    title: "اتوماسیون هوشمند",
    en: "Automation AI",
    icon: Lightning,
    cta: "ساخت اتوماسیون",
    description:
      "فرایندهای تکراری را به Workflowهای هوشمند تبدیل می‌کند و چرخه رشد را خودکار جلو می‌برد.",
    capabilities: [
      "ساخت Workflow",
      "اتصال فرایندها",
      "اجرای خودکار وظایف",
    ],
  },
];

export function AIAgents() {
  const [activeId, setActiveId] = useState("brandbook");

  const activeAgent =
    agents.find((agent) => agent.id === activeId) ?? agents[0];

  const ActiveIcon = activeAgent.icon;

  return (
    <section
      id="ai-agents"
      dir="rtl"
      className="relative overflow-hidden bg-black px-5 py-24 text-white md:px-10 md:py-32"
    >
      {/* BACKGROUND */}
      <div className="pointer-events-none absolute left-1/2 top-[48%] h-[820px] w-[1200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/[0.09] blur-[180px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* HEADER */}
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl">
            <span
              dir="ltr"
              className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45"
            >
              Loadder AI Launcher
            </span>
          </div>

          <h2 className="text-4xl font-semibold leading-[1.25] tracking-[-0.04em] md:text-6xl">
            هر کاری داری،
            <br />

            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,#818cf8 0%,#d946ef 48%,#fcd34d 100%)",
              }}
            >
              یک AI برایش آماده است.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/50">
            لازم نیست از مرحله اول شروع کنی. هر متخصص را جداگانه فعال کن، یا
            چند متخصص را کنار هم قرار بده و چرخه رشد خودت را بساز.
          </p>
        </div>

        {/* BUTTON GRID */}
        <div className="mx-auto mb-12 grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {agents.map((agent) => {
            const Icon = agent.icon;
            const isActive = agent.id === activeId;

            return (
              <motion.button
                key={agent.id}
                type="button"
                onClick={() => setActiveId(agent.id)}
                whileHover={{
                  y: -5,
                  scale: 1.015,
                }}
                whileTap={{
                  scale: 0.97,
                }}
                className={`group relative min-h-[136px] overflow-hidden rounded-[26px] border p-4 text-center backdrop-blur-xl transition-all duration-300 ${
                  isActive
                    ? "border-fuchsia-300/35 bg-white/[0.10] shadow-[0_18px_55px_rgba(168,85,247,0.20),inset_0_1px_0_rgba(255,255,255,0.16)]"
                    : "border-white/[0.08] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/[0.18] hover:bg-white/[0.065]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="loadder-home-agent"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.15] via-fuchsia-500/[0.11] to-cyan-400/[0.05]"
                  />
                )}

                {/* TOP SHINE */}
                <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                <div className="relative flex h-full flex-col items-center justify-center">
                  {/* STEP */}
                  <div className="absolute right-0 top-0">
                    <span
                      dir="ltr"
                      className="font-mono text-[8px] tracking-[0.16em] text-white/20"
                    >
                      {agent.step}
                    </span>
                  </div>

                  {/* ICON */}
                  <div
                    className={`relative mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] border transition-all duration-300 ${
                      isActive
                        ? "border-white/20 bg-gradient-to-br from-violet-500/35 via-fuchsia-500/25 to-amber-300/20 text-white shadow-[0_0_32px_rgba(168,85,247,0.30)]"
                        : "border-white/[0.08] bg-white/[0.04] text-white/45 group-hover:border-white/15 group-hover:text-white"
                    }`}
                  >
                    <Icon size={22} weight="duotone" />

                    {isActive && (
                      <motion.span
                        className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-cyan-300"
                        animate={{
                          opacity: [1, 0.35, 1],
                          scale: [1, 1.35, 1],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.5,
                        }}
                      />
                    )}
                  </div>

                  {/* LABEL */}
                  <span
                    className={`text-xs font-medium leading-5 transition-colors ${
                      isActive ? "text-white" : "text-white/60"
                    }`}
                  >
                    {agent.title}
                  </span>

                  <span
                    dir="ltr"
                    className="mt-1 text-[7px] uppercase tracking-[0.14em] text-white/20"
                  >
                    {agent.en}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* ACTIVE TOOL PANEL */}
        <div className="relative mx-auto max-w-5xl">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/[0.09] blur-[120px]" />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeAgent.id}
              initial={{
                opacity: 0,
                y: 18,
                scale: 0.99,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: -10,
                scale: 0.99,
              }}
              transition={{
                duration: 0.32,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative overflow-hidden rounded-[34px] border border-white/[0.10] bg-white/[0.045] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-9"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.05]" />

              <div className="relative z-10 grid gap-8 md:grid-cols-[1.05fr_0.95fr] md:items-center">
                {/* LEFT */}
                <div>
                  <div className="mb-5 flex items-center gap-4">
                    <motion.div
                      initial={{
                        rotate: -5,
                        scale: 0.94,
                      }}
                      animate={{
                        rotate: 0,
                        scale: 1,
                      }}
                      className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.05]"
                    >
                      <div className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-cyan-400/10" />

                      <ActiveIcon
                        size={28}
                        weight="duotone"
                        className="relative text-white"
                      />
                    </motion.div>

                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          dir="ltr"
                          className="font-mono text-[8px] text-white/25"
                        >
                          {activeAgent.step}
                        </span>

                        <span
                          dir="ltr"
                          className="text-[7px] uppercase tracking-[0.18em] text-white/20"
                        >
                          {activeAgent.en}
                        </span>
                      </div>

                      <h3 className="text-2xl font-semibold text-white">
                        {activeAgent.title}
                      </h3>
                    </div>
                  </div>

                  <p className="max-w-xl text-sm leading-8 text-white/50">
                    {activeAgent.description}
                  </p>

                  {/* PRIMARY CTA */}
                  <motion.button
                    whileHover={{ x: -3 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    className="mt-7 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-gradient-to-l from-violet-500/20 via-fuchsia-500/15 to-transparent px-6 py-3.5 text-xs font-medium text-white/90 shadow-[0_10px_35px_rgba(168,85,247,0.12)] transition hover:border-fuchsia-300/40 hover:text-white"
                  >
                    {activeAgent.cta}
                    <ArrowLeft size={14} />
                  </motion.button>
                </div>

                {/* RIGHT */}
                <div className="rounded-[24px] border border-white/[0.07] bg-black/20 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-medium text-white/55">
                      چه چیزی تحویل می‌گیری؟
                    </span>

                    <div className="flex items-center gap-2">
                      <motion.span
                        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                        animate={{
                          opacity: [1, 0.3, 1],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.5,
                        }}
                      />

                      <span
                        dir="ltr"
                        className="text-[7px] tracking-[0.15em] text-emerald-400/60"
                      >
                        READY
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {activeAgent.capabilities.map((item, index) => (
                      <motion.div
                        key={item}
                        initial={{
                          opacity: 0,
                          x: 12,
                        }}
                        animate={{
                          opacity: 1,
                          x: 0,
                        }}
                        transition={{
                          delay: index * 0.06,
                        }}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                          <CheckCircle
                            size={13}
                            weight="duotone"
                            className="text-fuchsia-300/70"
                          />
                        </div>

                        <span className="text-xs text-white/55">{item}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* STATUS */}
                  <div className="mt-5 border-t border-white/[0.06] pt-4">
                    <div className="flex items-center justify-between text-[8px] text-white/25">
                      <span>وضعیت متخصص</span>
                      <span dir="ltr">READY TO START</span>
                    </div>

                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div
                        key={activeAgent.id}
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{
                          duration: 0.65,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* BOTTOM NOTE */}
        <div className="mx-auto mt-8 flex max-w-3xl items-center justify-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />

          <span className="text-center text-[9px] leading-5 text-white/25">
            هر متخصص مستقل است — اما کنار هم یک سیستم رشد کامل می‌سازند
          </span>

          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
        </div>
      </div>
    </section>
  );
}

export default AIAgents;