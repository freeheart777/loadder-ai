/**
 * LOADDER BRAIN — PROTOTYPE FIXTURES. Not production data.
 *
 * Three invented states of what Loadder knows about one business. Nothing here
 * reads or writes a canonical API. The whole `src/prototype/` tree is removable.
 */

export const BRAIN_DATA_ORIGIN = "FIXTURE_ONLY_NOT_CANONICAL";

/**
 * `known`   — Loadder has a source for this.
 * `partial` — a source exists but it only tells part of the story.
 * `unknown` — Loadder has no source. Drawn detached, never as a warning.
 */
export type Knowledge = "known" | "partial" | "unknown";

export type Node = {
  id: string;
  label: string;
  /** Percentage of the canvas, so layout is deterministic and screenshots are stable. */
  x: number;
  y: number;
  knowledge: Knowledge;
  /** Expert view only. Where this came from, in plain words. */
  source?: string;
  /** Expert view only. What Loadder still cannot say about it. */
  gap?: string;
};

export type Edge = { from: string; to: string; knowledge: Exclude<Knowledge, "unknown"> };

export type BrainState = {
  id: string;
  label: string;
  /** One calm sentence. The Brain narrates; it never asks for a decision. */
  summary: string;
  nodes: Node[];
  edges: Edge[];
};

const KNOWN_LABEL: Record<Knowledge, string> = {
  known: "می‌دانم",
  partial: "تا حدی می‌دانم",
  unknown: "هنوز نمی‌دانم",
};

export const KNOWLEDGE_LABEL = KNOWN_LABEL;

/** A — a business Loadder has only just met. */
const NEW_BUSINESS: BrainState = {
  id: "new",
  label: "کسب‌وکار تازه",
  summary: "دو چیز از کسب‌وکار شما را می‌شناسم و چند چیز را هنوز نه.",
  nodes: [
    { id: "site", label: "سایت", x: 34, y: 24, knowledge: "known", source: "آدرسی که خودتان دادید", gap: "نمی‌دانم چند نفر واقعاً بازش می‌کنند." },
    { id: "insta", label: "اینستاگرام", x: 66, y: 34, knowledge: "known", source: "صفحه‌ای که خودتان دادید", gap: "نمی‌دانم چند نفر از آن‌جا به سایت می‌آیند." },
    { id: "visitors", label: "بازدیدکننده‌ها", x: 48, y: 60, knowledge: "unknown", gap: "هیچ جایی ثبت نمی‌شود." },
    { id: "customers", label: "مشتری‌ها", x: 20, y: 74, knowledge: "unknown", gap: "هنوز فهرستی از مشتری‌ها ندارم." },
    { id: "sales", label: "فروش", x: 78, y: 78, knowledge: "unknown", gap: "هیچ فروشی به من گزارش نشده." },
  ],
  edges: [{ from: "site", to: "insta", knowledge: "partial" }],
};

/** B — the same business after a few months of real use. */
const GROWING_BUSINESS: BrainState = {
  id: "growing",
  label: "کسب‌وکار در حال رشد",
  summary: "بیشتر مسیر را می‌بینم؛ یک حلقه هنوز جا افتاده است.",
  nodes: [
    { id: "site", label: "سایت", x: 28, y: 18, knowledge: "known", source: "صفحه‌ای که با لودر ساختید", gap: "—" },
    { id: "insta", label: "اینستاگرام", x: 58, y: 12, knowledge: "known", source: "صفحه‌ای که وصل کردید", gap: "—" },
    { id: "content", label: "محتوا", x: 82, y: 30, knowledge: "known", source: "متن‌هایی که با هم ساختیم", gap: "—" },
    { id: "visitors", label: "بازدیدکننده‌ها", x: 46, y: 44, knowledge: "known", source: "شمارش خود صفحه", gap: "—" },
    { id: "leads", label: "شماره‌هایی که گرفتید", x: 28, y: 70, knowledge: "known", source: "فهرست خودتان", gap: "—" },
    { id: "customers", label: "مشتری‌ها", x: 56, y: 88, knowledge: "known", source: "فهرست خودتان", gap: "—" },
    { id: "instore", label: "فروش حضوری", x: 84, y: 74, knowledge: "unknown", gap: "جایی ثبت نمی‌شود، پس نمی‌توانم بشمارمش." },
    { id: "cause", label: "دلیل رشد", x: 12, y: 40, knowledge: "partial", source: "مقایسهٔ دو هفته", gap: "مطمئن نیستم کدام کار باعثش بوده." },
  ],
  edges: [
    { from: "insta", to: "visitors", knowledge: "known" },
    { from: "content", to: "insta", knowledge: "known" },
    { from: "site", to: "visitors", knowledge: "known" },
    { from: "visitors", to: "leads", knowledge: "known" },
    { from: "leads", to: "customers", knowledge: "known" },
    { from: "cause", to: "site", knowledge: "partial" },
  ],
};

/** C — the same graph, with every node inspectable. */
const EXPERT_VIEW: BrainState = { ...GROWING_BUSINESS, id: "expert", label: "نمای کامل", summary: "روی هر چیزی بزنید تا بگویم از کجا می‌دانمش." };

export const BRAIN_STATES: readonly BrainState[] = Object.freeze([NEW_BUSINESS, GROWING_BUSINESS, EXPERT_VIEW]);

export const BRAIN_COPY = Object.freeze({
  title: "چیزی که از کسب‌وکار شما می‌دانم",
  lead: "این نقشه فقط نشان می‌دهد چه می‌دانم و چه نمی‌دانم. کاری از شما نمی‌خواهد.",
  legendKnown: "می‌دانم",
  legendPartial: "تا حدی می‌دانم",
  legendUnknown: "هنوز نمی‌دانم",
  unknownNote: "چیزهایی که وصل نیستند، خراب نیستند. فقط هنوز جایی ثبت نمی‌شوند.",
  panelSource: "از کجا می‌دانم",
  panelGap: "چه چیزی را هنوز نمی‌دانم",
  panelLinks: "به چه چیزهایی وصل است",
  panelEmpty: "روی یکی از چیزهای نقشه بزنید.",
  noLinks: "به چیزی وصل نیست.",
});

export function edgesFor(state: BrainState, nodeId: string) {
  return state.edges
    .filter((edge) => edge.from === nodeId || edge.to === nodeId)
    .map((edge) => (edge.from === nodeId ? edge.to : edge.from))
    .map((id) => state.nodes.find((node) => node.id === id)?.label)
    .filter((label): label is string => Boolean(label));
}
