import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft as Forward, ArrowRight as Back, Bag, BookOpenText, ChartLineUp, FileText, Gauge, Gear, Globe,
  Hammer, InstagramLogo, Lightning, Megaphone, PencilSimple, Plant, Repeat,
  SquaresFour, UsersThree,
} from "@phosphor-icons/react";
import {
  BUILD, ENTRY_COPY, GROW, PATHS, TOOLS, type Destination, type PathId,
} from "./destinations";

/**
 * PROTOTYPE — Entry Experience V1, visual only.
 *
 * Dev-only route. No backend call, no schema, no persistence, no feature flag
 * read: choosing a path only changes a URL parameter on this page.
 *
 * The alignment it is testing: the first screen asks what the person came to do
 * rather than what Loadder can do. Two of the three answers never pass through
 * Home at all, so a person who wants a website or an advertisement is never made
 * to declare a goal, accept a plan or read a diagnosis first.
 *
 * `?path=build|grow|tool` deep-links a step, so a capture is deterministic.
 */

const ICONS: Record<string, typeof Bag> = {
  build: Hammer, grow: Plant, tool: SquaresFour,
  globe: Globe, bag: Bag, app: Lightning, book: BookOpenText, file: FileText,
  users: UsersThree, pen: PencilSimple, megaphone: Megaphone, instagram: InstagramLogo,
  chart: ChartLineUp, gauge: Gauge, repeat: Repeat, gear: Gear,
};

export default function EntryExperiencePrototype() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("path");
  const path: PathId | null = raw === "build" || raw === "grow" || raw === "tool" ? raw : null;

  const go = (next: PathId | null) => (next ? setParams({ path: next }) : setParams({}));

  return (
    <div dir="rtl" className="relative min-h-screen overflow-x-hidden bg-[#07070B] text-[#F5F5F7]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.10),transparent_66%)]" />

      <main className="relative mx-auto w-full max-w-[860px] px-6 py-12 sm:px-8 sm:py-16">
        <div className="mb-10 flex items-baseline justify-between">
          <span dir="ltr" className="text-[15px] font-semibold text-white/60">Loadder</span>
          <span className="text-[12px] text-white/20">نمونهٔ طراحی</span>
        </div>

        {path === null && <Question onPick={go} />}
        {path === "build" && <BuildStep onBack={() => go(null)} onTool={() => go("tool")} />}
        {path === "grow" && <GrowStep onBack={() => go(null)} onTool={() => go("tool")} />}
        {path === "tool" && <ToolStep onBack={() => go(null)} onBuild={() => go("build")} />}

        <p className="mt-12 border-t border-white/[0.06] pt-6 text-[13px] leading-[1.9] text-white/25">
          {ENTRY_COPY.footer}
        </p>
      </main>
    </div>
  );
}

