/**
 * LOADDER BRAIN V2 — PROTOTYPE FIXTURES. Not production data.
 *
 * Invented content for one business, used to validate the Brain's visual
 * grammar. Nothing here reads or writes a canonical API. The whole
 * `src/prototype/brain/` directory is removable.
 */

export const BRAIN_DATA_ORIGIN = "FIXTURE_ONLY_NOT_CANONICAL";

/**
 * Four node kinds, each with its own visual weight:
 *
 *   human    — the owner gave it or did it. The most solid thing on the field.
 *   observed — Loadder discovered it. Factual, outlined rather than filled.
 *   belief   — Loadder's reading. Never solid, and always carries a confidence
 *              indicator so it can never be mistaken for a fact.
 *   unknown  — an empty node. A hole in the map, not a fault.
 */
export type NodeKind = "human" | "observed" | "belief" | "unknown";

/** Belief only. Deliberately coarse: no invented percentage. */
export type Confidence = "low" | "medium" | "high";

/**
 * Three edge kinds:
 *   source   — this came from that
 *   built    — Loadder made this out of that
 *   possible — a relation Loadder suspects but cannot show. Always dashed.
 */
export type EdgeKind = "source" | "built" | "possible";

export type SourceEvent = { when: string; what: string };

export type BrainNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: NodeKind;
  confidence?: Confidence;
  /** Deep view. Ordered oldest first. */
  history?: SourceEvent[];
  /** Deep view. What Loadder still cannot say. */
  gap?: string;
  /** Deep view. A past decision that touched this, in the existing Decision Room. */
  decisionRoom?: { label: string; href: string };
};

/**
 * An edge with no `to` is incomplete: it leaves a node and fades out, because
 * Loadder can see something leaves but not where it goes.
 */
export type BrainEdge = { from: string; to?: string; toX?: number; toY?: number; kind: EdgeKind };

/** A region of the business Loadder has no way to observe at all. */
export type UnknownArea = { x: number; y: number; w: number; h: number; label: string };

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "با اطمینان کم",
  medium: "با اطمینان متوسط",
  high: "با اطمینان زیاد",
};

export const CONFIDENCE_STEPS: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

export const KIND_LABEL: Record<NodeKind, string> = {
  human: "شما این را به من دادید",
  observed: "خودم این را دیدم",
  belief: "این برداشت من است",
  unknown: "این را هنوز نمی‌دانم",
};

/** Nine nodes, comfortably under the twelve the simple view allows. */
export const NODES: BrainNode[] = [
  {
    id: "site", label: "سایت شما", x: 24, y: 16, kind: "human",
    history: [{ when: "سه ماه پیش", what: "آدرس سایت را خودتان دادید" }, { when: "دو ماه پیش", what: "صفحه را با هم بازنویسی کردیم" }],
    gap: "—",
  },
  {
    id: "insta", label: "صفحهٔ اینستاگرام", x: 62, y: 12, kind: "human",
    history: [{ when: "سه ماه پیش", what: "صفحه را خودتان وصل کردید" }],
    gap: "—",
  },
  {
    id: "list", label: "فهرست مشتری‌ها", x: 13, y: 55, kind: "human",
    history: [{ when: "دو ماه پیش", what: "فهرست را خودتان وارد کردید" }],
    gap: "—",
  },
  {
    id: "content", label: "متن‌هایی که ساختیم", x: 84, y: 30, kind: "observed",
    history: [{ when: "شش هفته پیش", what: "از روی سایت و لحن شما ساخته شد" }],
    gap: "نمی‌دانم چند نفر تا آخرش را خواندند.",
  },
  {
    id: "price", label: "قیمت روی صفحه", x: 40, y: 34, kind: "observed",
    history: [{ when: "پنج هفته پیش", what: "روی صفحه اضافه شد" }],
    gap: "—",
    decisionRoom: { label: "تصمیم دربارهٔ نمایش قیمت", href: "/dashboard/growth-loop/experiment-1" },
  },
  {
    id: "visits", label: "بازدیدها", x: 66, y: 48, kind: "observed",
    history: [{ when: "هر روز", what: "خود صفحه می‌شمارد" }],
    gap: "نمی‌دانم هر بازدید کدام آدم است.",
  },
  {
    id: "calls", label: "شماره‌هایی که گرفتید", x: 34, y: 62, kind: "observed",
    history: [{ when: "پنج هفته پیش", what: "اولین شماره ثبت شد" }, { when: "این هفته", what: "سه شمارهٔ تازه" }],
    gap: "نمی‌دانم بعد از تماس چه شد.",
  },
  {
    id: "why", label: "قیمت باعث تماس بیشتر شد", x: 46, y: 84, kind: "belief", confidence: "medium",
    history: [{ when: "دو هفته پیش", what: "دو هفته را با هم مقایسه کردم" }],
    gap: "همان هفته پستتان هم بیشتر دیده شد؛ مطمئن نیستم کدام.",
    decisionRoom: { label: "تصمیم دربارهٔ نمایش قیمت", href: "/dashboard/growth-loop/experiment-1" },
  },
  {
    id: "night", label: "شب‌ها بیشتر سر می‌زنند", x: 82, y: 68, kind: "belief", confidence: "low",
    history: [{ when: "هفتهٔ پیش", what: "ساعت بازدیدها را نگاه کردم" }],
    gap: "دادهٔ کمی دارم؛ ممکن است اتفاقی باشد.",
  },
];

