import {
  CONFIDENCE_STEPS, EDGES, NODES, UNKNOWN_AREA, UNKNOWN_NODE,
  type BrainNode, type EdgeKind,
} from "./fixtures";

/**
 * The Brain field.
 *
 * Edges are one SVG layer; nodes are HTML chips over it so Persian lays out and
 * wraps correctly. Positions are percentages, so layout is deterministic and a
 * capture of the same view is always identical.
 *
 * Visual grammar:
 *   human    filled chip, brightest, barely drifts — it is anchored, you gave it
 *   observed outlined chip with a solid dot — a fact Loadder found
 *   belief   translucent violet chip with a three-step confidence meter, and the
 *            widest drift, because it is the least anchored thing on the field
 *   unknown  an empty ring with no label
 *
 *   source   thin solid line
 *   built    thicker solid line with a second inner stroke, reading as assembled
 *   possible dashed, always, so a suspicion can never look like a measurement
 *
 * An edge without a target fades to nothing: Loadder can see something leaves,
 * not where it lands. The unmapped region is a dashed area, not a red zone.
 *
 * Motion is ambient only. No sparkle, burst, particle or loading spinner.
 * `frozen` stops everything, and prefers-reduced-motion does the same.
 */

const EDGE_STYLE: Record<EdgeKind, { stroke: string; width: string; dash?: string }> = {
  source: { stroke: "rgba(255,255,255,0.22)", width: "1" },
  built: { stroke: "rgba(167,243,208,0.30)", width: "2.2" },
  possible: { stroke: "rgba(196,181,253,0.34)", width: "1", dash: "4 5" },
};

const CHIP: Record<BrainNode["kind"], string> = {
  human: "border-transparent bg-white/[0.92] text-[#0A0A0F] font-semibold",
  observed: "border-white/25 bg-white/[0.05] text-white/85",
  belief: "border-violet-300/35 bg-violet-400/[0.09] text-violet-50/90",
  unknown: "border-dashed border-white/20 bg-transparent",
};

function point(id: string) {
  const node = [...NODES, UNKNOWN_NODE].find((entry) => entry.id === id);
  return node ? { x: node.x, y: node.y } : null;
}

/** Three steps, never a percentage: the Brain does not invent precision. */
function ConfidenceMeter({ steps }: { steps: number }) {
  return (
    <span data-confidence={steps} className="ml-0.5 flex shrink-0 items-end gap-[2px]" aria-hidden="true">
      {[1, 2, 3].map((step) => (
        <span key={step} className={`w-[3px] rounded-full ${step <= steps ? "bg-violet-200/90" : "bg-violet-200/20"}`} style={{ height: `${4 + step * 2}px` }} />
      ))}
    </span>
  );
}

export default function BrainCanvas({
  frozen, selectable, selectedId, onSelect,
}: {
  frozen: boolean;
  selectable: boolean;
  selectedId?: string | null;
  onSelect?: (node: BrainNode) => void;
}) {
  const nodes = [...NODES, UNKNOWN_NODE];

  return (
    <div data-brain-canvas className={`relative aspect-[3/4] w-full sm:aspect-[16/10] ${frozen ? "" : "brain-live"}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="brain-fade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* The part of the business Loadder cannot observe at all. */}
        <rect
          data-brain-unknown-area
          x={UNKNOWN_AREA.x} y={UNKNOWN_AREA.y} width={UNKNOWN_AREA.w} height={UNKNOWN_AREA.h}
          rx="4" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.13)"
          strokeWidth="1" strokeDasharray="5 6" vectorEffect="non-scaling-stroke"
        />

        {EDGES.map((edge, index) => {
          const from = point(edge.from);
          const to = edge.to ? point(edge.to) : { x: edge.toX ?? 0, y: edge.toY ?? 0 };
          if (!from || !to) return null;
          const style = EDGE_STYLE[edge.kind];
          const incomplete = !edge.to;
          return (
            <g key={`${edge.from}-${edge.to ?? `open-${index}`}`} data-edge-kind={incomplete ? "incomplete" : edge.kind}>
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={incomplete ? "url(#brain-fade)" : style.stroke}
                strokeWidth={style.width} strokeDasharray={style.dash} strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {edge.kind === "built" && !incomplete && (
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(7,7,11,0.85)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
              )}
              {edge.kind !== "possible" && !incomplete && (
                <line
                  className="brain-flow" x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round"
                  strokeDasharray="2 26" vectorEffect="non-scaling-stroke"
                  style={{ animationDelay: `${index * 1.3}s` }}
                />
              )}
            </g>
          );
        })}
      </svg>

      <span
        data-brain-area-label
        className="absolute -translate-x-1/2 text-center text-[11px] leading-[1.7] text-white/25"
        style={{ left: `${UNKNOWN_AREA.x + UNKNOWN_AREA.w / 2}%`, top: `${UNKNOWN_AREA.y + 4}%`, width: `${UNKNOWN_AREA.w - 2}%` }}
      >
        {UNKNOWN_AREA.label}
      </span>

      {nodes.map((node, index) => {
        const selected = selectedId === node.id;
        const drift = node.kind === "human" ? "brain-anchor" : node.kind === "belief" ? "brain-float" : "brain-drift";
        const body = node.kind === "unknown" ? (
          <span className="block h-6 w-6 rounded-full" />
        ) : (
          <>
            {node.kind !== "human" && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${node.kind === "belief" ? "bg-violet-300/90" : "bg-emerald-300/80"}`} />}
            <span className="max-w-[22ch] leading-[1.6]">{node.label}</span>
            {node.confidence && <ConfidenceMeter steps={CONFIDENCE_STEPS[node.confidence]} />}
          </>
        );
        const className = `flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] backdrop-blur-[2px] transition ${CHIP[node.kind]} ${
          selected ? "ring-2 ring-violet-300/60" : ""
        } ${selectable ? "cursor-pointer hover:brightness-110" : ""}`;
        return (
          <div
            key={node.id}
            data-brain-node={node.id}
            data-kind={node.kind}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${drift}`}
            style={{ left: `${node.x}%`, top: `${node.y}%`, animationDelay: `${index * 1.9}s`, animationDuration: `${16 + (index % 4) * 3}s` }}
          >
            {selectable && onSelect ? (
              <button type="button" onClick={() => onSelect(node)} className={className} aria-label={node.label || "چیزی که نمی‌دانم"}>{body}</button>
            ) : (
              <div className={className}>{body}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
