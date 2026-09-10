import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import BrainCanvas from "./BrainCanvas";
import { BRAIN_COPY, BRAIN_STATES, KNOWLEDGE_LABEL, edgesFor, type Node } from "./fixtures";

/**
 * PROTOTYPE — Loadder Brain, visual only.
 *
 * Dev-only surface for design review. Fixture data, no canonical API, no
 * mutation, and no competition with Home: the Brain narrates what Loadder knows
 * and what it does not, and never asks for a decision. There is no primary
 * action anywhere on this page by design.
 *
 * `?state=<id>` selects a state, `?chrome=0` hides the switcher for capture, and
 * `?motion=0` freezes the ambient motion so screenshots are deterministic.
 */
export default function LoadderBrainPrototype() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("state") ?? "new";
  const state = BRAIN_STATES.find((entry) => entry.id === requested) ?? BRAIN_STATES[0];
  const chrome = params.get("chrome") !== "0";
  const frozen = params.get("motion") === "0";
  const expert = state.id === "expert";
  const [selected, setSelected] = useState<Node | null>(null);

  return (
    <div dir="rtl" className="relative min-h-screen overflow-x-hidden bg-[#07070B] text-[#F5F5F7]">
      <style>{BRAIN_MOTION_CSS}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.10),transparent_65%)]" />

      {chrome && (
        <nav className="relative flex flex-wrap gap-1.5 border-b border-white/[0.07] px-4 py-3">
          {BRAIN_STATES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => { setParams({ state: entry.id }); setSelected(null); }}
              className={`min-h-9 rounded-xl px-3 text-[12px] transition ${entry.id === state.id ? "bg-white/[0.10] text-white" : "text-white/40 hover:text-white/70"}`}
            >
              {entry.label}
            </button>
          ))}
          <span className="mr-auto self-center px-2 text-[11px] text-white/20">نمونهٔ طراحی · دادهٔ نمایشی</span>
        </nav>
      )}

      <main className="relative mx-auto w-full max-w-[900px] px-6 py-10 sm:px-8 sm:py-14">
        <header className="mb-8">
          <div dir="ltr" className="text-[14px] font-semibold text-white/50">Loadder</div>
          <h1 className="mt-5 text-[26px] font-bold leading-[1.5] sm:text-[32px]">{BRAIN_COPY.title}</h1>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-[2] text-white/45">{BRAIN_COPY.lead}</p>
        </header>

        <p data-brain-summary className="mb-6 text-[17px] leading-[1.9] text-white/75">{state.summary}</p>

        <div className="rounded-[28px] border border-white/[0.07] bg-white/[0.015] p-2 sm:p-4">
          <BrainCanvas
            state={state}
            frozen={frozen}
            selectable={expert}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </div>

        <div data-brain-legend className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3 px-1 text-[13px]">
          <span className="inline-flex items-center gap-2 text-white/70"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />{BRAIN_COPY.legendKnown}</span>
          <span className="inline-flex items-center gap-2 text-white/60"><span className="h-1.5 w-1.5 rounded-full bg-violet-300/80" />{BRAIN_COPY.legendPartial}</span>
          <span className="inline-flex items-center gap-2 text-white/40"><span className="h-1.5 w-1.5 rounded-full border border-dashed border-white/30" />{BRAIN_COPY.legendUnknown}</span>
        </div>

        <p className="mt-4 px-1 text-[13px] leading-[1.9] text-white/30">{BRAIN_COPY.unknownNote}</p>

        {expert && (
          <section data-brain-panel className="mt-8 rounded-[26px] border border-white/[0.07] bg-white/[0.02] p-6 sm:p-7">
            {!selected && <p className="text-[15px] text-white/35">{BRAIN_COPY.panelEmpty}</p>}
            {selected && (
              <div>
                <div className="flex items-baseline gap-3">
                  <h2 className="text-[19px] font-bold">{selected.label}</h2>
                  <span className="text-[12px] text-white/35">{KNOWLEDGE_LABEL[selected.knowledge]}</span>
                </div>
                <dl className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-[12px] text-white/35">{BRAIN_COPY.panelSource}</dt>
                    <dd className="mt-1.5 text-[15px] leading-[1.85] text-white/85">{selected.source ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-white/35">{BRAIN_COPY.panelGap}</dt>
                    <dd className="mt-1.5 text-[15px] leading-[1.85] text-amber-200/75">{selected.gap ?? "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[12px] text-white/35">{BRAIN_COPY.panelLinks}</dt>
                    <dd className="mt-1.5 text-[15px] leading-[1.85] text-white/70">
                      {edgesFor(state, selected.id).join(" · ") || BRAIN_COPY.noLinks}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * Scoped to this prototype so it is removable with the directory. Every duration
 * is long and every amplitude small: the field should feel alive, not busy.
 */
const BRAIN_MOTION_CSS = `
@keyframes brain-drift {
  0%, 100% { transform: translate(-50%, -50%); }
  50%      { transform: translate(calc(-50% + 5px), calc(-50% - 6px)); }
}
@keyframes brain-settle {
  0%, 100% { transform: translate(-50%, -50%); opacity: .45; }
  50%      { transform: translate(calc(-50% - 4px), calc(-50% + 4px)); opacity: .8; }
}
@keyframes brain-flow { to { stroke-dashoffset: -62; } }

.brain-live .brain-drift  { animation-name: brain-drift;  animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.brain-live .brain-settle { animation-name: brain-settle; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.brain-live .brain-flow   { animation: brain-flow 9s linear infinite; }

@media (prefers-reduced-motion: reduce) {
  .brain-live .brain-drift, .brain-live .brain-settle, .brain-live .brain-flow { animation: none; }
}
`;
