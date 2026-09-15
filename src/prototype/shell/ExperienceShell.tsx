import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft as Forward } from "@phosphor-icons/react";
import {
  ATTENTION, BRAIN, DETAIL, FIRST_ACTIONS, IN_PROGRESS, LEARNED, PATHS,
  PAST_DECISIONS, PROCESS, SHELL_COPY, toScreen, type ScreenId,
} from "./map";
import { ICONS } from "./icons";
import {
  BackTo, Facts, GhostButton, Heading, Masthead, Page, PrimaryButton,
  ToolGrid, ToolsHint, Zone,
} from "./parts";

/**
 * PROTOTYPE — Loadder Experience Shell V1.
 *
 * Dev-only, frontend only: fixture copy, no canonical API, no mutation, no
 * schema, no business logic. It exists to walk the approved Experience Map end
 * to end in a browser.
 *
 * What the shell asserts structurally, not in words:
 *   · The first screen admits it knows nothing, and offers three ways out of that.
 *   · Home is the centre once Loadder understands something, and holds exactly
 *     four zones in a fixed order.
 *   · Direct tool access is never gated: the same grid is one of the three first
 *     answers AND zone four of Home.
 *   · No tool is the primary experience — tools sit last on Home, under the
 *     decision.
 *   · The Brain is a static entry point that asks for nothing.
 *   · The Decision Room is reachable from a detail view and from nowhere else.
 *   · There is no module sidebar on any screen — the shell renders no <nav>
 *     and no <aside> at all.
 *
 * `?screen=entry|tools|growth|home|detail|brain` deep-links a step.
 */
export default function ExperienceShell() {
  const [params, setParams] = useSearchParams();
  const screen = toScreen(params.get("screen"));
  const go = (next: ScreenId) => setParams(next === "entry" ? {} : { screen: next });

  return (
    <div dir="rtl" className="relative min-h-screen overflow-x-hidden bg-[#07070B] text-[#F5F5F7]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.10),transparent_66%)]" />
      <div data-shell-screen={screen}>
        {screen === "entry" && <Entry go={go} />}
        {screen === "tools" && <Tools go={go} />}
        {screen === "growth" && <Growth go={go} />}
        {screen === "home" && <Home go={go} />}
        {screen === "detail" && <Detail go={go} />}
        {screen === "brain" && <Brain go={go} />}
      </div>
    </div>
  );
}

type Go = (next: ScreenId) => void;

/** First entry. One admission, three answers. */
function Entry({ go }: { go: Go }) {
  return (
    <Page>
      <Masthead />
      <Heading title={SHELL_COPY.entryTitle} lead={SHELL_COPY.entryLead} />
      <div className="grid gap-3">
        {PATHS.map((path) => {
          const Icon = ICONS[path.icon];
          return (
            <button
              key={path.id}
              type="button"
              data-shell-path={path.id}
              onClick={() => go(path.id)}
              className="group flex min-h-[88px] items-center gap-5 rounded-[24px] border border-white/[0.08] bg-white/[0.025] px-6 py-5 text-right transition hover:border-violet-300/30 hover:bg-white/[0.05]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.05] transition group-hover:bg-violet-400/15">
                <Icon size={20} className="text-white/45 transition group-hover:text-violet-200" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17.5px] font-bold leading-[1.6] sm:text-[19px]">{path.title}</span>
                <span className="mt-1.5 block text-[13.5px] leading-[1.8] text-white/40">{path.hint}</span>
              </span>
              <Forward size={18} className="hidden shrink-0 text-white/20 transition group-hover:text-white/50 sm:block" />
            </button>
          );
        })}
      </div>
    </Page>
  );
}

/** Path 1. Capability, opened directly. No goal, no plan, no diagnosis first. */
function Tools({ go }: { go: Go }) {
  return (
    <Page>
      <Masthead />
      <BackTo label={SHELL_COPY.backEntry} onClick={() => go("entry")} />
      <Heading title={SHELL_COPY.toolsTitle} lead={SHELL_COPY.toolsLead} />
      <ToolGrid />
      <button type="button" data-shell-to-home onClick={() => go("home")} className="mt-9 inline-flex min-h-11 items-center text-[13.5px] text-white/35 underline decoration-white/15 underline-offset-[6px] transition hover:text-white/65">
        {SHELL_COPY.toolsToHome}
      </button>
    </Page>
  );
}

