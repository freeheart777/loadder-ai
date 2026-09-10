import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft as Forward, Bag, ChartLineUp, ChatCircleDots, Globe, MagnifyingGlass,
  Megaphone, PencilSimple, UsersThree,
} from "@phosphor-icons/react";
import {
  FIRST_ACTIONS, GROWTH_COPY, KNOWN, NOT_YET, PROCESS, SUGGESTION, TOOLS,
  type FirstAction, type StateId,
} from "./content";

/**
 * PROTOTYPE — Growth Entry V1, visual only.
 *
 * Dev-only. Fixture copy, no canonical API, no mutation, no persistence.
 *
 * This is where the growth path lands before Home has anything to say. The
 * design claim it tests: a page with nothing on it yet is not an empty page,
 * it is the first page of a relationship. So it never reports a shortage. It
 * says what Loadder does not know yet, offers the smallest way to fix that,
 * and shows the same three steps it will always follow.
 *
 * The two states share one spine — same heading slot, same process strip, same
 * tools row — so a returning person recognises the page they started on rather
 * than being moved to a different screen once data exists.
 *
 * `?state=new|returning` deep-links a state, so a capture is deterministic.
 */

const ICONS: Record<string, typeof Bag> = {
  globe: Globe, chat: ChatCircleDots, search: MagnifyingGlass,
  users: UsersThree, pen: PencilSimple, megaphone: Megaphone, bag: Bag, chart: ChartLineUp,
};

export default function GrowthEntryPrototype() {
  const [params] = useSearchParams();
  const state: StateId = params.get("state") === "returning" ? "returning" : "new";
  const isNew = state === "new";

  return (
    <div dir="rtl" className="relative min-h-screen overflow-x-hidden bg-[#07070B] text-[#F5F5F7]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.10),transparent_66%)]" />

      <main data-growth-state={state} className="relative mx-auto w-full max-w-[880px] px-6 py-12 sm:px-8 sm:py-16">
        <div className="mb-10 flex items-baseline justify-between">
          <span dir="ltr" className="text-[15px] font-semibold text-white/60">Loadder</span>
          <span className="text-[12px] text-white/20">نمونهٔ طراحی</span>
        </div>

        <header className="mb-9">
          <h1 data-growth-title className="text-[27px] font-bold leading-[1.55] sm:text-[34px] sm:leading-[1.45]">
            {isNew ? GROWTH_COPY.newTitle : GROWTH_COPY.returningTitle}
          </h1>
          <p className="mt-5 max-w-[58ch] text-[15.5px] leading-[2] text-white/50">
            {isNew ? GROWTH_COPY.newLead : GROWTH_COPY.returningLead}
          </p>
        </header>

        {isNew ? <FirstMove /> : <Knowledge />}

        <Process active={isNew ? 0 : 2} />

        <p data-growth-safety className="mt-8 rounded-2xl bg-white/[0.02] px-5 py-4 text-[13.5px] leading-[1.9] text-white/40">
          {GROWTH_COPY.safety}
        </p>

        <Tools />
      </main>
    </div>
  );
}

/** State A. Three ways in, cheapest first, each with its price and its payback. */
function FirstMove() {
  return (
    <section data-growth-block="first-move">
      <h2 className="mb-5 text-[13px] font-bold text-white/30">{GROWTH_COPY.newActions}</h2>
      <div className="grid gap-2.5">
        {FIRST_ACTIONS.map((action) => <ActionCard key={action.label} action={action} />)}
      </div>
    </section>
  );
}

function ActionCard({ action }: { action: FirstAction }) {
  const Icon = ICONS[action.icon] ?? Globe;
  return (
    <button
      type="button"
      data-growth-action
      className="group flex w-full items-start gap-4 rounded-[22px] border border-white/[0.08] bg-white/[0.025] px-5 py-5 text-right transition hover:border-violet-300/30 hover:bg-white/[0.05]"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] transition group-hover:bg-violet-400/15">
        <Icon size={18} className="text-white/45 transition group-hover:text-violet-200" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16.5px] font-bold leading-[1.65]">{action.label}</span>
        <span className="mt-1.5 block text-[13.5px] leading-[1.85] text-white/45">{action.hint}</span>
        <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          <span className="text-white/30">{action.cost}</span>
          <span className="text-white/15" aria-hidden="true">·</span>
          <span className="text-emerald-200/70">{action.promise}</span>
        </span>
      </span>
      <Forward size={17} className="mt-2 hidden shrink-0 text-white/20 transition group-hover:text-white/50 sm:block" />
    </button>
  );
}