export const EDGES: BrainEdge[] = [
  { from: "site", to: "price", kind: "source" },
  { from: "site", to: "visits", kind: "source" },
  { from: "insta", to: "visits", kind: "source" },
  { from: "site", to: "content", kind: "built" },
  { from: "insta", to: "content", kind: "built" },
  { from: "list", to: "calls", kind: "source" },
  { from: "price", to: "why", kind: "possible" },
  { from: "calls", to: "why", kind: "possible" },
  { from: "visits", to: "night", kind: "possible" },
  // Incomplete: something leaves the calls, but Loadder cannot see where it lands.
  { from: "calls", toX: 22, toY: 84, kind: "source" },
];

export const UNKNOWN_AREA: UnknownArea = {
  x: 5, y: 70, w: 29, h: 24,
  label: "فروش حضوری و معرفی دهان‌به‌دهان",
};

/** The empty node that sits inside the unmapped region. */
export const UNKNOWN_NODE: BrainNode = { id: "offline", label: "", x: 19, y: 87, kind: "unknown", gap: "هیچ راهی ندارم که این را ببینم." };

export const BRAIN_COPY = Object.freeze({
  title: "چیزی که از کسب‌وکار شما می‌دانم",
  lead: "این صفحه فقط می‌گوید چه می‌دانم و چه نمی‌دانم. تصمیمی از شما نمی‌خواهد.",
  simple: "سادهٔ روزمره",
  deep: "نمای کامل",
  summarySimple: "چند چیز را از شما دارم، چند چیز را خودم دیده‌ام، و چند چیز هنوز حدس است.",
  summaryDeep: "روی هر چیزی بزنید تا بگویم از کجا آمده و چه چیزی را هنوز نمی‌دانم.",
  legend: "راهنما",
  incomplete: "خطی که به جایی نمی‌رسد یعنی چیزی از این‌جا بیرون می‌رود ولی نمی‌بینم کجا می‌رود.",
  unknownNote: "جای خالی خرابی نیست. یعنی هنوز جایی ثبت نمی‌شود.",
  panelEmpty: "روی یکی از چیزهای نقشه بزنید.",
  panelHistory: "از کجا آمده",
  panelGap: "چه چیزی را هنوز نمی‌دانم",
  panelLinks: "به چه چیزهایی وصل است",
  panelDecision: "تصمیم گذشته",
  noLinks: "به چیزی وصل نیست.",
  roles: "مغز می‌گوید چه می‌دانم. خانه یک تصمیم می‌خواهد. اتاق تصمیم می‌گوید قبلاً چه تصمیمی گرفتید.",
  roleBrain: "مغز",
  roleBrainNote: "چه می‌دانم · تصمیمی نمی‌گیرد",
  roleHome: "خانه",
  roleHomeNote: "یک تصمیم از شما",
  roleRoom: "اتاق تصمیم",
  roleRoomNote: "تصمیم‌های گذشته",
});

export function neighbours(nodeId: string) {
  const all = [...NODES, UNKNOWN_NODE];
  return EDGES
    .filter((edge) => edge.to && (edge.from === nodeId || edge.to === nodeId))
    .map((edge) => (edge.from === nodeId ? edge.to : edge.from))
    .map((id) => all.find((node) => node.id === id)?.label)
    .filter((label): label is string => Boolean(label));
}
