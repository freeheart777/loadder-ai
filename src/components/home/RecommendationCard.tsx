import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CaretDown, Question } from "@phosphor-icons/react";
import {
  BUTTON_LABELS,
  CARD_LABELS,
  consequenceFor,
  factLines,
  reasonSentence,
  safeDeepLink,
  scriptFor,
  unknownSentence,
  type MissionControlItem,
} from "../../lib/beginnerCopy";

/**
 * The one reusable recommendation primitive for the beginner surface.
 *
 * Every sentence comes from the frozen tables in lib/beginnerCopy. This
 * component never reads a raw backend string, never derives a number, and never
 * sends a request. The affirmative button is a link into the canonical surface
 * that actually records a human decision.
 */
export default function RecommendationCard({
  item,
  onDecline,
}: {
  item: MissionControlItem;
  onDecline?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const script = scriptFor(item.signalId);
  const consequence = consequenceFor(item);
  const link = safeDeepLink(item.action?.deepLink);
  const facts = factLines(item);

  return (
    <article
      data-recommendation="primary"
      data-signal={item.signalId}
      className="rounded-[28px] border border-violet-300/20 bg-gradient-to-bl from-violet-500/[0.10] via-white/[0.04] to-transparent p-6 sm:p-8"
    >
      <dl className="space-y-5">
        <Section label={CARD_LABELS.saw} value={script.saw} strong />
        <Section label={CARD_LABELS.belief} value={script.belief} />
        <Section label={CARD_LABELS.suggestion} value={script.suggestion} />
        <Section label={CARD_LABELS.ask} value={script.ask} />
        {consequence && <Section label={CARD_LABELS.consequence} value={consequence} muted />}
      </dl>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {link ? (
          <Link
            to={link}
            data-action="accept"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-6 text-base font-bold text-slate-950 sm:flex-none"
          >
            {BUTTON_LABELS.accept}
            <ArrowLeft size={18} weight="bold" />
          </Link>
        ) : (
          <button
            type="button"
            data-action="accept"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-6 text-base font-bold text-slate-950 sm:flex-none"
          >
            {BUTTON_LABELS.accept}
          </button>
        )}
        <button
          type="button"
          data-action="decline"
          onClick={onDecline}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-6 text-sm text-white/70"
        >
          {BUTTON_LABELS.decline}
        </button>
        <button
          type="button"
          data-action="why"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm text-violet-200"
        >
          <Question size={18} />
          {BUTTON_LABELS.why}
          <CaretDown size={14} className={open ? "rotate-180 transition" : "transition"} />
        </button>
      </div>

      {open && (
        <div id={drawerId} data-why-drawer className="mt-5 rounded-3xl border border-white/[0.08] bg-black/25 p-5">
          {facts.length > 0 && (
            <dl className="grid gap-3 sm:grid-cols-2">
              {facts.map((entry) => (
                <div key={entry.label} className="min-w-0">
                  <dt className="text-xs text-white/40">{entry.label}</dt>
                  <dd className="mt-1 break-words text-sm text-white/80">{entry.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-4 text-sm leading-7 text-white/70">{reasonSentence(item)}</p>
          <p data-unknown className="mt-3 text-sm leading-7 text-amber-200/80">
            {unknownSentence(item)}
          </p>
          {link && (
            <Link
              to={link}
              data-action="details"
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-cyan-300"
            >
              {BUTTON_LABELS.details}
              <ArrowLeft size={16} />
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

function Section({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-bold text-violet-300/70">{label}</dt>
      <dd
        className={
          strong
            ? "mt-1.5 text-xl font-bold leading-9 text-white sm:text-2xl"
            : muted
              ? "mt-1.5 text-sm leading-8 text-white/50"
              : "mt-1.5 text-base leading-8 text-white/80"
        }
      >
        {value}
      </dd>
    </div>
  );
}