/** State B. What was learned, what was not, and one thing to decide. */
function Knowledge() {
  return (
    <section data-growth-block="knowledge">
      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <div>
          <h2 className="text-[13px] font-bold text-white/30">{GROWTH_COPY.knownLabel}</h2>
          <ul className="mt-3.5 grid gap-3">
            {KNOWN.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-[1.9] text-white/80">
                <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[13px] font-bold text-white/30">{GROWTH_COPY.notYetLabel}</h2>
          <ul className="mt-3.5 grid gap-3">
            {NOT_YET.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-[1.9] text-amber-100/70">
                <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full border border-amber-200/50" />
                {line}
              </li>
            ))}
          </ul>
          <button type="button" data-growth-more className="mt-4 inline-flex min-h-11 items-center text-[13.5px] text-white/35 underline decoration-white/15 underline-offset-[6px] transition hover:text-white/65">
            {GROWTH_COPY.more}
          </button>
        </div>
      </div>

      <div data-growth-suggestion className="mt-9 rounded-[26px] border border-violet-300/20 bg-gradient-to-bl from-violet-500/[0.10] via-white/[0.035] to-transparent p-7 sm:p-8">
        <h3 className="text-[20px] font-bold leading-[1.6] sm:text-[22px]">{SUGGESTION.title}</h3>
        <p className="mt-4 max-w-[54ch] text-[15px] leading-[1.95] text-white/60">{SUGGESTION.because}</p>
        <p className="mt-5 text-[14px] text-white/40">{SUGGESTION.ask}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#F5F5F7] px-7 text-[15px] font-bold text-[#0A0A0F]">
            {SUGGESTION.yes}
            <Forward size={16} weight="bold" />
          </button>
          <button type="button" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/[0.10] px-6 text-[14px] text-white/60">
            {SUGGESTION.no}
          </button>
        </div>
        <p className="mt-6 border-t border-white/[0.07] pt-5 text-[13px] leading-[1.85] text-white/35">{SUGGESTION.consequence}</p>
      </div>
    </section>
  );
}

/** Observe → Understand → Suggest. The same three steps in both states. */
function Process({ active }: { active: number }) {
  return (
    <section data-growth-process className="mt-12 border-t border-white/[0.06] pt-8">
      <h2 className="mb-5 text-[13px] font-bold text-white/30">{GROWTH_COPY.processLabel}</h2>
      <ol className="grid gap-2.5 sm:grid-cols-3">
        {PROCESS.map((step, index) => {
          const here = index === active;
          return (
            <li
              key={step.title}
              data-growth-step={index}
              data-here={here || undefined}
              className={`rounded-2xl border px-5 py-4 ${here ? "border-violet-300/30 bg-violet-400/[0.07]" : "border-white/[0.06] bg-white/[0.015]"}`}
            >
              <div className={`text-[15px] font-bold ${here ? "text-white" : "text-white/55"}`}>{step.title}</div>
              <div className="mt-1.5 text-[12.5px] leading-[1.8] text-white/35">{step.note}</div>
              {here && <div className="mt-2.5 text-[11.5px] text-violet-200/80">{GROWTH_COPY.here}</div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** A shortcut is not a gate: every tool stays reachable on both states. */
function Tools() {
  return (
    <section data-growth-tools className="mt-12 border-t border-white/[0.06] pt-8">
      <div className="mb-5">
        <h2 className="text-[14px] font-bold text-white/45">{GROWTH_COPY.toolsTitle}</h2>
        <p className="mt-1.5 text-[12.5px] text-white/25">{GROWTH_COPY.toolsHint}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = ICONS[tool.icon] ?? Bag;
          return (
            <Link
              key={tool.route + tool.label}
              to={tool.route}
              data-growth-tool={tool.route}
              className="group flex min-h-[60px] items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:border-white/[0.14] hover:bg-white/[0.05]"
            >
              <Icon size={18} className="shrink-0 text-white/35 transition group-hover:text-violet-200" />
              <span className="text-[14px] text-white/75">{tool.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
