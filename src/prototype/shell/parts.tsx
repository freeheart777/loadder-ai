import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft as Forward, ArrowRight as Back } from "@phosphor-icons/react";
import { FallbackIcon, ICONS } from "./icons";
import { SHELL_COPY, TOOLS } from "./map";

/* EXPERIENCE SHELL — shared parts. Visual only, no data access. */

export function Page({ children }: { children: ReactNode }) {
  return <main className="relative mx-auto w-full max-w-[880px] px-6 py-12 sm:px-8 sm:py-16">{children}</main>;
}

export function Masthead() {
  return (
    <div className="mb-10 flex items-baseline justify-between">
      <span dir="ltr" className="text-[15px] font-semibold text-white/60">Loadder</span>
      <span className="text-[12px] text-white/20">نمونهٔ طراحی</span>
    </div>
  );
}

/**
 * The only navigation on any screen: one step back. There is no module
 * sidebar anywhere in the shell, and no persistent rail of destinations.
 */
export function BackTo({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" data-shell-back onClick={onClick} className="mb-7 inline-flex min-h-11 items-center gap-2 text-[13.5px] text-white/35 transition hover:text-white/65">
      <Back size={15} />
      {label}
    </button>
  );
}

export function Heading({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="mb-9">
      <h1 data-shell-title className="text-[27px] font-bold leading-[1.55] sm:text-[34px] sm:leading-[1.45]">{title}</h1>
      {lead && <p className="mt-5 max-w-[58ch] text-[15.5px] leading-[2] text-white/50">{lead}</p>}
    </header>
  );
}

export function Zone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section data-shell-zone={label} className="mt-11 first:mt-0">
      <h2 className="mb-5 text-[13px] font-bold tracking-wide text-white/30">{label}</h2>
      {children}
    </section>
  );
}

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#F5F5F7] px-7 text-[15px] font-bold text-[#0A0A0F]">
      {children}
      <Forward size={16} weight="bold" />
    </button>
  );
}

export function GhostButton({ children, onClick, mark }: { children: ReactNode; onClick?: () => void; mark?: string }) {
  return (
    <button type="button" data-shell-ghost={mark} onClick={onClick} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/[0.10] px-6 text-[14px] text-white/60 transition hover:border-white/25">
      {children}
    </button>
  );
}

/** Facts, stacked so the label never drifts away from its value on a wide row. */
export function Facts({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
      {items.map((fact) => (
        <div key={fact.label}>
          <dt className="text-[12.5px] text-white/35">{fact.label}</dt>
          <dd className="mt-1.5 text-[15px] text-white/85">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Zone 4, and the whole of the «می‌دانم چه لازم دارم» path. Rendered the same
 * way in both places: a tool opens because the person asked for it, never
 * because the shell decided they were ready.
 */
export function ToolGrid({ title, hint }: { title?: string; hint?: string }) {
  return (
    <div>
      {title && (
        <div className="mb-5">
          <h2 className="text-[14px] font-bold text-white/45">{title}</h2>
          {hint && <p className="mt-1.5 text-[12.5px] text-white/25">{hint}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((tool) => {
          const Icon = ICONS[tool.icon] ?? FallbackIcon;
          return (
            <Link
              key={tool.route + tool.label}
              to={tool.route}
              data-shell-tool={tool.route}
              className="group flex min-h-[60px] items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:border-white/[0.14] hover:bg-white/[0.05]"
            >
              <Icon size={18} className="shrink-0 text-white/35 transition group-hover:text-violet-200" />
              <span className="truncate text-[14px] text-white/75">{tool.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ToolsHint() {
  return <p className="mt-4 text-[12.5px] text-white/25">{SHELL_COPY.toolsHint}</p>;
}
