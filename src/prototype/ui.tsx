import type { ReactNode } from "react";
import {
  ArrowLeft, Bag, Lightning, BookOpenText, ChartLineUp, Check, FileText, Gauge, Gear, Globe,
  InstagramLogo, Megaphone, PencilSimple, Repeat, UsersThree, X,
} from "@phosphor-icons/react";
import { CONFIDENCE_LABEL, type Confidence, type Tool } from "./fixtures";

/* PROTOTYPE UI PRIMITIVES — visual only, no data access, no navigation side effects. */

const ICONS: Record<string, typeof Bag> = {
  users: UsersThree, pen: PencilSimple, globe: Globe, bag: Bag, chart: ChartLineUp,
  megaphone: Megaphone, book: BookOpenText, bolt: Lightning, instagram: InstagramLogo,
  file: FileText, repeat: Repeat, gear: Gear, gauge: Gauge,
};

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="relative min-h-screen overflow-x-hidden bg-[#07070B] text-[#F5F5F7]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.13),transparent_65%)]" />
      <div className="relative mx-auto w-full max-w-[880px] px-6 py-12 sm:px-8 sm:py-16">{children}</div>
    </div>
  );
}

export function Brand({ note }: { note?: string }) {
  return (
    <div className="mb-12 flex items-center justify-between">
      <div dir="ltr" className="text-[15px] font-semibold tracking-tight text-white/70">Loadder</div>
      {note && <div className="text-[13px] text-white/30">{note}</div>}
    </div>
  );
}

/** The one dominant sentence on a screen. */
export function Hero({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-10">
      <h1 className="text-[30px] font-bold leading-[1.5] tracking-tight sm:text-[38px] sm:leading-[1.45]">{children}</h1>
      {sub && <p className="mt-5 max-w-[62ch] text-[16px] leading-[2] text-white/50">{sub}</p>}
    </header>
  );
}

export function Card({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "lifted" | "quiet" }) {
  const styles = {
    plain: "border-white/[0.07] bg-white/[0.028]",
    lifted: "border-violet-300/20 bg-gradient-to-bl from-violet-500/[0.10] via-white/[0.035] to-transparent",
    quiet: "border-white/[0.05] bg-white/[0.015]",
  }[tone];
  return <section className={`rounded-[28px] border p-7 sm:p-9 ${styles}`}>{children}</section>;
}

const TONE = {
  saw: { dot: "bg-emerald-300", text: "text-emerald-200/90" },
  think: { dot: "bg-violet-300", text: "text-violet-200/90" },
  unknown: { dot: "bg-amber-300/80", text: "text-amber-200/90" },
} as const;

/** Confidence is shown by everyday words and colour, never by architecture vocabulary. */
export function ConfidenceLine({ tone, children }: { tone: Confidence; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <div className="flex gap-4 py-4">
      <span className="mt-[10px] flex shrink-0 flex-col items-center">
        <span className={`h-2 w-2 rounded-full ${t.dot} ${tone === "unknown" ? "opacity-70" : ""}`} />
      </span>
      <div className="min-w-0">
        <div className={`text-[12px] font-bold ${t.text}`}>{CONFIDENCE_LABEL[tone]}</div>
        <p className="mt-1.5 text-[16px] leading-[1.95] text-white/80">{children}</p>
      </div>
    </div>
  );
}

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#F5F5F7] px-7 text-[15px] font-bold text-[#0A0A0F]">
      {children}
      <ArrowLeft size={17} weight="bold" />
    </button>
  );
}

export function GhostButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/[0.10] px-6 text-[14px] text-white/65">
      {children}
    </button>
  );
}

export function QuietButton({ children }: { children: ReactNode }) {
  return <button type="button" className="inline-flex min-h-12 items-center px-2 text-[14px] text-white/40">{children}</button>;
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>;
}

/** A number never appears without the sentence that interprets it. */
export function Figures({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-12 gap-y-6">
      {items.map((n) => (
        <div key={n.label}>
          <div className="text-[40px] font-bold leading-none tracking-tight">{n.value}</div>
          <div className="mt-2.5 text-[14px] text-white/45">{n.label}</div>
        </div>
      ))}
    </div>
  );
}

export function StepRow({ state, text, detail }: { state: "done" | "waiting" | "next"; text: string; detail?: string }) {
  const mark =
    state === "done" ? <Check size={13} weight="bold" className="text-emerald-300" />
      : state === "waiting" ? <span className="h-2 w-2 rounded-full bg-amber-300" />
        : <span className="h-2 w-2 rounded-full border border-white/25" />;
  return (
    <div className="flex items-center gap-4 py-3.5">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${state === "done" ? "bg-emerald-400/12" : state === "waiting" ? "bg-amber-400/12" : ""}`}>{mark}</span>
      <span className={`text-[16px] ${state === "next" ? "text-white/35" : state === "waiting" ? "font-bold text-white" : "text-white/70"}`}>{text}</span>
      {detail && <span className="mr-auto text-[13px] text-white/30">{detail}</span>}
    </div>
  );
}

/** Zone 4. Lower visual priority than the decision surface, never hidden. */
export function ToolSection({ tools, title = "ابزارهای کسب‌وکار", footer }: { tools: Tool[]; title?: string; footer?: ReactNode }) {
  return (
    <section data-zone="tools" className="mt-14 border-t border-white/[0.06] pt-9">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold text-white/45">{title}</h2>
        <span className="text-[13px] text-white/25">مستقیم باز کنید</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {tools.map((tool) => {
          const Icon = ICONS[tool.icon] ?? Bag;
          return (
            <a key={tool.fa} href={tool.route} data-tool className="group flex min-h-[68px] items-center gap-3.5 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:border-white/[0.12] hover:bg-white/[0.05]">
              <Icon size={19} className="shrink-0 text-white/35 transition group-hover:text-violet-200" />
              <span className="min-w-0">
                <span className="block truncate text-[14px] text-white/75">{tool.fa}</span>
                {tool.en && <span dir="ltr" className="block truncate text-left text-[11px] text-white/25">{tool.en}</span>}
              </span>
            </a>
          );
        })}
      </div>
      {footer && <div className="mt-5">{footer}</div>}
    </section>
  );
}

/** Permission is a gate on one action, never a stage and never a blanket approval. */
export function PermissionBlock({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-white/[0.06]">
      {facts.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-6 py-4">
          <dt className="shrink-0 text-[14px] text-white/40">{f.label}</dt>
          <dd className="text-left text-[16px] text-white/90">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PostureBar({ items }: { items: { text: string; allowed: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 rounded-2xl bg-white/[0.02] px-5 py-4">
      <span className="text-[13px] text-white/35">الان اجازه دارم:</span>
      {items.map((i) => (
        <span key={i.text} className={`inline-flex items-center gap-1.5 text-[13px] ${i.allowed ? "text-emerald-200/85" : "text-white/30"}`}>
          {i.allowed ? <Check size={13} weight="bold" /> : <X size={13} weight="bold" />}
          {i.text}
        </span>
      ))}
    </div>
  );
}

export function Zone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="mb-5 text-[13px] font-bold tracking-wide text-white/30">{label}</h2>
      {children}
    </section>
  );
}
