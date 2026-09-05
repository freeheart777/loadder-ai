const STAGES = [
  { id: "new", label: "جدید", probability: 10, nextAction: "تماس اولیه و ثبت نیاز مشتری" },
  { id: "hot", label: "لید داغ", probability: 30, nextAction: "پیگیری فوری و تعیین جلسه" },
  { id: "qualified", label: "واجد شرایط", probability: 50, nextAction: "تکمیل نیازسنجی و آماده‌سازی پیشنهاد" },
  { id: "negotiating", label: "مذاکره", probability: 75, nextAction: "نهایی‌سازی پیشنهاد و شروط قرارداد" },
  { id: "converted", label: "برنده", probability: 100, nextAction: "شروع فرایند تحویل و آنبوردینگ" },
  { id: "lost", label: "از دست رفته", probability: 0, nextAction: "ثبت علت شکست و تحلیل" },
];

const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]));
const ACTIVE_STAGES = ["new", "hot", "qualified", "negotiating"];
const ALLOWED_TRANSITIONS = new Map([
  ["new", new Set(["hot", "qualified", "lost"])],
  ["hot", new Set(["new", "qualified", "negotiating", "lost"])],
  ["qualified", new Set(["hot", "negotiating", "lost"])],
  ["negotiating", new Set(["qualified", "converted", "lost"])],
  ["converted", new Set()],
  ["lost", new Set()],
]);

export class CrmPipelineError extends Error {
  constructor(message, { code = "CRM_PIPELINE_ERROR", status = 400 } = {}) {
    super(message);
    this.name = "CrmPipelineError";
    this.code = code;
    this.status = status;
  }
}

function wholeDaysSince(value, now = Date.now()) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((now - timestamp) / 86_400_000));
}

function enrichDeal(deal, now) {
  const stage = STAGE_BY_ID.get(deal.stage) || STAGE_BY_ID.get("new");
  const probability = Number.isFinite(deal.probabilityOverride) ? deal.probabilityOverride : stage.probability;
  const idleDays = wholeDaysSince(deal.updatedAt, now);
  return {
    ...deal,
    company: deal.company || "بدون شرکت",
    owner: deal.owner || "تیم فروش",
    nextAction: deal.nextAction || stage.nextAction,
    probability,
    lastActivityAt: deal.updatedAt,
    ageDays: wholeDaysSince(deal.createdAt, now),
    idleDays,
    isStuck: ACTIVE_STAGES.includes(stage.id) && idleDays >= 3,
    expectedVersion: deal.version,
    expectedUpdatedAt: deal.updatedAt,
  };
}

function serializeStage(stage, deals = []) {
  const stageDeals = deals.filter((deal) => deal.stage === stage.id);
  return { ...stage, allowedTargets: [...(ALLOWED_TRANSITIONS.get(stage.id) || [])], dealCount: stageDeals.length, totalValue: stageDeals.reduce((sum, deal) => sum + deal.amount, 0) };
}

function summarize(deals) {
  const active = deals.filter((deal) => ACTIVE_STAGES.includes(deal.stage));
  return {
    dealCount: deals.length,
    openDealCount: active.length,
    totalValue: active.reduce((sum, deal) => sum + deal.amount, 0),
    weightedValue: Math.round(active.reduce((sum, deal) => sum + deal.amount * (deal.probability / 100), 0)),
    stuckCount: active.filter((deal) => deal.isStuck).length,
    wonCount: deals.filter((deal) => deal.stage === "converted").length,
    lostCount: deals.filter((deal) => deal.stage === "lost").length,
  };
}

export function createCrmPipelineService({ getDeals, getDealById, transitionDeal, updateDealMetadata, getDealStageHistory, now = () => Date.now() }) {
  if (!getDeals || !getDealById || !transitionDeal || !updateDealMetadata || !getDealStageHistory) throw new Error("CRM pipeline service requires deal repository functions.");

  function board() {
    const deals = getDeals().map((deal) => enrichDeal(deal, now()));
    return { stages: STAGES.map((stage) => serializeStage(stage, deals)), deals, summary: summarize(deals) };
  }

  function transition({ dealId, toStage, expectedVersion, expectedUpdatedAt, reason, actorType, actorId }) {
    if (!STAGE_BY_ID.has(toStage)) throw new CrmPipelineError("مرحله مقصد معتبر نیست.", { code: "INVALID_STAGE", status: 400 });
    const current = getDealById(dealId);
    if (!current) throw new CrmPipelineError("فرصت فروش پیدا نشد.", { code: "DEAL_NOT_FOUND", status: 404 });
    const resolvedVersion = Number.isInteger(expectedVersion) ? expectedVersion : expectedUpdatedAt === current.updatedAt ? current.version : null;
    if (resolvedVersion !== current.version) throw new CrmPipelineError("این Deal توسط کاربر یا Agent دیگری تغییر کرده است. برد را تازه‌سازی کنید.", { code: "STALE_DEAL_VERSION", status: 409 });
    if (current.stage === toStage) return enrichDeal(current, now());
    const allowedTargets = ALLOWED_TRANSITIONS.get(current.stage) || new Set();
    if (!allowedTargets.has(toStage)) throw new CrmPipelineError("این جابه‌جایی در Pipeline مجاز نیست.", { code: "TRANSITION_NOT_ALLOWED", status: 409 });
    if (toStage === "lost" && !String(reason || "").trim()) throw new CrmPipelineError("برای Deal از دست‌رفته ثبت علت شکست اجباری است.", { code: "LOST_REASON_REQUIRED", status: 400 });
    const result = transitionDeal(dealId, { toStage, reason: String(reason || "").trim() || null, expectedVersion: resolvedVersion, actorType, actorId });
    if (result.kind === "not_found") throw new CrmPipelineError("فرصت فروش پیدا نشد.", { code: "DEAL_NOT_FOUND", status: 404 });
    if (result.kind === "stale") throw new CrmPipelineError("این Deal توسط کاربر یا Agent دیگری تغییر کرده است. برد را تازه‌سازی کنید.", { code: "STALE_DEAL_VERSION", status: 409 });
    return enrichDeal(result.deal, now());
  }

  function updateMetadata({ dealId, expectedVersion, ownerId, owner, nextAction, nextActionDueAt }) {
    const result = updateDealMetadata(dealId, { expectedVersion, ownerId, owner, nextAction, nextActionDueAt });
    if (result.kind === "not_found") throw new CrmPipelineError("فرصت فروش پیدا نشد.", { code: "DEAL_NOT_FOUND", status: 404 });
    if (result.kind === "stale") throw new CrmPipelineError("این Deal تغییر کرده است. اطلاعات را تازه‌سازی کنید.", { code: "STALE_DEAL_VERSION", status: 409 });
    return enrichDeal(result.deal, now());
  }

  function history(dealId) {
    if (!getDealById(dealId)) throw new CrmPipelineError("فرصت فروش پیدا نشد.", { code: "DEAL_NOT_FOUND", status: 404 });
    return getDealStageHistory(dealId);
  }

  return { board, transition, updateMetadata, history, stages: () => STAGES.map((stage) => serializeStage(stage)) };
}
