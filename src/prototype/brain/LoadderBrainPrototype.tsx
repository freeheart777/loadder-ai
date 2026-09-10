import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BrainCanvas from "./BrainCanvas";
import {
  BRAIN_COPY, CONFIDENCE_LABEL, KIND_LABEL, neighbours, type BrainNode,
} from "./fixtures";

/**
 * PROTOTYPE — Loadder Brain V2, visual only.
 *
 * Dev-only. Fixture data, no canonical API, no mutation.
 *
 * The Brain informs and never decides: there is no primary action anywhere on
 * this page, and the only links out go to Home, which asks for the decision, and
 * to the existing Decision Room, which explains decisions already taken.
 *
 * `?view=simple|deep`, `?chrome=0` to hide the switcher, `?motion=0` to freeze.
 */
export default function LoadderBrainPrototype() {
  const [params, setParams] = useSearchParams();
  const deep = params.get("view") === "deep";
  const chrome = params.get("chrome") !== "0";
  const frozen = params.get("motion") === "0";
  const [selected, setSelected] = useState<BrainNode | null>(null);

  return (
    <div dir="rtl" className="relative min-h-screen overflow-x-hidden bg-[#07070B] text-[#F5F5F7]">
      <style>{BRAIN_MOTION_CSS}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.09),transparent_66%)]" />

      {chrome && (
        <nav className="relative flex flex-wrap gap-1.5 border-b border-white/[0.07] px-4 py-3">
          {[{ id: "simple", label: BRAIN_COPY.simple }, { id: "deep", label: BRAIN_COPY.deep }].map((entry) => (
            <button
              key={entry.id} type="button"
              onClick={() => { setParams({ view: entry.id }); setSelected(null); }}
              className={`min-h-9 rounded-xl px-3 text-[12px] transition ${(entry.id === "deep") === deep ? "bg-white/[0.10] text-white" : "text-white/40 hover:text-white/70"}`}
            >
              {entry.label}
            </button>
          ))}
          <span className="mr-auto self-center px-2 text-[11px] text-white/20">نمونهٔ طراحی · دادهٔ نمایشی</span>
        </nav>
      )}

      <main className="relative mx-auto w-full max-w-[920px] px-6 py-10 sm:px-8 sm:py-14">
        <header className="mb-8">
          <div dir="ltr" className="text-[14px] font-semibold text-white/50">Loadder</div>
          <h1 className="mt-5 text-[26px] font-bold leading-[1.5] sm:text-[32px]">{BRAIN_COPY.title}</h1>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-[2] text-white/45">{BRAIN_COPY.lead}</p>
        </header>

        <p data-brain-summary className="mb-6 text-[17px] leading-[1.9] text-white/75">
          {deep ? BRAIN_COPY.summaryDeep : BRAIN_COPY.summarySimple}
        </p>

        <div className="rounded-[28px] border border-white/[0.07] bg-white/[0.012] p-2 sm:p-4">
          <BrainCanvas frozen={frozen} selectable={deep} selectedId={selected?.id ?? null} onSelect={setSelected} />
        </div>

        <Legend />

        <p className="mt-4 px-1 text-[13px] leading-[1.9] text-white/30">{BRAIN_COPY.incomplete}</p>
        <p className="mt-1.5 px-1 text-[13px] leading-[1.9] text-white/30">{BRAIN_COPY.unknownNote}</p>

        {deep && (
          <section data-brain-panel className="mt-8 rounded-[26px] border border-white/[0.07] bg-white/[0.02] p-6 sm:p-7">
            {!selected && <p className="text-[15px] text-white/35">{BRAIN_COPY.panelEmpty}</p>}
            {selected && (
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-[19px] font-bold">{selected.label || "یک چیز ناشناخته"}</h2>
                  <span className="text-[12px] text-white/35">{KIND_LABEL[selected.kind]}</span>
                  {selected.confidence && <span className="text-[12px] text-violet-200/70">{CONFIDENCE_LABEL[selected.confidence]}</span>}
                </div>

                <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
                  <div>
                    <div className="text-[12px] text-white/35">{BRAIN_COPY.panelHistory}</div>
                    <ol className="mt-2.5 space-y-2.5">
                      {(selected.history ?? []).map((entry) => (
                        <li key={entry.when + entry.what} className="flex gap-3">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/25" />
                          <span className="text-[14px] leading-[1.85] text-white/75">
                            <span className="text-white/35">{entry.when} · </span>{entry.what}
                          </span>
                        </li>
                      ))}
                      {(selected.history ?? []).length === 0 && <li className="text-[14px] text-white/35">—</li>}
                    </ol>
                  </div>
                  <div>
                    <div className="text-[12px] text-white/35">{BRAIN_COPY.panelGap}</div>
                    <p className="mt-2.5 text-[14px] leading-[1.85] text-amber-200/75">{selected.gap ?? "—"}</p>
                    <div className="mt-6 text-[12px] text-white/35">{BRAIN_COPY.panelLinks}</div>
                    <p className="mt-2.5 text-[14px] leading-[1.85] text-white/70">{neighbours(selected.id).join(" · ") || BRAIN_COPY.noLinks}</p>
                  </div>
                </div>

                {selected.decisionRoom && (
                  <div className="mt-7 border-t border-white/[0.06] pt-5">
                    <div className="text-[12px] text-white/35">{BRAIN_COPY.panelDecision}</div>
                    <Link data-decision-room to={selected.decisionRoom.href} className="mt-2 inline-flex min-h-11 items-center text-[14px] text-cyan-300">
                      {selected.decisionRoom.label}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <Roles />
      </main>
    </div>
  );
}

function Legend() {
  return (
    <div data-brain-legend className="mt-6 grid gap-x-8 gap-y-3 px-1 text-[12.5px] sm:grid-cols-2">
      <span className="inline-flex items-center gap-2.5 text-white/70">
        <span className="h-3 w-6 shrink-0 rounded-full bg-white/[0.92]" />{KIND_LABEL.human}
      </span>
      <span className="inline-flex items-center gap-2.5 text-white/60">
        <span className="h-3 w-6 shrink-0 rounded-full border border-white/25" /><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />{KIND_LABEL.observed}</span>
      </span>
      <span className="inline-flex items-center gap-2.5 text-violet-100/70">
        <span className="h-3 w-6 shrink-0 rounded-full border border-violet-300/35 bg-violet-400/[0.09]" />{KIND_LABEL.belief}
      </span>
      <span className="inline-flex items-center gap-2.5 text-white/40">
        <span className="h-3 w-6 shrink-0 rounded-full border border-dashed border-white/20" />{KIND_LABEL.unknown}
      </span>
    </div>
  );
}

/** Brain informs · Home decides · Decision Room explains. */
function Roles() {
  return (
    <section data-brain-roles className="mt-12 border-t border-white/[0.06] pt-7">
      <p className="px-1 text-[14px] leading-[1.95] text-white/45">{BRAIN_COPY.roles}</p>
      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] px-5 py-4">
          <div className="text-[14px] font-bold text-white/85">{BRAIN_COPY.roleBrain}</div>
          <div className="mt-1.5 text-[12px] text-white/35">{BRAIN_COPY.roleBrainNote}</div>
        </div>
        <Link to="/dashboard" data-role-home className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4 transition hover:border-white/[0.14]">
          <div className="text-[14px] text-white/60">{BRAIN_COPY.roleHome}</div>
          <div className="mt-1.5 text-[12px] text-white/30">{BRAIN_COPY.roleHomeNote}</div>
        </Link>
        <Link to="/dashboard/growth-loop/experiment-1" data-role-room className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4 transition hover:border-white/[0.14]">
          <div className="text-[14px] text-white/60">{BRAIN_COPY.roleRoom}</div>
          <div className="mt-1.5 text-[12px] text-white/30">{BRAIN_COPY.roleRoomNote}</div>
        </Link>
      </div>
    </section>
  );
}

/**
 * Scoped to the prototype so it is removable with the directory. Drift amplitude
 * carries meaning: what you gave barely moves, what Loadder believes moves most.
 */
const BRAIN_MOTION_CSS = `
@keyframes brain-anchor { 0%,100% { transform: translate(-50%,-50%); } 50% { transform: translate(calc(-50% + 2px), calc(-50% - 2px)); } }
@keyframes brain-drift  { 0%,100% { transform: translate(-50%,-50%); } 50% { transform: translate(calc(-50% + 5px), calc(-50% - 6px)); } }
@keyframes brain-float  { 0%,100% { transform: translate(-50%,-50%); opacity: .82; } 50% { transform: translate(calc(-50% - 7px), calc(-50% + 8px)); opacity: 1; } }
@keyframes brain-flow   { to { stroke-dashoffset: -112; } }

.brain-live .brain-anchor { animation-name: brain-anchor; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.brain-live .brain-drift  { animation-name: brain-drift;  animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.brain-live .brain-float  { animation-name: brain-float;  animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.brain-live .brain-flow   { animation: brain-flow 11s linear infinite; }

@media (prefers-reduced-motion: reduce) {
  .brain-live .brain-anchor, .brain-live .brain-drift, .brain-live .brain-float, .brain-live .brain-flow { animation: none; }
}
`;