/** Step 1. One question, three answers, nothing else on the screen. */
function Question({ onPick }: { onPick: (path: PathId) => void }) {
  return (
    <section data-entry-step="question">
      <h1 className="text-[30px] font-bold leading-[1.5] sm:text-[38px] sm:leading-[1.45]">{ENTRY_COPY.question}</h1>
      <p className="mt-5 max-w-[56ch] text-[15px] leading-[2] text-white/45">{ENTRY_COPY.lead}</p>

      <div className="mt-9 grid gap-3">
        {PATHS.map((entry) => {
          const Icon = ICONS[entry.icon];
          return (
            <button
              key={entry.id}
              type="button"
              data-entry-path={entry.id}
              onClick={() => onPick(entry.id)}
              className="group flex min-h-[92px] items-center gap-5 rounded-[24px] border border-white/[0.08] bg-white/[0.025] px-6 py-5 text-right transition hover:border-violet-300/30 hover:bg-white/[0.05]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.05] transition group-hover:bg-violet-400/15">
                <Icon size={21} className="text-white/45 transition group-hover:text-violet-200" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] font-bold leading-[1.6] sm:text-[19px]">{entry.title}</span>
                <span className="mt-1.5 block text-[13.5px] leading-[1.8] text-white/40">{entry.hint}</span>
              </span>
              <Forward size={18} className="hidden shrink-0 text-white/20 transition group-hover:text-white/50 sm:block" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Step 2-A. Make one thing. Every row opens its real route directly. */
function BuildStep({ onBack, onTool }: { onBack: () => void; onTool: () => void }) {
  return (
    <Step
      step="build"
      title={ENTRY_COPY.buildTitle}
      lead={ENTRY_COPY.buildLead}
      onBack={onBack}
      aside={<Quiet onClick={onTool}>{ENTRY_COPY.alsoTool}</Quiet>}
    >
      <div className="grid gap-2.5">
        {BUILD.map((item) => <Row key={item.route + item.label} item={item} />)}
      </div>
    </Step>
  );
}

/** Step 2-B. The one path to Home — and it states what it will not ask for. */
function GrowStep({ onBack, onTool }: { onBack: () => void; onTool: () => void }) {
  return (
    <Step
      step="grow"
      title={ENTRY_COPY.growTitle}
      lead={GROW.lead}
      onBack={onBack}
      aside={<Quiet onClick={onTool}>{ENTRY_COPY.alsoTool}</Quiet>}
    >
      <ul className="grid gap-2.5">
        {GROW.facts.map((fact) => (
          <li key={fact} className="flex items-baseline gap-3 text-[15px] leading-[1.95] text-white/65">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-emerald-300/70" />
            {fact}
          </li>
        ))}
      </ul>
      <Link
        data-entry-destination={GROW.route}
        to={GROW.route}
        className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#F5F5F7] px-7 text-[15px] font-bold text-[#0A0A0F]"
      >
        {GROW.label}
        <Forward size={17} weight="bold" />
      </Link>
    </Step>
  );
}

/** Step 2-C. Direct access, ungated. */
function ToolStep({ onBack, onBuild }: { onBack: () => void; onBuild: () => void }) {
  return (
    <Step
      step="tool"
      title={ENTRY_COPY.toolTitle}
      lead={ENTRY_COPY.toolLead}
      onBack={onBack}
      aside={<Quiet onClick={onBuild}>{ENTRY_COPY.alsoBuild}</Quiet>}
    >
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((item) => <Row key={item.route + item.label} item={item} />)}
      </div>
    </Step>
  );
}

function Step({
  step, title, lead, onBack, aside, children,
}: {
  step: PathId; title: string; lead: string; onBack: () => void; aside: ReactNode; children: ReactNode;
}) {
  return (
    <section data-entry-step={step}>
      <button type="button" data-entry-back onClick={onBack} className="mb-7 inline-flex min-h-11 items-center gap-2 text-[13.5px] text-white/35 transition hover:text-white/65">
        <Back size={15} />
        {ENTRY_COPY.back}
      </button>
      <h1 className="text-[26px] font-bold leading-[1.55] sm:text-[31px]">{title}</h1>
      <p className="mt-4 max-w-[58ch] text-[15px] leading-[2] text-white/45">{lead}</p>
      <div className="mt-8">{children}</div>
      <div className="mt-8">{aside}</div>
    </section>
  );
}

function Row({ item }: { item: Destination }) {
  const Icon = ICONS[item.icon] ?? Bag;
  return (
    <Link
      to={item.route}
      data-entry-destination={item.route}
      className="group flex min-h-[72px] items-center gap-4 rounded-[20px] border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition hover:border-white/[0.15] hover:bg-white/[0.05]"
    >
      <Icon size={19} className="shrink-0 text-white/35 transition group-hover:text-violet-200" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-[1.7] text-white/85">{item.label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-[1.7] text-white/45">{item.hint}</span>
      </span>
      <Forward size={16} className="hidden shrink-0 text-white/15 transition group-hover:text-white/40 sm:block" />
    </Link>
  );
}

function Quiet({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" data-entry-switch onClick={onClick} className="inline-flex min-h-11 items-center text-[13.5px] text-white/35 underline decoration-white/15 underline-offset-[6px] transition hover:text-white/65">
      {children}
    </button>
  );
}
