const STAGES = [
  {
    id: "new",
    label: "جدید",
    probability: 10,
    nextAction: "تماس اولیه و ثبت نیاز مشتری",
  },
  {
    id: "hot",
    label: "لید داغ",
    probability: 30,
    nextAction: "پیگیری فوری و تعیین جلسه",
  },
  {
    id: "qualified",
    label: "واجد شرایط",
    probability: 50,
    nextAction: "تکمیل نیازسنجی و آماده‌سازی پیشنهاد",
  },
  {
    id: "negotiating",
    label: "مذاکره",
    probability: 75,
    nextAction: "نهایی‌سازی پیشنهاد و شروط قرارداد",
  },
  {
    id: "converted",
    label: "برنده",
    probability: 100,
    nextAction: "شروع فرایند تحویل و آنبوردینگ",
  },
];

const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]));

const ALLOWED_TRANSITIONS = new Map([
  ["new", new Set(["hot", "qualified"])],
  ["hot", new Set(["new", "qualified", "negotiating"])],
  ["qualified", new Set(["hot", "negotiating"])],
  ["negotiating", new Set(["qualified", "converted"])],
  ["converted", new Set()],
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

function serializeStage(stage) {
  return {
    ...stage,
    allowedTargets: [...(ALLOWED_TRANSITIONS.get(stage.id) || [])],
  };
}

function enrichLead(lead, now) {
  const stage = STAGE_BY_ID.get(lead.status) || STAGE_BY_ID.get("new");
  const ageDays = wholeDaysSince(lead.createdAt, now);
  const idleDays = wholeDaysSince(lead.updatedAt, now);

  return {
    id: lead.id,
    title: lead.name,
    company: lead.company || "بدون شرکت",
    amount: Number(lead.opportunityValue) || 0,
    currency: "IRT",
    stage: stage.id,
    owner: "تیم فروش",
    lastActivityAt: lead.updatedAt,
    nextAction: stage.nextAction,
    ageDays,
    idleDays,
    isStuck: stage.id !== "converted" && idleDays >= 3,
    probability: stage.probability,
    expectedUpdatedAt: lead.updatedAt,
  };
}

export function createCrmPipelineService({ getLeads, getLeadById, updateLead, now = () => Date.now() }) {
  if (!getLeads || !getLeadById || !updateLead) {
    throw new Error("CRM pipeline service requires lead repository functions.");
  }

  function board() {
    const timestamp = now();
    const deals = getLeads().map((lead) => enrichLead(lead, timestamp));

    return {
      stages: STAGES.map(serializeStage),
      deals,
    };
  }

  function transition({ dealId, toStage, expectedUpdatedAt }) {
    if (!STAGE_BY_ID.has(toStage)) {
      throw new CrmPipelineError("مرحله مقصد معتبر نیست.", {
        code: "INVALID_STAGE",
        status: 400,
      });
    }

    const current = getLeadById(dealId);
    if (!current) {
      throw new CrmPipelineError("فرصت فروش پیدا نشد.", {
        code: "DEAL_NOT_FOUND",
        status: 404,
      });
    }

    if (!expectedUpdatedAt || current.updatedAt !== expectedUpdatedAt) {
      throw new CrmPipelineError("این فرصت فروش تغییر کرده است. برد را تازه‌سازی کنید.", {
        code: "STALE_DEAL_VERSION",
        status: 409,
      });
    }

    if (current.status === toStage) {
      return enrichLead(current, now());
    }

    const allowedTargets = ALLOWED_TRANSITIONS.get(current.status) || new Set();
    if (!allowedTargets.has(toStage)) {
      throw new CrmPipelineError("این جابه‌جایی در Pipeline مجاز نیست.", {
        code: "TRANSITION_NOT_ALLOWED",
        status: 409,
      });
    }

    const updated = updateLead(dealId, { status: toStage });
    if (!updated) {
      throw new CrmPipelineError("فرصت فروش پیدا نشد.", {
        code: "DEAL_NOT_FOUND",
        status: 404,
      });
    }

    return enrichLead(updated, now());
  }

  return {
    board,
    transition,
    stages: () => STAGES.map(serializeStage),
  };
}
