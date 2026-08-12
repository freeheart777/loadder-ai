"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ChatCircle,
  Brain,
  Database,
  TerminalWindow,
  Code,
  FileText,
  SlackLogo,
  NotionLogo,
  Check,
  CircleNotch,
  Clock,
  Minus,
  Globe,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface FeatCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

export function FeatCard({
  title,
  description,
  children,
  className = "",
}: FeatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-[20px] p-4",
        "bg-white dark:bg-neutral-900",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]",
        "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.2)]",
        className
      )}
    >
      <div className="z-10 flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="max-w-[90%] text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="relative mt-2 w-full flex-1 overflow-hidden rounded-[14px] border border-border/50 bg-background/50 dark:bg-neutral-950/50">
        {children}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Card1 – Loadder AI Website Builder
───────────────────────────────────────────── */

export function Card1() {
  const steps = [
    {
      id: "prompt",
      label: "Describe",
      icon: ChatCircle,
      color: "cyan",
    },
    {
      id: "structure",
      label: "Structure",
      icon: Code,
      color: "violet",
    },
    {
      id: "design",
      label: "Design",
      icon: Brain,
      color: "fuchsia",
    },
    {
      id: "publish",
      label: "Publish",
      icon: Globe,
      color: "emerald",
    },
  ];

  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 1800);

    return () => clearInterval(interval);
  }, [steps.length]);

  const colorMap: Record<
    string,
    {
      bg: string;
      border: string;
      text: string;
      glow: string;
    }
  > = {
    cyan: {
      bg: "bg-cyan-500",
      border: "border-cyan-400",
      text: "text-cyan-300",
      glow: "shadow-[0_0_30px_rgba(34,211,238,0.25)]",
    },
    violet: {
      bg: "bg-violet-500",
      border: "border-violet-400",
      text: "text-violet-300",
      glow: "shadow-[0_0_30px_rgba(139,92,246,0.25)]",
    },
    fuchsia: {
      bg: "bg-fuchsia-500",
      border: "border-fuchsia-400",
      text: "text-fuchsia-300",
      glow: "shadow-[0_0_30px_rgba(217,70,239,0.25)]",
    },
    emerald: {
      bg: "bg-emerald-500",
      border: "border-emerald-400",
      text: "text-emerald-300",
      glow: "shadow-[0_0_30px_rgba(16,185,129,0.25)]",
    },
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-neutral-950 p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <ChatCircle size={14} weight="fill" />
          </div>

          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/40">
            AI Website Prompt
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-white/75">
          Build a modern website for a dental clinic with appointment booking,
          services and WhatsApp contact.
        </p>
      </div>

      <div className="relative z-10 mt-4 flex flex-1 items-center justify-between gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === activeStep;
          const isDone = index < activeStep;
          const c = colorMap[step.color];

          return (
            <div key={step.id} className="relative flex flex-1 items-center">
              <div className="flex flex-1 flex-col items-center gap-2">
                <motion.div
                  animate={{
                    scale: isActive ? 1.08 : 1,
                    opacity: isActive || isDone ? 1 : 0.45,
                  }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl border",
                    isActive
                      ? `${c.bg} ${c.border} ${c.glow}`
                      : "border-white/10 bg-white/[0.04]"
                  )}
                >
                  <Icon
                    size={18}
                    weight="fill"
                    className={isActive ? "text-white" : "text-white/55"}
                  />
                </motion.div>

                <span
                  className={cn(
                    "text-[8px] font-mono uppercase tracking-wider",
                    isActive ? c.text : "text-white/35"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="absolute left-[72%] top-[20px] h-px w-[56%] overflow-hidden bg-white/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-emerald-400"
                    initial={{ x: "-100%" }}
                    animate={{
                      x: isDone || isActive ? "0%" : "-100%",
                    }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <motion.div
        className="relative z-10 mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/50"
        animate={{
          borderColor:
            activeStep === 3
              ? "rgba(16,185,129,0.45)"
              : "rgba(255,255,255,0.10)",
        }}
      >
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          <div className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />

          <div className="ml-2 h-4 flex-1 rounded-md bg-white/[0.05]" />
        </div>

        <div className="grid grid-cols-[56px_1fr] gap-2 p-3">
          <div className="space-y-2">
            <div className="h-3 rounded bg-white/10" />
            <div className="h-3 rounded bg-white/[0.06]" />
            <div className="h-3 rounded bg-white/[0.06]" />
          </div>

          <div>
            <motion.div
              className="h-10 rounded-lg bg-gradient-to-r from-violet-500/30 via-fuchsia-500/30 to-amber-400/20"
              animate={{
                opacity: [0.5, 0.9, 0.5],
              }}
              transition={{
                repeat: Infinity,
                duration: 2.5,
              }}
            />

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className="h-6 rounded bg-white/[0.06]" />
              <div className="h-6 rounded bg-white/[0.06]" />
              <div className="h-6 rounded bg-white/[0.06]" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card2 – Marketing Engine
───────────────────────────────────────────── */

export function Card2() {
  const bars = [45, 75, 35, 85, 60, 95, 50];
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  const [activeIdx, setActiveIdx] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev === 0 ? 1 : 0));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full w-full flex-col justify-between gap-3.5">
      <div className="flex gap-4 pb-0.5 pl-0.5 pr-[0.625rem] pt-[0.625rem]">
        {[
          { label: "Reach", value: "84.2k", trend: "+18%" },
          { label: "Leads", value: "1,284", trend: "+12%" },
        ].map((s, i) => {
          const isActive = i === activeIdx || hoveredIdx === i;

          return (
            <div
              key={i}
              className="relative h-[76px] flex-1 select-none"
            >
              <div
                className="absolute inset-0 rounded-xl border border-border/40 bg-muted/5 text-border/30 dark:border-border/20 dark:text-border/20"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, transparent, transparent 6px, currentColor 6px, currentColor 7px)",
                }}
              />

              <motion.div
                className="absolute inset-0 flex h-full w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,1)] backdrop-blur-[2px] transition-colors duration-300 hover:bg-muted/30 dark:bg-neutral-950/80 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.01)]"
                animate={{
                  x: isActive ? "0.5rem" : "0rem",
                  y: isActive ? "-0.5rem" : "0rem",
                }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 16,
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-[8px] font-mono uppercase leading-none tracking-widest text-muted-foreground/80">
                    {s.label}
                  </span>

                  <span className="mt-1.5 text-base font-bold font-mono leading-none tracking-tight text-foreground">
                    {s.value}
                  </span>

                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[8px] font-bold font-mono text-emerald-500">
                      {s.trend}
                    </span>

                    <span className="text-[8px] font-mono text-muted-foreground/50">
                      prev
                    </span>
                  </div>
                </div>

                <div className="flex h-6 w-12 shrink-0 items-center justify-center">
                  <svg
                    className="h-full w-full overflow-visible"
                    viewBox="0 0 48 24"
                  >
                    <motion.path
                      d={
                        i === 0
                          ? "M 0 18 L 16 11 L 32 14 L 48 4"
                          : "M 0 16 L 16 13 L 32 8 L 48 5"
                      }
                      fill="none"
                      stroke="currentColor"
                      className="text-emerald-400/50"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        duration: 0.8,
                        delay: 0.2 + i * 0.15,
                        ease: "easeOut",
                      }}
                    />
                  </svg>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-[90px] flex-1 items-end gap-2.5 px-0.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="relative h-full flex-1 overflow-hidden rounded-xl border border-border/80 bg-muted/5 text-border/40 dark:border-border/30 dark:bg-neutral-950/80 dark:text-border/20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 6px, currentColor 6px, currentColor 7px)",
            }}
          >
            <motion.div
              className="absolute bottom-0 left-0 right-0 rounded-t-[10px] border-x border-t border-violet-400/60 bg-gradient-to-t from-violet-500 to-fuchsia-400"
              initial={{ height: "0%" }}
              animate={{
                height: [
                  `${h}%`,
                  `${Math.min(95, h + 15)}%`,
                  `${Math.max(10, h - 20)}%`,
                  `${Math.min(90, h + 8)}%`,
                  `${h}%`,
                ],
              }}
              transition={{
                repeat: Infinity,
                duration: 3 + (i % 3) * 0.8,
                ease: "easeInOut",
                delay: i * 0.1,
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2.5 px-0.5">
        {days.map((d, i) => (
          <p
            key={i}
            className="flex-1 text-center text-[8px] font-medium font-mono text-muted-foreground"
          >
            {d}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card3 – CRM & Automation
───────────────────────────────────────────── */

const STATUS_ICONS: Record<
  string,
  {
    icon: any;
    color: string;
    bg: string;
    gradient: string;
    border: string;
  }
> = {
  done: {
    icon: Check,
    color: "text-lime-500",
    bg: "bg-lime-500/15",
    gradient: "bg-gradient-to-b from-lime-400 to-lime-600",
    border: "border-lime-600",
  },
  running: {
    icon: CircleNotch,
    color: "text-blue-400",
    bg: "bg-blue-400/15",
    gradient: "bg-gradient-to-b from-blue-400 to-blue-600",
    border: "border-blue-600",
  },
  waiting: {
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-400/15",
    gradient: "bg-gradient-to-b from-amber-400 to-amber-600",
    border: "border-amber-600",
  },
  idle: {
    icon: Minus,
    color: "text-muted-foreground/60",
    bg: "bg-muted/40",
    gradient: "bg-gradient-to-b from-zinc-400 to-zinc-600",
    border: "border-zinc-600",
  },
};

export function Card3() {
  const logs = [
    {
      agent: "New Lead",
      action: "Lead captured from landing page",
      status: "done",
      t: "0.2s",
    },
    {
      agent: "Scoring",
      action: "AI scored purchase intent",
      status: "done",
      t: "0.8s",
    },
    {
      agent: "Follow-up",
      action: "Personalized WhatsApp message sent",
      status: "running",
      t: "1.4s",
    },
    {
      agent: "Sales",
      action: "Waiting for customer reply",
      status: "waiting",
      t: "—",
    },
    {
      agent: "Retention",
      action: "Queued for nurture sequence",
      status: "idle",
      t: "—",
    },
  ];

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % logs.length);
    }, 2400);

    return () => clearInterval(interval);
  }, [logs.length]);

  const getSlot = (i: number) => {
    const N = logs.length;
    let rel = i - activeIdx;

    if (rel > Math.floor(N / 2)) rel -= N;
    if (rel < -Math.floor(N / 2)) rel += N;

    return rel;
  };

  const Y: Record<string, number> = {
    "-2": -68,
    "-1": -38,
    "0": 0,
    "1": 38,
    "2": 68,
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {logs.map((l, i) => {
        const slot = getSlot(i);
        const si = STATUS_ICONS[l.status];
        const abs = Math.abs(slot);
        const isActive = slot === 0;
        const isVisible = abs <= 2;

        const yOffset =
          Y[String(slot)] ?? (slot < 0 ? -120 : 120);

        const scale =
          isActive ? 1 : abs === 1 ? 0.93 : 0.87;

        const opacity =
          isActive ? 1 : abs === 1 ? 0.65 : 0.38;

        const zIndex =
          isActive ? 30 : abs === 1 ? 20 : 10;

        return (
          <motion.div
            key={l.agent}
            className="absolute left-0 right-0 mx-auto px-1.5"
            style={{ zIndex }}
            animate={{
              y: isVisible
                ? yOffset
                : slot < 0
                ? -150
                : 150,

              scale,

              opacity: isVisible
                ? opacity
                : 0,
            }}
            transition={{
              y: {
                type: "spring",
                stiffness: 500,
                damping: 35,
              },

              scale: {
                type: "spring",
                stiffness: 500,
                damping: 35,
              },

              opacity: {
                duration: 0.25,
                ease: "easeOut",
              },
            }}
          >
            <div
              className={cn(
                "flex w-full items-center gap-2.5 rounded-2xl border",
                isActive
                  ? "border-border bg-background px-3 py-2.5"
                  : "border-border/50 bg-muted/30 px-2.5 py-1.5"
              )}
            >
              <div
                className={cn(
                  "shrink-0 rounded-[8px] border font-bold text-white transition-all duration-300 flex items-center justify-center",
                  si.gradient,
                  si.border,
                  isActive
                    ? "h-8 w-8"
                    : "h-5 w-5"
                )}
              >
                <si.icon
                  weight="bold"
                  className={cn(
                    isActive
                      ? "h-4 w-4"
                      : "h-2.5 w-2.5",
                    l.status === "running"
                      ? "animate-spin"
                      : ""
                  )}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "font-semibold font-mono leading-none text-foreground",
                      isActive
                        ? "text-[10px]"
                        : "text-[9px]"
                    )}
                  >
                    {l.agent}
                  </span>

                  <span
                    className={cn(
                      "rounded px-1 py-0.5 font-mono uppercase tracking-wide",
                      si.bg,
                      si.color,
                      isActive
                        ? "text-[7px]"
                        : "text-[6px]"
                    )}
                  >
                    {l.status}
                  </span>
                </div>

                {isActive && (
                  <p className="mt-0.5 truncate text-[9px] leading-tight text-muted-foreground">
                    {l.action}
                  </p>
                )}
              </div>

              {isActive && (
                <span className="shrink-0 text-[9px] font-mono text-muted-foreground">
                  {l.t}
                </span>
              )}
            </div>
          </motion.div>
        );
      })}

      <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
        {logs.map((_, i) => (
          <motion.div
            key={i}
            className="rounded-full bg-foreground/25"
            animate={{
              width: i === activeIdx ? 14 : 4,
              opacity:
                i === activeIdx
                  ? 0.7
                  : 0.2,
            }}
            style={{ height: 3 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card4 – AI Tools Hub
───────────────────────────────────────────── */

const NS_ICONS: Record<string, React.ElementType> = {
  chatgpt: Brain,
  gemini: Globe,
  social: SlackLogo,
  knowledge: NotionLogo,
};

const NS_COLORS: Record<
  string,
  {
    bar: string;
    dot: string;
    badge: string;
    buttonBg: string;
    buttonBorder: string;
  }
> = {
  chatgpt: {
    bar: "from-violet-500 to-violet-400",
    dot: "bg-violet-500",
    badge: "bg-violet-500/15 text-violet-400",
    buttonBg: "bg-violet-500",
    buttonBorder: "border-violet-600",
  },

  gemini: {
    bar: "from-sky-500 to-sky-400",
    dot: "bg-sky-500",
    badge: "bg-sky-500/15 text-sky-400",
    buttonBg: "bg-sky-500",
    buttonBorder: "border-sky-600",
  },

  social: {
    bar: "from-emerald-500 to-emerald-400",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400",
    buttonBg: "bg-emerald-500",
    buttonBorder: "border-emerald-600",
  },

  knowledge: {
    bar: "from-amber-500 to-amber-400",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-400",
    buttonBg: "bg-amber-500",
    buttonBorder: "border-amber-600",
  },
};

const RETRIEVAL_QUERIES = [
  {
    ns: "chatgpt",
    q: "Generate landing page copy",
    t: "0.2s",
  },
  {
    ns: "gemini",
    q: "Research market trends",
    t: "0.8s",
  },
  {
    ns: "social",
    q: "Publish social campaign",
    t: "1.6s",
  },
  {
    ns: "knowledge",
    q: "Retrieve business context",
    t: "2.1s",
  },
];

export function Card4() {
  const namespaces = [
    {
      name: "chatgpt",
      hits: 342,
      fill: 88,
    },
    {
      name: "gemini",
      hits: 218,
      fill: 62,
    },
    {
      name: "social",
      hits: 174,
      fill: 48,
    },
    {
      name: "knowledge",
      hits: 118,
      fill: 34,
    },
  ];

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(
        (prev) =>
          (prev + 1) %
          RETRIEVAL_QUERIES.length
      );
    }, 2000);

    return () =>
      clearInterval(interval);
  }, []);

  const activeNs =
    RETRIEVAL_QUERIES[tick].ns;

  const recentQueries = [0, 1, 2, 3].map(
    (offset) =>
      RETRIEVAL_QUERIES[
        (tick -
          offset +
          RETRIEVAL_QUERIES.length) %
          RETRIEVAL_QUERIES.length
      ]
  );

  return (
    <div className="flex h-full w-full gap-5 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col pr-2">
        <p className="mb-3 text-[8px] font-mono uppercase tracking-widest text-muted-foreground">
          Connected AI
        </p>

        <div className="flex flex-1 flex-col gap-3">
          {namespaces.map((ns, i) => {
            const c =
              NS_COLORS[ns.name];

            const isActive =
              ns.name === activeNs;

            const Icon =
              NS_ICONS[ns.name] ||
              Database;

            return (
              <div
                key={ns.name}
                className="group relative flex items-center gap-3"
              >
                <div
                  className={cn(
                    "relative flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[12px] border transition-all duration-500",
                    isActive
                      ? `${c.buttonBg} ${c.buttonBorder} scale-105 text-white`
                      : "border-transparent bg-white text-[#A1A1A1] dark:bg-neutral-950/80"
                  )}
                >
                  <Icon
                    size={16}
                    weight={
                      isActive
                        ? "fill"
                        : "regular"
                    }
                  />
                </div>

                <span
                  className={cn(
                    "w-16 shrink-0 text-[10px] font-mono transition-colors",
                    isActive
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {ns.name}
                </span>

                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/30">
                  <motion.div
                    className={cn(
                      "absolute bottom-0 left-0 top-0 rounded-full bg-gradient-to-r",
                      c.bar
                    )}
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${ns.fill}%`,
                      opacity:
                        isActive
                          ? 1
                          : 0.25,
                    }}
                    transition={{
                      width: {
                        duration: 1.2,
                        delay: i * 0.1,
                      },
                    }}
                  />
                </div>

                <span className="w-10 text-right text-[9px] font-mono text-muted-foreground">
                  {ns.hits}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-3">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[8px] font-mono text-muted-foreground">
            AI integrations active
          </span>
        </div>
      </div>

      <div className="w-px self-stretch bg-border/30" />

      <div className="flex w-[172px] shrink-0 flex-col">
        <p className="mb-2.5 text-[8px] font-mono uppercase tracking-widest text-muted-foreground">
          Activity
        </p>

        <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
          {recentQueries.map(
            (q, qi) => {
              const c =
                NS_COLORS[q.ns];

              return (
                <motion.div
                  key={`${q.ns}-${qi}`}
                  className="rounded-xl border border-border/40 bg-muted/20 px-2.5 py-2 dark:bg-neutral-950/80"
                  animate={{
                    opacity:
                      qi === 0
                        ? 1
                        : qi === 1
                        ? 0.8
                        : qi === 2
                        ? 0.5
                        : 0.25,
                  }}
                >
                  <div className="mb-1 flex items-center gap-1">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[6.5px] font-semibold font-mono uppercase",
                        c.badge
                      )}
                    >
                      {q.ns}
                    </span>

                    <span className="ml-auto text-[7px] font-mono text-muted-foreground/50">
                      {q.t}
                    </span>
                  </div>

                  <p className="truncate text-[8px] font-mono leading-tight text-foreground/75">
                    {q.q}
                  </p>
                </motion.div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card5 – Analytics & Growth
───────────────────────────────────────────── */

export function Card5() {
  const tools = [
    {
      name: "Conversion",
      calls: 18,
      icon: Globe,
      latency: "4.8%",
      color:
        "bg-gradient-to-b from-sky-400 to-sky-600",
      borderColor:
        "border-sky-600",
    },
    {
      name: "CAC",
      calls: 12,
      icon: TerminalWindow,
      latency: "$14",
      color:
        "bg-gradient-to-b from-emerald-400 to-emerald-600",
      borderColor:
        "border-emerald-600",
    },
    {
      name: "Leads",
      calls: 24,
      icon: FileText,
      latency: "1.2k",
      color:
        "bg-gradient-to-b from-amber-400 to-amber-600",
      borderColor:
        "border-amber-600",
    },
    {
      name: "Growth",
      calls: 31,
      icon: Brain,
      latency: "+32%",
      color:
        "bg-gradient-to-b from-violet-400 to-violet-600",
      borderColor:
        "border-violet-600",
    },
  ];

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="grid w-full grid-cols-2 gap-2">
        {tools.map((t, i) => (
          <motion.div
            key={i}
            className="group relative flex flex-col justify-between rounded-[16px] border border-border/50 bg-background p-2.5 shadow-sm transition-all duration-300 hover:border-border hover:shadow-md dark:bg-neutral-950/50"
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: i * 0.1,
            }}
          >
            <div className="flex items-start justify-between">
              <div
                className={cn(
                  "flex h-[28px] w-[28px] items-center justify-center rounded-[8px] border text-white transition-transform duration-300 group-hover:scale-105",
                  t.color,
                  t.borderColor
                )}
              >
                <t.icon
                  weight="fill"
                  className="h-3.5 w-3.5"
                />
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[12px] font-bold font-mono leading-none text-foreground">
                  {t.calls}
                </span>

                <span className="text-[7px] font-mono uppercase tracking-widest text-muted-foreground/80">
                  Score
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium font-mono tracking-tight text-foreground">
                  {t.name}
                </span>

                <span className="text-[8px] font-mono text-muted-foreground">
                  {t.latency}
                </span>
              </div>

              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                <motion.div
                  className={cn(
                    "absolute bottom-0 left-0 top-0 rounded-full",
                    t.color
                  )}
                  initial={{ width: "0%" }}
                  animate={{
                    width: `${(t.calls / 31) * 100}%`,
                  }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const CARDS = [
  {
    title: "AI Website Builder",
    description:
      "Create responsive websites from a simple prompt — structure, design and publishing handled by AI.",
    visual: <Card1 />,
    colSpan: "lg:col-span-1",
    height: "h-[320px]",
  },
  {
    title: "Marketing Engine",
    description:
      "Launch and optimize campaigns across content, paid media and social channels.",
    visual: <Card2 />,
    colSpan: "lg:col-span-1",
    height: "h-[320px]",
  },
  {
    title: "CRM & Automation",
    description:
      "Capture leads, score intent and automate intelligent follow-ups across the customer journey.",
    visual: <Card3 />,
    colSpan: "lg:col-span-1",
    height: "h-[320px]",
  },
  {
    title: "AI Tools Hub",
    description:
      "Connect leading AI models, business knowledge and marketing tools in one operating layer.",
    visual: <Card4 />,
    colSpan: "lg:col-span-2",
    height: "h-[300px]",
  },
  {
    title: "Analytics & Growth",
    description:
      "Monitor conversion, acquisition and growth signals in real time.",
    visual: <Card5 />,
    colSpan: "lg:col-span-1",
    height: "h-[300px]",
  },
];

export interface AgentBentoGridProps {
  className?: string;
}

export function AgentBentoGrid({
  className,
}: AgentBentoGridProps) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {CARDS.map((card, idx) => (
        <FeatCard
          key={idx}
          title={card.title}
          description={card.description}
          className={cn(
            card.colSpan,
            card.height
          )}
        >
          {card.visual}
        </FeatCard>
      ))}
    </div>
  );
}

export default AgentBentoGrid;