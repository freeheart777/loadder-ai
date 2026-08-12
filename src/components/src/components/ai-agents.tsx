import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    
  Globe,
  Sparkle,
  Megaphone,
  InstagramLogo,
  UsersThree,
  Headset,
  ChartLineUp,
  MagnifyingGlass,
  Lightning,
  ShoppingCart,
  ArrowLeft,
} from "@phosphor-icons/react";

const agents = [
  {
    id: "website",
    title: "سایت‌ساز هوشمند",
    en: "Website AI",
    icon: Globe,
    description:
      "از یک توضیح ساده، ساختار سایت، صفحات، محتوا و پیشنهاد طراحی را آماده می‌کند تا سریع‌تر آنلاین شوید.",
    capabilities: [
      "ساخت ساختار و صفحات سایت",
      "پیشنهاد محتوا و CTA",
      "بهینه‌سازی تجربه کاربری",
    ],
  },
  {
    id: "content",
    title: "محتواساز",
    en: "Content AI",
    icon: Sparkle,
    description:
      "برای برند شما محتوا تولید می‌کند؛ از کپشن و مقاله تا سناریوی ویدئو و محتوای کمپین.",
    capabilities: [
      "تولید محتوای متناسب با برند",
      "سناریو و کپشن شبکه‌های اجتماعی",
      "محتوای وب و لندینگ",
    ],
  },
  {
    id: "ads",
    title: "تبلیغات هوشمند",
    en: "Ads AI",
    icon: Megaphone,
    description:
      "کمپین‌های تبلیغاتی را طراحی، تحلیل و برای افزایش بازده بودجه بهینه می‌کند.",
    capabilities: [
      "طراحی کمپین",
      "پیشنهاد پیام تبلیغاتی",
      "تحلیل و بهینه‌سازی عملکرد",
    ],
  },
  {
    id: "social",
    title: "مدیر سوشال",
    en: "Social AI",
    icon: InstagramLogo,
    description:
      "تقویم محتوا، ایده پست، کپشن و برنامه انتشار شبکه‌های اجتماعی را مدیریت می‌کند.",
    capabilities: [
      "تقویم محتوایی",
      "ایده‌پردازی و تولید پست",
      "تحلیل تعامل مخاطبان",
    ],
  },
  {
    id: "sales",
    title: "دستیار فروش",
    en: "Sales AI",
    icon: ShoppingCart,
    description:
      "فرصت‌های فروش را تحلیل می‌کند، پیشنهاد پاسخ می‌دهد و به تیم فروش برای تبدیل بهتر لیدها کمک می‌کند.",
    capabilities: [
      "تحلیل فرصت‌های فروش",
      "پیشنهاد Follow-up",
      "اولویت‌بندی مشتریان",
    ],
  },
  {
    id: "crm",
    title: "CRM هوشمند",
    en: "CRM AI",
    icon: UsersThree,
    description:
      "لیدها و مشتریان را تحلیل می‌کند، امتیاز می‌دهد و مراحل ارتباط با مشتری را هوشمندتر می‌کند.",
    capabilities: [
      "Lead Scoring",
      "پیگیری خودکار",
      "تحلیل رفتار مشتری",
    ],
  },
  {
    id: "support",
    title: "پشتیبان هوشمند",
    en: "Support AI",
    icon: Headset,
    description:
      "به سوالات مشتریان پاسخ می‌دهد و با استفاده از دانش کسب‌وکار شما پشتیبانی سریع‌تر ارائه می‌کند.",
    capabilities: [
      "پاسخ‌گویی هوشمند",
      "دسترسی به دانش سازمانی",
      "پشتیبانی ۲۴ ساعته",
    ],
  },
  {
    id: "research",
    title: "تحلیل‌گر بازار",
    en: "Research AI",
    icon: MagnifyingGlass,
    description:
      "بازار، رقبا و رفتار مخاطب را بررسی می‌کند و اطلاعات را به بینش قابل استفاده تبدیل می‌کند.",
    capabilities: [
      "تحلیل رقبا",
      "تحقیق بازار",
      "استخراج فرصت‌های رشد",
    ],
  },
  {
    id: "analytics",
    title: "تحلیل‌گر رشد",
    en: "Analytics AI",
    icon: ChartLineUp,
    description:
      "داده‌های بازاریابی و فروش را تحلیل می‌کند و مشخص می‌کند چه چیزی واقعاً باعث رشد کسب‌وکار شده است.",
    capabilities: [
      "تحلیل KPI",
      "بررسی Conversion",
      "شناسایی کانال‌های پربازده",
    ],
  },
  {
    id: "automation",
    title: "اتوماسیون هوشمند",
    en: "Automation AI",
    icon: Lightning,
    description:
      "فرایندهای تکراری بین سایت، CRM، بازاریابی و ابزارهای دیگر را به جریان‌های خودکار تبدیل می‌کند.",
    capabilities: [
      "ساخت Workflow",
      "اتصال ابزارها",
      "اجرای خودکار فرایندها",
    ],
  },
];

