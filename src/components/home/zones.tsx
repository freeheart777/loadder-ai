import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bag, BookOpenText, Brain, ChartLineUp, FileText, Gauge, Gear, Globe, InstagramLogo,
  Lightning, Megaphone, PencilSimple, Repeat, UsersThree,
} from "@phosphor-icons/react";
import {
  HOME_TOOLS, IN_PROGRESS_COPY, LEARNED_COPY, TOOLS_HINT, ZONE_LABELS,
  inProgressLines, learnedSentence,
} from "../../lib/beginnerCopy";
import type { InProgress, Learned, ZoneState } from "../../lib/homeData";

const ICONS: Record<string, typeof Bag> = {
  users: UsersThree, pen: PencilSimple, globe: Globe, bag: Bag, chart: ChartLineUp,
  megaphone: Megaphone, book: BookOpenText, bolt: Lightning, instagram: InstagramLogo,
  file: FileText, repeat: Repeat, gear: Gear, gauge: Gauge, brain: Brain,
};

export function Zone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="mb-4 px-1 text-[13px] font-bold text-white/30">{label}</h2>
      {children}
    </section>
  );
}

function QuietCard({ children }: { children: ReactNode }) {
  return <div className="rounded-[26px] border border-white/[0.06] bg-white/[0.018] p-6 sm:p-7">{children}</div>;
}

/**
 * Zone 2. Human sentences over counted canonical records. Deliberately not a
 * step ladder: a progress list invites the owner to watch, and the point of the
 * zone is that they do not have to.
 */
export function InProgressZone({ state }: { state: ZoneState<InProgress> }) {
  const lines = state.data ? inProgressLines(state.data) : [];
  return (
    <Zone label={ZONE_LABELS.inProgress}>
      <QuietCard>
        {state.status === "failed" && <p data-in-progress="unreadable" className="text-[15px] leading-[1.95] text-amber-200/80">{IN_PROGRESS_COPY.unreadable}</p>}
        {state.status === "loading" && <div aria-live="polite" className="h-5 w-2/3 animate-pulse rounded-full bg-white/[0.05]" />}
        {state.status === "ready" && lines.length === 0 && <p data-in-progress="empty" className="text-[15px] leading-[1.95] text-white/45">{IN_PROGRESS_COPY.empty}</p>}
        {state.status === "ready" && lines.length > 0 && (
          <ul data-in-progress="lines" className="space-y-3.5">
            {lines.map((line) => (
              <li key={line.key} className="flex items-start gap-3">
                <span className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${line.wantsYou ? "bg-amber-300" : "bg-white/25"}`} />
                <span className={`text-[15px] leading-[1.95] ${line.wantsYou ? "text-white/85" : "text-white/55"}`}>{line.text}</span>
              </li>
            ))}
          </ul>
        )}
      </QuietCard>
    </Zone>
  );
}

/**
 * Zone 3. Shows only what a canonical finding counted, always paired with the
 * boundary. Nothing is inferred and nothing is stored.
 */
export function LearnedZone({ state }: { state: ZoneState<Learned> }) {
  return (
    <Zone label={ZONE_LABELS.learned}>
      <QuietCard>
        {state.status === "failed" && <p data-learned="unreadable" className="text-[15px] leading-[1.95] text-amber-200/80">{LEARNED_COPY.unreadable}</p>}
        {state.status === "loading" && <div aria-live="polite" className="h-5 w-3/4 animate-pulse rounded-full bg-white/[0.05]" />}
        {state.status === "ready" && !state.data && <p data-learned="empty" className="text-[15px] leading-[1.95] text-white/45">{LEARNED_COPY.empty}</p>}
        {state.status === "ready" && state.data && (
          <div data-learned="finding">
            <p className="text-[16px] leading-[1.95] text-white/85">{learnedSentence(state.data.observedCount)}</p>
            <p data-learned-boundary className="mt-3 text-[14px] leading-[1.9] text-amber-200/70">{LEARNED_COPY.boundary}</p>
          </div>
        )}
      </QuietCard>
    </Zone>
  );
}

/**
 * Zone 4. Full grid at every width, Persian-first labels, lower visual priority
 * than the decision surface but never hidden and never gated behind a plan.
 */
export function ToolsZone() {
  return (
    <section data-zone="tools" className="mt-14 border-t border-white/[0.06] pt-9">
      <div className="mb-5 flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-bold text-white/30">{ZONE_LABELS.tools}</h2>
        <span className="text-[12px] text-white/20">{TOOLS_HINT}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {HOME_TOOLS.map((tool) => {
          const Icon = ICONS[tool.icon] ?? Bag;
          return (
            <Link key={tool.label} to={tool.route} data-tool className="group flex min-h-11 items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5 transition hover:border-white/[0.12] hover:bg-white/[0.05]">
              <Icon size={18} className="shrink-0 text-white/30 transition group-hover:text-violet-200" />
              <span className="min-w-0 truncate text-[14px] text-white/70">{tool.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Reusable permission primitive — visual only.
 *
 * No execution flow, no request, no backend. It exists so that when a
 * consequential action does arrive it already has an honest presentation.
 *
 * Label and value are stacked rather than pushed to opposite edges: the review
 * of the prototype found that a right-aligned label with a left-aligned value
 * put the two roughly 700px apart on a wide screen, which broke scanning of the
 * four facts that matter most.
 */
export function PermissionFacts({ facts }: { facts: Array<{ label: string; value: string }> }) {
  return (
    <dl data-permission-facts className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-[12px] text-white/35">{fact.label}</dt>
          <dd className="mt-1.5 break-words text-[16px] leading-[1.8] text-white/90">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
