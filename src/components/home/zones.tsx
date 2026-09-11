import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import {
  ATTENTION_COPY, CAPABILITY_LABELS, FIRST_ACTIONS, LEARNED_COPY, PROGRESS_COPY,
  SEMANTIC_LABELS, SEMANTIC_STATES, TOOLS, TOOLS_COPY, UNKNOWN_COPY, whenLabel,
} from "../../lib/homeCopy";
import type { Finding, PreparedWork, ZoneState } from "../../lib/homeData";
import { bandLabels, reasons, safeLink, signalLabels, actionLabels, text, type Item } from "../../lib/missionControlCopy";
import { FallbackIcon, HOME_ICONS } from "./icons";

/* HOME ZONES — presentation only. No zone reads, writes or derives anything. */

export function Zone({ id, label, children }: { id?: string; label: string; children: ReactNode }) {
  return (
    <section id={id} data-zone={label} className="mt-12 first:mt-0">
      <h2 className="mb-5 text-[13px] font-bold tracking-wide text-white/30">{label}</h2>
      {children}
    </section>
  );
}

/**
 * Zone 1. One item, the first the canonical contract emitted — Home does not
 * re-rank. Everything it says about that item comes from the same vocabulary
 * tables the full attention surface uses.
 */
export function AttentionZone({ state, item }: { state: ZoneState<unknown>; item: Item | null }) {
  if (state.status === "loading") return <Muted>{ATTENTION_COPY.loading}</Muted>;
  if (state.status === "failed") return <Muted>{ATTENTION_COPY.failed}</Muted>;
  if (!item) return <UnknownState />;

  const link = safeLink(item.action.deepLink);
  const facts = item.facts.filter((fact) => fact.label !== "EVIDENCE_AUTHORITY");

  return (
    <div data-attention-item data-band={item.band} className="rounded-[26px] border border-violet-300/20 bg-gradient-to-bl from-violet-500/[0.10] via-white/[0.035] to-transparent p-6 sm:p-8">
      <span className="inline-flex min-h-8 items-center rounded-full border border-amber-200/25 bg-amber-300/[0.12] px-3 py-1 text-[12px] font-bold text-amber-50">
        {bandLabels[item.band] ?? "بررسی"}
      </span>
      <h3 className="mt-4 text-[19px] font-bold leading-[1.6] sm:text-[21px]">
        {signalLabels[item.signalId] || "یک مورد نیازمند بررسی"}
      </h3>

      {facts.length > 0 && (
        <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={`${fact.label}:${fact.sourceRef.id}`}>
              <dt className="text-[12px] text-white/35">واقعیت ثبت‌شده</dt>
              <dd className="mt-1 text-[15px] text-white/85">{text(fact.value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {item.unknown.length > 0 && (
        <p data-attention-unknown className="mt-5 text-[14px] leading-[1.9] text-amber-100/70">
          {ATTENTION_COPY.unknown}
        </p>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        {link && (
          <Link to={link} data-attention-action className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#F5F5F7] px-7 text-[15px] font-bold text-[#0A0A0F]">
            {actionLabels[item.action.label] || "بررسی مورد"}
            <ArrowLeft size={16} weight="bold" />
          </Link>
        )}
        <details data-attention-why className="min-w-0">
          <summary className="inline-flex min-h-12 cursor-pointer items-center px-2 text-[13.5px] text-white/40 underline decoration-white/15 underline-offset-[6px]">
            {ATTENTION_COPY.why}
          </summary>
          <p className="max-w-[56ch] pb-2 pt-1 text-[14px] leading-[1.9] text-white/60">
            {reasons[item.whyThisIsHere] || "این مورد بر پایه سیاست فعلی نیازمند بازبینی است."}
          </p>
        </details>
      </div>
    </div>
  );
}

/** Zone 1 with nothing in it. Not a shortage: a starting point. */
function UnknownState() {
  return (
    <div data-attention-unknown-state>
      <h3 className="text-[19px] font-bold leading-[1.65] sm:text-[21px]">{UNKNOWN_COPY.title}</h3>
      <p className="mt-4 max-w-[56ch] text-[15px] leading-[1.95] text-white/50">{UNKNOWN_COPY.lead}</p>
      <div className="mt-7 grid gap-2.5">
        {FIRST_ACTIONS.map((action) => {
          const Icon = HOME_ICONS[action.icon] ?? FallbackIcon;
          return (
            <Link
              key={action.route + action.label}
              to={action.route}
              data-first-action={action.route}
              className="group flex min-h-[68px] items-center gap-4 rounded-[20px] border border-white/[0.07] bg-white/[0.025] px-5 py-4 transition hover:border-violet-300/30 hover:bg-white/[0.05]"
            >
              <Icon size={19} className="shrink-0 text-white/35 transition group-hover:text-violet-200" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-[1.7] text-white/85">{action.label}</span>
                <span className="mt-0.5 block text-[12.5px] text-white/40">{action.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Zone 2. Prepared work only. No bar is drawn for progress nothing records. */
export function InProgressZone({ state }: { state: ZoneState<PreparedWork[]> }) {
  if (state.status === "loading") return <Muted>{ATTENTION_COPY.loading}</Muted>;
  if (state.status === "failed") return <Muted>{PROGRESS_COPY.failed}</Muted>;
  const rows = state.data ?? [];
  if (rows.length === 0) return <Muted>{PROGRESS_COPY.empty}</Muted>;
  return (
    <div className="divide-y divide-white/[0.06]">
      {rows.map((row) => (
        <div key={row.id} data-progress-row className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300/70" />
          <span className="text-[15.5px] text-white/75">
            {CAPABILITY_LABELS[row.capability] || "یک کار آماده شده"}
          </span>
          <span className="w-full text-[13px] text-white/30 sm:mr-auto sm:w-auto">{PROGRESS_COPY.waiting}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Zone 3. One recorded state per finding, and nothing beyond it. Canonical
 * findings carry no confidence today, so the boundary line is always true.
 */
export function LearnedZone({ state }: { state: ZoneState<Finding[]> }) {
  if (state.status === "loading") return <Muted>{ATTENTION_COPY.loading}</Muted>;
  if (state.status === "failed") return <Muted>{LEARNED_COPY.failed}</Muted>;
  const rows = (state.data ?? []).filter((row) => SEMANTIC_LABELS[row.semanticType] && SEMANTIC_STATES[row.state]);
  if (rows.length === 0) return <Muted>{LEARNED_COPY.empty}</Muted>;
  return (
    <div>
      <ul className="grid gap-4">
        {rows.map((row) => {
          const when = whenLabel(row.calculatedAt);
          return (
            <li key={row.id} data-learned-row className="flex gap-3">
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
              <span className="min-w-0">
                <span className="text-[16px] leading-[1.9] text-white/80">
                  {SEMANTIC_LABELS[row.semanticType]} · {SEMANTIC_STATES[row.state]}
                </span>
                {when && <span className="mt-0.5 block text-[12.5px] text-white/30">{when}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-[14px] leading-[1.9] text-amber-100/60">{LEARNED_COPY.boundary}</p>
    </div>
  );
}

/** Zone 4. The same grid the entry offers, and it waits on nothing above it. */
export function ToolsZone() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((tool) => {
          const Icon = HOME_ICONS[tool.icon] ?? FallbackIcon;
          return (
            <Link
              key={tool.route + tool.label}
              to={tool.route}
              data-home-tool={tool.route}
              className="group flex min-h-[60px] items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:border-white/[0.14] hover:bg-white/[0.05]"
            >
              <Icon size={18} className="shrink-0 text-white/35 transition group-hover:text-violet-200" />
              <span className="truncate text-[14px] text-white/75">{tool.label}</span>
            </Link>
          );
        })}
      </div>
      <p className="mt-4 text-[12.5px] text-white/25">{TOOLS_COPY.hint}</p>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-[1.9] text-white/35">{children}</p>;
}
