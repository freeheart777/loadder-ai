import { motion } from "framer-motion";
import {
  Brain,
  Robot,
  InstagramLogo,
  WhatsappLogo,
  TelegramLogo,
  GoogleLogo,
  ChartLineUp,
  UsersThree,
  Sparkle,
  Lightning,
} from "@phosphor-icons/react";

const integrations = [
  {
    name: "ChatGPT",
    icon: Brain,
    position: "left-[7%] top-[16%]",
    delay: 0,
  },
  {
    name: "Gemini",
    icon: Sparkle,
    position: "left-[27%] top-[5%]",
    delay: 0.4,
  },
  {
    name: "Grok",
    icon: Robot,
    position: "right-[27%] top-[5%]",
    delay: 0.8,
  },
  {
    name: "Kling",
    icon: Lightning,
    position: "right-[7%] top-[16%]",
    delay: 1.2,
  },
  {
    name: "Instagram",
    icon: InstagramLogo,
    position: "left-[3%] bottom-[20%]",
    delay: 1.6,
  },
  {
    name: "WhatsApp",
    icon: WhatsappLogo,
    position: "left-[25%] bottom-[5%]",
    delay: 2,
  },
  {
    name: "Telegram",
    icon: TelegramLogo,
    position: "right-[25%] bottom-[5%]",
    delay: 2.4,
  },
  {
    name: "Google Ads",
    icon: GoogleLogo,
    position: "right-[3%] bottom-[20%]",
    delay: 2.8,
  },
];

export function AIIntegrations() {
  return (
    <section
      id="integrations"
      dir="rtl"
      className="relative overflow-hidden bg-black px-6 py-28 text-white md:px-10 md:py-40"
    >
      {/* ambient background */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[750px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/[0.08] blur-[170px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* HEADER */}
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl">
            <span className="text-[11px] font-medium tracking-[0.08em] text-white/50">
              AI & Integrations
            </span>
          </div>

          <h2 className="text-4xl font-semibold leading-[1.25] tracking-[-0.04em] md:text-6xl">
            ابزارها عوض می‌شوند.
            <br />

            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,#818cf8 0%,#e879f9 50%,#fcd34d 100%)",
              }}
            >
              سیستم شما نه.
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-white/50 md:text-lg">
            بهترین ابزارهای هوش مصنوعی، بازاریابی و ارتباط با مشتری را
            از یک نقطه مدیریت کنید.
          </p>
        </div>

        {/* INTEGRATION UNIVERSE */}
        <div className="relative mx-auto h-[650px] max-w-5xl">
          {/* orbital circles */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]" />

          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]" />

          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[270px] w-[270px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]" />

          {/* radial glow */}
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[90px]"
            animate={{
              scale: [1, 1.12, 1],
              opacity: [0.45, 0.8, 0.45],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* CENTER LOADDER CORE */}
          <motion.div
            className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            animate={{
              y: [-4, 4, -4],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="relative flex h-[190px] w-[190px] items-center justify-center rounded-[48px] border border-white/[0.12] bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              {/* glow */}
              <div className="absolute inset-4 rounded-[38px] bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-amber-300/10 blur-xl" />

              <div className="relative text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                  <Sparkle
                    size={24}
                    weight="duotone"
                    className="text-fuchsia-300"
                  />
                </div>

                <div className="text-xl font-semibold tracking-[-0.04em]">
                  Loadder AI
                </div>

                <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/30">
                  Intelligence Layer
                </div>
              </div>
            </div>

            {/* pulse */}
            <motion.div
              className="absolute inset-0 -z-10 rounded-[48px] border border-violet-400/20"
              animate={{
                scale: [1, 1.35],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          </motion.div>

          {/* CONNECTOR LINES */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 1000 650"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="integration-line">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0" />
                <stop offset="50%" stopColor="#e879f9" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#fcd34d" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[
              "M500 325 L120 130",
              "M500 325 L300 70",
              "M500 325 L700 70",
              "M500 325 L880 130",
              "M500 325 L100 510",
              "M500 325 L290 590",
              "M500 325 L710 590",
              "M500 325 L900 510",
            ].map((path, index) => (
              <motion.path
                key={path}
                d={path}
                fill="none"
                stroke="url(#integration-line)"
                strokeWidth="1"
                initial={{
                  pathLength: 0,
                  opacity: 0,
                }}
                whileInView={{
                  pathLength: 1,
                  opacity: 1,
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 1.3,
                  delay: index * 0.08,
                }}
              />
            ))}
          </svg>

          {/* INTEGRATION NODES */}
          {integrations.map((item) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.name}
                className={`absolute z-30 ${item.position}`}
                initial={{
                  opacity: 0,
                  scale: 0.75,
                }}
                whileInView={{
                  opacity: 1,
                  scale: 1,
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.6,
                  delay: item.delay * 0.12,
                }}
              >
                <motion.div
                  animate={{
                    y: [-5, 5, -5],
                  }}
                  transition={{
                    duration: 4 + item.delay,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="group flex flex-col items-center gap-2"
                >
                  <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] border border-white/[0.09] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition duration-300 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:bg-white/[0.07]">
                    <div className="absolute inset-0 rounded-[22px] bg-gradient-to-br from-violet-500/[0.07] via-transparent to-fuchsia-500/[0.06]" />

                    <Icon
                      size={27}
                      weight="duotone"
                      className="relative text-white/75 transition group-hover:text-white"
                    />
                  </div>

                  <span
                    dir="ltr"
                    className="text-[10px] font-medium tracking-wide text-white/40 transition group-hover:text-white/75"
                  >
                    {item.name}
                  </span>
                </motion.div>
              </motion.div>
            );
          })}

          {/* BOTTOM MINI SYSTEMS */}
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-[10px] text-white/40">
              <UsersThree size={14} />
              CRM
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-[10px] text-white/40">
              <ChartLineUp size={14} />
              Analytics
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-[10px] text-white/40">
              <Lightning size={14} />
              Automation
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AIIntegrations;