export function AIAgents() {
  const [activeId, setActiveId] = useState("website");

  const activeAgent =
    agents.find((agent) => agent.id === activeId) ?? agents[0];

  const ActiveIcon = activeAgent.icon;

  return (
    <section
      id="ai-agents"
      dir="rtl"
      className="relative overflow-hidden bg-black px-6 py-28 text-white md:px-10 md:py-40"
    >
      {/* background */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/[0.08] blur-[180px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* HEADER */}
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl">
            <span className="text-[11px] font-medium tracking-[0.08em] text-white/50">
              Loadder AI Experts
            </span>
          </div>

          <h2 className="text-4xl font-semibold leading-[1.3] tracking-[-0.04em] md:text-6xl">
            یک دکمه.
            <br />

            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,#818cf8 0%,#e879f9 48%,#fcd34d 100%)",
              }}
            >
              یک متخصص هوش مصنوعی.
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-white/50 md:text-lg">
            هر بخش از کسب‌وکار شما، یک AI تخصصی دارد؛ آماده برای تحلیل،
            تصمیم‌گیری و اجرای کار.
          </p>
        </div>

        {/* AGENT BUTTONS */}
        <div className="mx-auto mb-14 flex max-w-5xl flex-wrap justify-center gap-3">
          {agents.map((agent) => {
            const Icon = agent.icon;
            const isActive = agent.id === activeId;

            return (
              <motion.button
                key={agent.id}
                type="button"
                onClick={() => setActiveId(agent.id)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                className={`
                  group relative flex items-center gap-3 overflow-hidden
                  rounded-2xl border px-5 py-3.5
                  backdrop-blur-xl transition-all duration-300
                  ${
                    isActive
                      ? "border-fuchsia-300/35 bg-white/[0.10] shadow-[0_12px_40px_rgba(168,85,247,0.16),inset_0_1px_0_rgba(255,255,255,0.14)]"
                      : "border-white/[0.08] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/[0.16] hover:bg-white/[0.065]"
                  }
                `}
              >
                {/* active glow */}
                {isActive && (
                  <motion.div
                    layoutId="agent-button-glow"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-500/[0.10] via-fuchsia-500/[0.12] to-amber-300/[0.08]"
                  />
                )}

                <div
                  className={`
                    relative flex h-9 w-9 shrink-0 items-center justify-center
                    rounded-xl border transition duration-300
                    ${
                      isActive
                        ? "border-white/15 bg-gradient-to-br from-violet-500/30 via-fuchsia-500/25 to-amber-300/20 text-white"
                        : "border-white/[0.07] bg-white/[0.04] text-white/50 group-hover:text-white/80"
                    }
                  `}
                >
                  <Icon size={18} weight="duotone" />
                </div>

                <div className="relative text-right">
                  <div
                    className={`text-xs font-medium transition ${
                      isActive ? "text-white" : "text-white/60"
                    }`}
                  >
                    {agent.title}
                  </div>

                  <div
                    dir="ltr"
                    className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-white/25"
                  >
                    {agent.en}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* ACTIVE AGENT PANEL */}
        <div className="relative mx-auto max-w-5xl">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/[0.08] blur-[120px]" />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeAgent.id}
              initial={{
                opacity: 0,
                y: 18,
                scale: 0.985,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: -12,
                scale: 0.99,
              }}
              transition={{
                duration: 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative overflow-hidden rounded-[34px] border border-white/[0.10] bg-white/[0.045] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-10"
            >
              {/* inner gradient */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.05]" />

              <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
                {/* text */}
                <div>
                  <div className="mb-6 flex items-center gap-4">
                    <motion.div
                      initial={{ rotate: -8, scale: 0.9 }}
                      animate={{ rotate: 0, scale: 1 }}
                      className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.055]"
                    >
                      <div className="absolute inset-0 rounded-[22px] bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-amber-300/10" />

                      <ActiveIcon
                        size={30}
                        weight="duotone"
                        className="relative text-white"
                      />
                    </motion.div>

                    <div>
                      <div
                        dir="ltr"
                        className="mb-1 text-[9px] uppercase tracking-[0.2em] text-white/25"
                      >
                        {activeAgent.en}
                      </div>

                      <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">
                        {activeAgent.title}
                      </h3>
                    </div>
                  </div>

                  <p className="max-w-xl text-sm leading-8 text-white/50 md:text-base">
                    {activeAgent.description}
                  </p>

                  <button className="mt-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-xs font-medium text-white/65 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white">
                    فعال‌کردن متخصص
                    <ArrowLeft size={14} />
                  </button>
                </div>

                {/* CAPABILITIES */}
                <div className="rounded-[26px] border border-white/[0.07] bg-black/20 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-medium text-white/60">
                      قابلیت‌های این متخصص
                    </span>

                    <div className="flex items-center gap-1.5">
                      <motion.span
                        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                        animate={{
                          opacity: [1, 0.3, 1],
                        }}
                        transition={{
                          duration: 1.6,
                          repeat: Infinity,
                        }}
                      />

                      <span className="text-[8px] uppercase tracking-[0.16em] text-emerald-400/60">
                        AI READY
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {activeAgent.capabilities.map((item, index) => (
                      <motion.div
                        key={item}
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.08 + index * 0.07,
                        }}
                        className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04]">
                          <Sparkle
                            size={13}
                            weight="fill"
                            className="text-fuchsia-300/70"
                          />
                        </div>

                        <span className="text-xs text-white/55">{item}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* intelligence meter */}
                  <div className="mt-5 border-t border-white/[0.06] pt-5">
                    <div className="mb-2 flex justify-between text-[9px] text-white/30">
                      <span>آمادگی متخصص</span>
                      <span dir="ltr">98%</span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div
                        key={activeAgent.id}
                        initial={{ width: 0 }}
                        animate={{ width: "98%" }}
                        transition={{
                          duration: 0.9,
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
      </div>
    </section>
  );
}

export default AIAgents;