/** Path 3. «نمی‌دانم» — get understood first, then Home becomes the centre. */
function Growth({ go }: { go: Go }) {
  return (
    <Page>
      <Masthead />
      <BackTo label={SHELL_COPY.backEntry} onClick={() => go("entry")} />
      <Heading title={SHELL_COPY.growthTitle} lead={SHELL_COPY.growthLead} />

      <div className="grid gap-2.5">
        {FIRST_ACTIONS.map((action) => {
          const Icon = ICONS[action.icon] ?? ICONS.globe;
          return (
            <button key={action.label} type="button" data-shell-first-action className="group flex w-full items-center gap-4 rounded-[22px] border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-right transition hover:border-violet-300/30 hover:bg-white/[0.05]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] transition group-hover:bg-violet-400/15">
                <Icon size={17} className="text-white/45 transition group-hover:text-violet-200" />
              </span>
              <span className="min-w-0 flex-1 text-[15.5px] leading-[1.7] text-white/85">{action.label}</span>
              <span className="shrink-0 text-[12.5px] text-white/30">{action.cost}</span>
            </button>
          );
        })}
      </div>

      <section data-shell-process className="mt-11 border-t border-white/[0.06] pt-8">
        <h2 className="mb-5 text-[13px] font-bold text-white/30">{SHELL_COPY.growthProcess}</h2>
        <ol className="grid gap-2.5 sm:grid-cols-3">
          {PROCESS.map((step, index) => (
            <li key={step.title} data-shell-step={index} className={`rounded-2xl border px-5 py-4 ${index === 0 ? "border-violet-300/30 bg-violet-400/[0.07]" : "border-white/[0.06] bg-white/[0.015]"}`}>
              <div className={`text-[15px] font-bold ${index === 0 ? "text-white" : "text-white/55"}`}>{step.title}</div>
              <div className="mt-1.5 text-[12.5px] leading-[1.8] text-white/35">{step.note}</div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[13.5px] leading-[1.9] text-white/40">{SHELL_COPY.growthAfter}</p>
        <button type="button" data-shell-to-home onClick={() => go("home")} className="mt-3 inline-flex min-h-11 items-center text-[13.5px] text-white/60 underline decoration-white/20 underline-offset-[6px] transition hover:text-white">
          {SHELL_COPY.growthToHome}
        </button>
      </section>

      <section className="mt-11 border-t border-white/[0.06] pt-8">
        <ToolGrid title={SHELL_COPY.zoneTools} hint={SHELL_COPY.toolsHint} />
      </section>
    </Page>
  );
}

/** The centre after first understanding. Exactly four zones, in this order. */
function Home({ go }: { go: Go }) {
  return (
    <Page>
      <Masthead />
      <BackTo label={SHELL_COPY.backEntry} onClick={() => go("entry")} />
      <Heading title={SHELL_COPY.homeTitle} lead={SHELL_COPY.homeLead} />

      <Zone label={SHELL_COPY.zoneAttention}>
        <div data-shell-attention className="rounded-[26px] border border-violet-300/20 bg-gradient-to-bl from-violet-500/[0.10] via-white/[0.035] to-transparent p-7 sm:p-8">
          <h3 className="text-[19px] font-bold leading-[1.6] sm:text-[21px]">{ATTENTION.title}</h3>
          <p className="mt-4 max-w-[54ch] text-[15px] leading-[1.95] text-white/60">{ATTENTION.belief}</p>
          <p className="mt-5 text-[14px] text-white/40">{ATTENTION.ask}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton>{ATTENTION.yes}</PrimaryButton>
            <GhostButton>{ATTENTION.no}</GhostButton>
            <button type="button" data-shell-why onClick={() => go("detail")} className="inline-flex min-h-12 items-center px-2 text-[13.5px] text-white/40 underline decoration-white/15 underline-offset-[6px] transition hover:text-white/70">
              {ATTENTION.why}
            </button>
          </div>
          <p className="mt-6 border-t border-white/[0.07] pt-5 text-[13px] leading-[1.85] text-white/35">{ATTENTION.consequence}</p>
        </div>
      </Zone>

      <Zone label={SHELL_COPY.zoneProgress}>
        <div className="divide-y divide-white/[0.06]">
          {IN_PROGRESS.map((item) => (
            <div key={item.label} className="flex items-center gap-4 py-4">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300/70" />
              <span className="text-[15.5px] text-white/75">{item.label}</span>
              <span className="mr-auto text-[13px] text-white/30">{item.detail}</span>
            </div>
          ))}
        </div>
      </Zone>

      <Zone label={SHELL_COPY.zoneLearned}>
        <p className="text-[16px] leading-[1.95] text-white/80">{LEARNED.line}</p>
        <p className="mt-2.5 text-[14px] leading-[1.9] text-amber-100/65">{LEARNED.boundary}</p>
        <button type="button" data-shell-brain-entry onClick={() => go("brain")} className="mt-5 flex w-full flex-col items-start gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4 text-right transition hover:border-white/[0.14] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="text-[14px] text-white/70">{SHELL_COPY.brainEntry}</span>
          <span className="shrink-0 text-[12px] text-white/30">{SHELL_COPY.brainEntryHint}</span>
        </button>
      </Zone>

      <Zone label={SHELL_COPY.zoneTools}>
        <ToolGrid />
        <ToolsHint />
      </Zone>
    </Page>
  );
}

/** The detail behind the decision — and the only way through to past decisions. */
function Detail({ go }: { go: Go }) {
  return (
    <Page>
      <Masthead />
      <BackTo label={SHELL_COPY.backHome} onClick={() => go("home")} />
      <Heading title={SHELL_COPY.detailTitle} />

      <p className="text-[17px] font-bold leading-[1.8]">{ATTENTION.title}</p>

      <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <div>
          <h2 className="text-[13px] font-bold text-white/30">{SHELL_COPY.detailSaw}</h2>
          <ul className="mt-3.5 grid gap-3">
            {DETAIL.saw.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-[1.9] text-white/80">
                <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[13px] font-bold text-white/30">{SHELL_COPY.detailUnknown}</h2>
          <ul className="mt-3.5 grid gap-3">
            {DETAIL.unknown.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-[1.9] text-amber-100/70">
                <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full border border-amber-200/50" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="mt-10 rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 sm:p-7">
        <h2 className="mb-5 text-[13px] font-bold text-white/30">{SHELL_COPY.detailPermission}</h2>
        <Facts items={DETAIL.permission} />
      </section>

      <div className="mt-9 border-t border-white/[0.06] pt-6">
        <Link data-shell-past-decisions to={PAST_DECISIONS.route} className="inline-flex min-h-11 items-center gap-2 text-[14px] text-cyan-300 transition hover:text-cyan-200">
          {PAST_DECISIONS.label}
          <Forward size={15} />
        </Link>
      </div>
    </Page>
  );
}

/** A static entry point. It shows, it does not ask. */
function Brain({ go }: { go: Go }) {
  return (
    <Page>
      <Masthead />
      <BackTo label={SHELL_COPY.backHome} onClick={() => go("home")} />
      <Heading title={SHELL_COPY.brainTitle} lead={SHELL_COPY.brainLead} />

      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <div>
          <h2 className="text-[13px] font-bold text-white/30">{SHELL_COPY.brainKnown}</h2>
          <ul className="mt-3.5 grid gap-3">
            {BRAIN.known.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-[1.9] text-white/80">
                <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[13px] font-bold text-white/30">{SHELL_COPY.brainUnknown}</h2>
          <ul className="mt-3.5 grid gap-3">
            {BRAIN.unknown.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-[1.9] text-amber-100/70">
                <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full border border-amber-200/50" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-9 text-[13.5px] text-white/30">{SHELL_COPY.brainStatic}</p>
    </Page>
  );
}
