import { motion } from "framer-motion";
import {
  Buildings,
  Robot,
  Lightning,
  SquaresFour,
  CheckCircle,
} from "@phosphor-icons/react";

const steps = [
  {
    number: "01",
    title: "کسب‌وکارت را معرفی کن",
    description:
      "چند سؤال کوتاه درباره کسب‌وکار، بازار، مخاطب و هدفت جواب بده تا لودر تصویر دقیقی از نیازت بسازد.",
    icon: Buildings,
    glow: "from-cyan-400/30 to-blue-500/10",
  },
  {
    number: "02",
    title: "متخصص‌های AI را انتخاب کن",
    description:
      "سایت‌ساز، مدیر سوشال، تبلیغات، CRM، تحلیل‌گر رشد یا هر متخصص دیگری که نیاز داری فعال کن.",
    icon: Robot,
    glow: "from-violet-400/30 to-fuchsia-500/10",
  },
  {
    number: "03",
    title: "لودر شروع به کار می‌کند",
    description:
      "متخصص‌ها با اطلاعات کسب‌وکار تو هماهنگ می‌شوند و شروع به تولید، تحلیل، برنامه‌ریزی و اجرای کار می‌کنند.",
    icon: Lightning,
    glow: "from-fuchsia-400/30 to-amber-300/10",
  },
  {
    number: "04",
    title: "همه‌چیز را یک‌جا مدیریت کن",
    description:
      "محتوا، کمپین‌ها، مشتری‌ها، اتوماسیون‌ها و KPIها را از یک داشبورد واحد ببین و مدیریت کن.",
    icon: SquaresFour,
    glow: "from-amber-300/30 to-violet-500/10",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      dir="rtl"
      className="relative overflow-hidden bg-black px-6 py-28 text-white md:px-10 md:py-40"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/[0.07] blur-[170px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* header */}
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl">
            <span className="text-[11px] font-medium tracking-[0.08em] text-white/50">
              How Loadder Works
            </span>
          </div>

          <h2 className="text-4xl font-semibold leading-[1.3] tracking-[-0.04em] md:text-6xl">
            از «می‌خوام رشد کنم»
            <br />

            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,#818cf8 0%,#e879f9 50%,#fcd34d 100%)",
              }}
            >
              تا «انجام شد».
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-white/50 md:text-lg">
            هدف را مشخص کن، متخصص‌ها را فعال کن و بقیه مسیر را با Loadder AI
            جلو ببر.
          </p>
        </div>

        {/* system timeline */}
        <div className="relative">
          {/* desktop rail */}
          <div className="absolute left-[10%] right-[10%] top-[58px] hidden h-px bg-white/[0.08] lg:block">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 1.6,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="h-full origin-right bg-gradient-to-l from-cyan-400 via-fuchsia-400 to-amber-300"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <motion.article
                  key={step.number}
                  initial={{
                    opacity: 0,
                    y: 30,
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
                  {/* node */}
                  <div className="relative z-20 mx-auto mb-8 flex h-[116px] w-[116px] items-center justify-center">
                    <div
                      className={`absolute inset-0 rounded-full bg-gradient-to-br ${step.glow} opacity-0 blur-2xl transition duration-500 group-hover:opacity-100`}
                    />

                    <motion.div
                      whileHover={{ y: -4, scale: 1.03 }}
                      className="relative flex h-[78px] w-[78px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl"
                    >
                      <div
                        className={`absolute inset-[1px] rounded-[23px] bg-gradient-to-br ${step.glow} opacity-40`}
                      />

                      <Icon
                        size={29}
                        weight="duotone"
                        className="relative text-white/85"
                      />
                    </motion.div>

                    <div
                      dir="ltr"
                      className="absolute bottom-0 rounded-full border border-white/10 bg-black px-3 py-1 font-mono text-[8px] tracking-[0.2em] text-white/35"
                    >
                      STEP {step.number}
                    </div>
                  </div>

                  {/* card */}
                  <div className="relative min-h-[310px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-6 backdrop-blur-xl transition duration-500 group-hover:-translate-y-1 group-hover:border-white/[0.15] group-hover:bg-white/[0.05]">
                    <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-violet-500/[0.06] blur-[60px]" />

                    <div className="relative z-10">
                      <div className="mb-6 flex items-center justify-between">
                        <span className="text-xl font-semibold leading-8 text-white/90">
                          {step.title}
                        </span>

                        <CheckCircle
                          size={18}
                          weight="duotone"
                          className="shrink-0 text-white/20"
                        />
                      </div>

                      <p className="text-sm leading-7 text-white/45">
                        {step.description}
                      </p>

                      <div className="mt-8 border-t border-white/[0.06] pt-5">
                        <div className="flex items-center gap-2">
                          <motion.span
                            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                            animate={{
                              opacity: [1, 0.3, 1],
                            }}
                            transition={{
                              repeat: Infinity,
                              duration: 1.7,
                            }}
                          />

                          <span className="text-[9px] uppercase tracking-[0.14em] text-white/25">
                            System Ready
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>

        {/* bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mx-auto mt-16 flex max-w-3xl flex-col items-center justify-between gap-6 rounded-[28px] border border-white/[0.08] bg-white/[0.035] px-7 py-6 text-center backdrop-blur-xl md:flex-row md:text-right"
        >
          <div>
            <div className="text-lg font-semibold text-white/90">
              آماده‌ای سیستم خودت را بسازی؟
            </div>

            <p className="mt-2 text-sm leading-6 text-white/40">
              چند دقیقه برای شروع کافی است.
            </p>
          </div>

          <button className="liquid-glass shrink-0 rounded-full px-6 py-3 text-sm font-medium text-white transition duration-300 hover:scale-[1.03] hover:bg-white/10">
            شروع با Loadder AI
          </button>
        </motion.div>
      </div>
    </section>
  );
}

export default HowItWorks;