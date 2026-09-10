import { useMemo } from "react";
import type { BrainState, Node } from "./fixtures";

/**
 * The Brain field.
 *
 * Edges are drawn in one SVG layer; nodes are HTML chips positioned over it so
 * Persian text lays out and wraps correctly. Positions are percentages, so the
 * layout is deterministic and a screenshot of the same state is always identical.
 *
 * Motion is deliberately ambient:
 *   drift  — each node breathes a few pixels on its own long cycle, so the field
 *            never pulses in unison and never reads as a loading state
 *   flow   — a dash travels slowly along a known edge, suggesting that something
 *            moves between two things Loadder can see
 *   settle — unknown nodes fade very slowly in and out, reading as "not settled"
 *            rather than "broken"
 *
 * No sparkle, no burst, no particle, no colour flash. `frozen` stops everything
 * for capture, and the same switch follows prefers-reduced-motion.
 */

const TONE = {
  known: { chip: "border-white/20 bg-white/[0.07] text-white/90", dot: "bg-emerald-300/80" },
  partial: { chip: "border-violet-300/25 bg-violet-400/[0.07] text-white/80", dot: "bg-violet-300/80" },
  unknown: { chip: "border-dashed border-white/15 bg-transparent text-white/40", dot: "bg-white/25" },
} as const;

function nodeById(state: BrainState, id: string) {
  return state.nodes.find((node) => node.id === id);
}

export default function BrainCanvas({
  state, frozen, selectable, selectedId, onSelect,
}: {
  state: BrainState;
  frozen: boolean;
  selectable: boolean;
  selectedId?: string | null;
  onSelect?: (node: Node) => void;
}) {
  const lines = useMemo(
    () => state.edges.flatMap((edge) => {
      const from = nodeById(state, edge.from);
      const to = nodeById(state, edge.to);
      return from && to ? [{ ...edge, x1: from.x, y1: from.y, x2: to.x, y2: to.y }] : [];
    }),
    [state],
  );

  return (
    <div data-brain-canvas data-state={state.id} className={`relative aspect-[3/4] w-full sm:aspect-[16/10] ${frozen ? "" : "brain-live"}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {lines.map((line) => (
          <g key={`${line.from}-${line.to}`}>
            <line
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke={line.knowledge === "known" ? "rgba(255,255,255,0.16)" : "rgba(196,181,253,0.20)"}
              strokeWidth="0.25" strokeDasharray={line.knowledge === "partial" ? "1.4 1.6" : undefined} vectorEffect="non-scaling-stroke"
            />
            {line.knowledge === "known" && (
              <line
                className="brain-flow" x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                stroke="rgba(255,255,255,0.5)" strokeWidth="0.3" strokeLinecap="round"
                strokeDasharray="1.5 14" vectorEffect="non-scaling-stroke"
                style={{ animationDelay: `${(line.x1 + line.y1) % 7}s` }}
              />
            )}
          </g>
        ))}
      </svg>

      {state.nodes.map((node, index) => {
        const tone = TONE[node.knowledge];
        const selected = selectedId === node.id;
        const chip = (
          <>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
            <span className="whitespace-nowrap">{node.label}</span>
          </>
        );
        const className = `flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] leading-none backdrop-blur-[2px] transition ${tone.chip} ${
          selected ? "ring-2 ring-violet-300/50" : ""
        } ${selectable ? "cursor-pointer hover:border-white/40" : ""}`;
        return (
          <div
            key={node.id}
            data-brain-node={node.id}
            data-knowledge={node.knowledge}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${node.knowledge === "unknown" ? "brain-settle" : "brain-drift"}`}
            style={{ left: `${node.x}%`, top: `${node.y}%`, animationDelay: `${index * 1.7}s`, animationDuration: `${14 + (index % 5) * 2}s` }}
          >
            {selectable && onSelect ? (
              <button type="button" onClick={() => onSelect(node)} className={className}>{chip}</button>
            ) : (
              <div className={className}>{chip}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
