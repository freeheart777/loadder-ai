/* =========================================================
   LOADDER AI
   CAMPAIGN PLANNER + OPTIMIZATION ENGINE
========================================================= */

/*
  Flow:

  PLAN
    ↓
  RECOMMEND
    ↓
  BUILD
    ↓
  MONITOR
    ↓
  DIAGNOSE
    ↓
  OPTIMIZE
    ↓
  SIMULATE
    ↓
  APPROVE / EXECUTE

  Control Modes:
  - manual
  - copilot
  - autopilot

  Scenarios:
  - conservative
  - balanced
  - aggressive
*/

/* =========================================================
   CONSTANTS
========================================================= */

export const CONTROL_MODES = {
  MANUAL: "manual",
  COPILOT: "copilot",
  AUTOPILOT: "autopilot",
};

export const PLANNER_SCENARIOS = {
  CONSERVATIVE: "conservative",
  BALANCED: "balanced",
  AGGRESSIVE: "aggressive",
};

export const CAMPAIGN_GOALS = {
  SALES: "sales",
  LEAD_GENERATION: "lead_generation",
  APP_INSTALL: "app_install",
  TRAFFIC: "traffic",
  AWARENESS: "awareness",
  RETARGETING: "retargeting",
  CUSTOMER_REACTIVATION: "customer_reactivation",
};

export const OPTIMIZATION_PROBLEMS = {
  ROAS_LOW: "ROAS_LOW",
  CPC_HIGH: "CPC_HIGH",
  CPS_HIGH: "CPS_HIGH",
  CPL_HIGH: "CPL_HIGH",
  CPO_HIGH: "CPO_HIGH",
  CAC_HIGH: "CAC_HIGH",
  CTR_LOW: "CTR_LOW",
  CLICK_TO_SESSION_DROP: "CLICK_TO_SESSION_DROP",
  SESSION_TO_LEAD_DROP: "SESSION_TO_LEAD_DROP",
  LEAD_TO_ORDER_DROP: "LEAD_TO_ORDER_DROP",
  SPEND_WITHOUT_REVENUE: "SPEND_WITHOUT_REVENUE",
  BUDGET_PACING_FAST: "BUDGET_PACING_FAST",
  BUDGET_PACING_SLOW: "BUDGET_PACING_SLOW",
  TRACKING_RISK: "TRACKING_RISK",
};

export const OPTIMIZATION_ACTIONS = {
  REDUCE_BUDGET: "reduce_budget",
  INCREASE_BUDGET: "increase_budget",
  PAUSE_CAMPAIGN: "pause_campaign",
  REVIEW_LANDING_PAGE: "review_landing_page",
  REVIEW_TARGETING: "review_targeting",
  REVIEW_KEYWORDS: "review_keywords",
  REVIEW_PLACEMENTS: "review_placements",
  REVIEW_CREATIVE: "review_creative",
  FIX_TRACKING: "fix_tracking",
  KEEP_RUNNING: "keep_running",
  REALLOCATE_BUDGET: "reallocate_budget",
};

/* =========================================================
   UTILS
========================================================= */

function toNumber(value, fallback = 0) {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : fallback;
}

function divide(a, b) {
  const numerator = toNumber(a);
  const denominator = toNumber(b);

  if (!denominator) {
    return 0;
  }

  return numerator / denominator;
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(
      toNumber(value),
      min
    ),
    max
  );
}

function round(value, digits = 2) {
  const factor = 10 ** digits;

  return (
    Math.round(
      toNumber(value) * factor
    ) / factor
  );
}

function percentage(value) {
  return round(
    toNumber(value) * 100,
    2
  );
}

function sum(items, selector) {
  return items.reduce(
    (total, item) =>
      total +
      toNumber(
        selector(item)
      ),
    0
  );
}

function normalizeWeights(items) {
  const valid = items.filter(
    (item) =>
      toNumber(item.weight) > 0
  );

  const total = sum(
    valid,
    (item) => item.weight
  );

  if (!total) {
    return [];
  }

  return valid.map(
    (item) => ({
      ...item,

      weight:
        toNumber(item.weight) /
        total,
    })
  );
}

/* =========================================================
   PLATFORM CATALOG
========================================================= */

export const PLATFORM_CATALOG = {
  google_ads: {
    id: "google_ads",
    channelId: "google_ads",
    platformId: "google",

    name: "Google Ads",
    nameFa: "گوگل ادز",

    strengths: [
      "Intent بالا",
      "تقاضای مستقیم",
      "قابل اندازه‌گیری",
      "مناسب فروش و لید",
    ],

    weaknesses: [
      "CPC ممکن است بالا باشد",
      "نیاز به Landing Page مناسب",
      "رقابت شدید روی Keywordهای ارزشمند",
    ],

    bestFor: [
      CAMPAIGN_GOALS.SALES,
      CAMPAIGN_GOALS.LEAD_GENERATION,
      CAMPAIGN_GOALS.TRAFFIC,
      CAMPAIGN_GOALS.RETARGETING,
      CAMPAIGN_GOALS.APP_INSTALL,
    ],
  },

  tavoos: {
    id: "tavoos",
    channelId: "iranian_ads",
    platformId: "tavoos",

    name: "Tavoos",
    nameFa: "طاووس",

    strengths: [
      "دسترسی به رسانه‌های داخلی",
      "مناسب Native و Display",
      "مناسب توسعه Reach",
      "قابل استفاده در Retargeting",
    ],

    weaknesses: [
      "Intent معمولاً پایین‌تر از Search",
      "کیفیت Placement باید کنترل شود",
      "نیازمند مانیتورینگ دقیق CPS و CPL",
    ],

    bestFor: [
      CAMPAIGN_GOALS.AWARENESS,
      CAMPAIGN_GOALS.TRAFFIC,
      CAMPAIGN_GOALS.RETARGETING,
      CAMPAIGN_GOALS.LEAD_GENERATION,
    ],
  },

  yektanet: {
    id: "yektanet",
    channelId: "iranian_ads",
    platformId: "yektanet",

    name: "Yektanet",
    nameFa: "یکتانت",

    strengths: [
      "Native Advertising",
      "Reach گسترده",
      "مناسب Discovery",
      "مناسب Retargeting",
    ],

    weaknesses: [
      "Intent پایین‌تر از Search",
      "Placement Waste باید کنترل شود",
      "کیفیت Session باید سنجیده شود",
    ],

    bestFor: [
      CAMPAIGN_GOALS.AWARENESS,
      CAMPAIGN_GOALS.TRAFFIC,
      CAMPAIGN_GOALS.RETARGETING,
      CAMPAIGN_GOALS.LEAD_GENERATION,
    ],
  },

  tapsell: {
    id: "tapsell",
    channelId: "app_ads",
    platformId: "tapsell",

    name: "Tapsell",
    nameFa: "تپسل",

    strengths: [
      "App Install",
      "Video",
      "Pre-roll",
      "Reach موبایلی",
    ],

    weaknesses: [
      "برای همه B2Bها مناسب نیست",
      "کیفیت نصب باید کنترل شود",
      "Retention بعد از Install مهم است",
    ],

    bestFor: [
      CAMPAIGN_GOALS.APP_INSTALL,
      CAMPAIGN_GOALS.AWARENESS,
      CAMPAIGN_GOALS.RETARGETING,
    ],
  },

  instagram: {
    id: "instagram",
    channelId: "social_ads",
    platformId: "instagram",

    name: "Instagram",
    nameFa: "اینستاگرام",

    strengths: [
      "Creative-driven",
      "Reach بالا",
      "مناسب B2C",
      "مناسب Awareness و Lead",
    ],

    weaknesses: [
      "Creative Fatigue",
      "Frequency بالا می‌تواند بودجه را هدر دهد",
      "Intent متغیر",
    ],

    bestFor: [
      CAMPAIGN_GOALS.AWARENESS,
      CAMPAIGN_GOALS.LEAD_GENERATION,
      CAMPAIGN_GOALS.SALES,
      CAMPAIGN_GOALS.RETARGETING,
    ],
  },

  sms: {
    id: "sms",
    channelId: "sms_marketing",
    platformId: "smsir",

    name: "SMS Marketing",
    nameFa: "اس‌ام‌اس مارکتینگ",

    strengths: [
      "دسترسی مستقیم",
      "مناسب Retention",
      "مناسب Retargeting",
      "مناسب Offer محدود زمانی",
    ],

    weaknesses: [
      "برای Cold Acquisition محدودتر است",
      "Frequency باید کنترل شود",
      "کیفیت Database مهم است",
    ],

    bestFor: [
      CAMPAIGN_GOALS.RETARGETING,
      CAMPAIGN_GOALS.CUSTOMER_REACTIVATION,
      CAMPAIGN_GOALS.SALES,
    ],
  },

  affiliate: {
    id: "affiliate",
    channelId: "affiliate",
    platformId: "affiliate-network",

    name: "Affiliate",
    nameFa: "افیلیت مارکتینگ",

    strengths: [
      "Performance Based",
      "ریسک Media Spend کمتر",
      "مناسب فروش",
      "مناسب Lead Generation",
    ],

    weaknesses: [
      "کنترل کیفیت Publisher ضروری است",
      "Fraud Detection مهم است",
      "Attribution باید دقیق باشد",
    ],

    bestFor: [
      CAMPAIGN_GOALS.SALES,
      CAMPAIGN_GOALS.LEAD_GENERATION,
    ],
  },
};

/* =========================================================
   DEFAULT PLATFORM KPIs
========================================================= */

const DEFAULT_KPI_TARGETS = {
  google_ads: {
    ctrMin: 3,
    sessionRateMin: 70,
    leadRateMin: 3,
    roasMin: 2.5,
  },

  tavoos: {
    ctrMin: 0.5,
    sessionRateMin: 60,
    leadRateMin: 1.5,
    roasMin: 2,
  },

  yektanet: {
    ctrMin: 0.5,
    sessionRateMin: 60,
    leadRateMin: 1.5,
    roasMin: 2,
  },

  tapsell: {
    ctrMin: 0.7,
    sessionRateMin: 55,
    leadRateMin: 1,
    roasMin: 1.8,
  },

  instagram: {
    ctrMin: 0.8,
    sessionRateMin: 55,
    leadRateMin: 2,
    roasMin: 2,
  },

  sms: {
    ctrMin: 2,
    sessionRateMin: 70,
    leadRateMin: 4,
    roasMin: 3,
  },

  affiliate: {
    ctrMin: 0,
    sessionRateMin: 0,
    leadRateMin: 0,
    roasMin: 3,
  },
};

/* =========================================================
   CONTROL MODE
========================================================= */

export function getControlModeDefinition(mode) {
  switch (mode) {
    case CONTROL_MODES.MANUAL:
      return {
        id: CONTROL_MODES.MANUAL,
        name: "Manual",
        nameFa: "دستی",

        aiCanRecommend: true,
        aiCanExecute: false,
        approvalRequired: true,

        description:
          "Loadder تحلیل و پیشنهاد می‌دهد اما هیچ تغییری را اجرا نمی‌کند.",
      };

    case CONTROL_MODES.AUTOPILOT:
      return {
        id: CONTROL_MODES.AUTOPILOT,
        name: "Auto-Pilot",
        nameFa: "خودکار",

        aiCanRecommend: true,
        aiCanExecute: true,
        approvalRequired: false,

        description:
          "Loadder فقط داخل Guardrailهای تعیین‌شده اجازه اجرای خودکار تغییرات را دارد.",
      };

    case CONTROL_MODES.COPILOT:
    default:
      return {
        id: CONTROL_MODES.COPILOT,
        name: "Co-Pilot",
        nameFa: "نیمه‌خودکار",

        aiCanRecommend: true,
        aiCanExecute: false,
        approvalRequired: true,

        description:
          "Loadder پیشنهاد می‌دهد و اجرای تغییر فقط با تأیید کاربر انجام می‌شود.",
      };
  }
}

/* =========================================================
   DEFAULT GUARDRAILS
========================================================= */

export function buildDefaultGuardrails({
  budget = {},
  targetKPIs = {},
} = {}) {
  return {
    maximumTotalBudget:
      toNumber(
        budget.total
      ),

    maximumDailyBudget:
      toNumber(
        budget.dailyMax
      ),

    minimumROAS:
      toNumber(
        targetKPIs.roasMin,
        2
      ) || 2,

    maximumCPC:
      targetKPIs.cpcMax ??
      null,

    maximumCPS:
      targetKPIs.cpsMax ??
      null,

    maximumCPL:
      targetKPIs.cplMax ??
      null,

    maximumCPO:
      targetKPIs.cpoMax ??
      null,

    maximumCAC:
      targetKPIs.cacMax ??
      null,

    maximumAutomaticBudgetChangePercent:
      15,

    stopOnTrackingFailure:
      true,

    stopOnBudgetExceeded:
      true,

    requireApprovalForNewCampaign:
      true,

    requireApprovalForNewCreative:
      true,

    requireApprovalForNewAudience:
      true,

    requireApprovalForLargeBudgetIncrease:
      true,

    allowAutomaticBudgetReallocation:
      true,

    allowAutomaticPause:
      true,

    allowAutomaticScale:
      true,
  };
}

/* =========================================================
   GOAL WEIGHTS
========================================================= */

function getGoalWeights(
  goal,
  audience = {}
) {
  const isB2B =
    audience.type === "b2b";

  switch (goal) {
    case CAMPAIGN_GOALS.SALES:
      return [
        {
          platform: "google_ads",
          weight: isB2B
            ? 0.45
            : 0.35,
        },

        {
          platform: "instagram",
          weight: isB2B
            ? 0.1
            : 0.25,
        },

        {
          platform: "tavoos",
          weight: 0.1,
        },

        {
          platform: "yektanet",
          weight: 0.1,
        },

        {
          platform: "affiliate",
          weight: 0.1,
        },

        {
          platform: "sms",
          weight: 0.05,
        },

        {
          platform: "tapsell",
          weight: isB2B
            ? 0
            : 0.05,
        },
      ];

    case CAMPAIGN_GOALS.LEAD_GENERATION:
      return [
        {
          platform: "google_ads",
          weight: isB2B
            ? 0.5
            : 0.35,
        },

        {
          platform: "instagram",
          weight: isB2B
            ? 0.1
            : 0.3,
        },

        {
          platform: "tavoos",
          weight: 0.15,
        },

        {
          platform: "yektanet",
          weight: 0.15,
        },

        {
          platform: "affiliate",
          weight: 0.05,
        },

        {
          platform: "sms",
          weight: 0.05,
        },
      ];

    case CAMPAIGN_GOALS.APP_INSTALL:
      return [
        {
          platform: "tapsell",
          weight: 0.4,
        },

        {
          platform: "google_ads",
          weight: 0.3,
        },

        {
          platform: "instagram",
          weight: 0.2,
        },

        {
          platform: "tavoos",
          weight: 0.05,
        },

        {
          platform: "yektanet",
          weight: 0.05,
        },
      ];

    case CAMPAIGN_GOALS.AWARENESS:
      return [
        {
          platform: "instagram",
          weight: 0.3,
        },

        {
          platform: "tavoos",
          weight: 0.2,
        },

        {
          platform: "yektanet",
          weight: 0.2,
        },

        {
          platform: "tapsell",
          weight: 0.15,
        },

        {
          platform: "google_ads",
          weight: 0.15,
        },
      ];

    case CAMPAIGN_GOALS.RETARGETING:
      return [
        {
          platform: "google_ads",
          weight: 0.3,
        },

        {
          platform: "instagram",
          weight: 0.25,
        },

        {
          platform: "yektanet",
          weight: 0.15,
        },

        {
          platform: "tavoos",
          weight: 0.15,
        },

        {
          platform: "sms",
          weight: 0.15,
        },
      ];

    case CAMPAIGN_GOALS.CUSTOMER_REACTIVATION:
      return [
        {
          platform: "sms",
          weight: 0.4,
        },

        {
          platform: "instagram",
          weight: 0.2,
        },

        {
          platform: "google_ads",
          weight: 0.15,
        },

        {
          platform: "yektanet",
          weight: 0.1,
        },

        {
          platform: "tavoos",
          weight: 0.1,
        },

        {
          platform: "affiliate",
          weight: 0.05,
        },
      ];

    case CAMPAIGN_GOALS.TRAFFIC:
    default:
      return [
        {
          platform: "google_ads",
          weight: 0.3,
        },

        {
          platform: "instagram",
          weight: 0.2,
        },

        {
          platform: "tavoos",
          weight: 0.2,
        },

        {
          platform: "yektanet",
          weight: 0.2,
        },

        {
          platform: "tapsell",
          weight: 0.1,
        },
      ];
  }
}

/* =========================================================
   SCENARIO MODIFIERS
========================================================= */

function applyScenario(
  allocations,
  scenario
) {
  const modified =
    allocations.map(
      (item) => {
        let weight =
          toNumber(
            item.weight
          );

        if (
          scenario ===
          PLANNER_SCENARIOS.CONSERVATIVE
        ) {
          if (
            item.platform ===
              "google_ads" ||
            item.platform ===
              "sms" ||
            item.platform ===
              "affiliate"
          ) {
            weight *= 1.2;
          }

          if (
            item.platform ===
              "tapsell" ||
            item.platform ===
              "instagram"
          ) {
            weight *= 0.85;
          }
        }

        if (
          scenario ===
          PLANNER_SCENARIOS.AGGRESSIVE
        ) {
          if (
            item.platform ===
              "instagram" ||
            item.platform ===
              "tapsell" ||
            item.platform ===
              "tavoos" ||
            item.platform ===
              "yektanet"
          ) {
            weight *= 1.2;
          }

          if (
            item.platform ===
            "sms"
          ) {
            weight *= 0.8;
          }
        }

        return {
          ...item,
          weight,
        };
      }
    );

  return normalizeWeights(
    modified
  );
}

/* =========================================================
   PLATFORM KPI TARGETS
========================================================= */

function buildPlatformKPIs({
  platform,
  budget,
  customerValue,
  averageOrderValue,
  goal,
}) {
  const defaults =
    DEFAULT_KPI_TARGETS[
      platform
    ] || {};

  const spend =
    toNumber(
      budget
    );

  const customerValueNumber =
    toNumber(
      customerValue
    );

  const averageOrder =
    toNumber(
      averageOrderValue
    );

  const economicValue =
    customerValueNumber ||
    averageOrder ||
    0;

  let targetCAC =
    economicValue > 0
      ? economicValue * 0.2
      : 0;

  let targetCPO =
    averageOrder > 0
      ? averageOrder * 0.15
      : targetCAC;

  let targetCPL =
    targetCAC > 0
      ? targetCAC * 0.25
      : 0;

  if (
    goal ===
    CAMPAIGN_GOALS.LEAD_GENERATION
  ) {
    targetCPL =
      targetCAC > 0
        ? targetCAC * 0.3
        : 0;
  }

  if (
    goal ===
    CAMPAIGN_GOALS.AWARENESS
  ) {
    targetCAC = 0;
    targetCPO = 0;
    targetCPL = 0;
  }

  return {
    spendTarget:
      round(spend, 0),

    ctrMin:
      defaults.ctrMin ??
      0,

    sessionRateMin:
      defaults.sessionRateMin ??
      0,

    leadRateMin:
      defaults.leadRateMin ??
      0,

    cpcMax:
      spend > 0
        ? round(
            spend / 500,
            0
          )
        : null,

    cpsMax:
      spend > 0
        ? round(
            spend / 400,
            0
          )
        : null,

    cplMax:
      targetCPL > 0
        ? round(
            targetCPL,
            0
          )
        : null,

    cpoMax:
      targetCPO > 0
        ? round(
            targetCPO,
            0
          )
        : null,

    cacMax:
      targetCAC > 0
        ? round(
            targetCAC,
            0
          )
        : null,

    roasMin:
      defaults.roasMin ??
      2,
  };
}

/* =========================================================
   PLATFORM ANALYSIS
========================================================= */

function buildPlatformAnalysis({
  platformKey,
  goal,
  audience,
  budget,
  timeline,
  allocation,
  targetKPIs,
}) {
  const platform =
    PLATFORM_CATALOG[
      platformKey
    ];

  if (!platform) {
    return null;
  }

  const suitability =
    platform.bestFor.includes(
      goal
    )
      ? 90
      : 55;

  let confidence =
    suitability;

  if (
    audience.type ===
      "b2b" &&
    platformKey ===
      "google_ads"
  ) {
    confidence += 5;
  }

  if (
    audience.type ===
      "b2b" &&
    platformKey ===
      "tapsell"
  ) {
    confidence -= 20;
  }

  if (
    timeline.days &&
    timeline.days < 7
  ) {
    confidence -= 10;
  }

  confidence =
    clamp(
      confidence,
      20,
      98
    );

  return {
    platform:
      platform.id,

    channelId:
      platform.channelId,

    platformId:
      platform.platformId,

    name:
      platform.name,

    nameFa:
      platform.nameFa,

    suitabilityScore:
      suitability,

    confidence,

    recommendedBudget:
      round(
        allocation,
        0
      ),

    recommendedBudgetPercent:
      percentage(
        divide(
          allocation,
          budget.total
        )
      ),

    recommendedDailyBudget:
      timeline.days > 0
        ? round(
            allocation /
              timeline.days,
            0
          )
        : 0,

    strengths:
      platform.strengths,

    weaknesses:
      platform.weaknesses,

    targetKPIs,

    recommendation:
      platform.bestFor.includes(
        goal
      )
        ? "برای هدف این کمپین مناسب است."
        : "به عنوان کانال مکمل استفاده شود.",
  };
}

/* =========================================================
   PLANNER
========================================================= */

export function planCampaign({
  goal =
    CAMPAIGN_GOALS.LEAD_GENERATION,

  targetAudience = {},

  product = {},

  budget = {},

  timeline = {},

  scenario =
    PLANNER_SCENARIOS.BALANCED,

  controlMode =
    CONTROL_MODES.COPILOT,

  targetKPIs = {},
} = {}) {
  const totalBudget =
    toNumber(
      budget.total
    );

  const days =
    Math.max(
      toNumber(
        timeline.days,
        30
      ),
      1
    );

  const normalizedTimeline = {
    ...timeline,
    days,
  };

  const baseWeights =
    getGoalWeights(
      goal,
      targetAudience
    );

  const scenarioWeights =
    applyScenario(
      baseWeights,
      scenario
    );

  const allocations =
    scenarioWeights.map(
      (item) => ({
        platform:
          item.platform,

        weight:
          item.weight,

        amount:
          totalBudget *
          item.weight,
      })
    );

  const platformAnalysis =
    allocations
      .map(
        (item) => {
          const platformKPIs =
            buildPlatformKPIs({
              platform:
                item.platform,

              budget:
                item.amount,

              customerValue:
                targetAudience
                  .customerValue,

              averageOrderValue:
                product
                  .averageOrderValue ||
                product.price,

              goal,
            });

          return buildPlatformAnalysis({
            platformKey:
              item.platform,

            goal,

            audience:
              targetAudience,

            budget: {
              total:
                totalBudget,
            },

            timeline:
              normalizedTimeline,

            allocation:
              item.amount,

            targetKPIs:
              platformKPIs,
          });
        }
      )
      .filter(Boolean);

  const overallTargetKPIs = {
    roasMin:
      toNumber(
        targetKPIs.roasMin,
        2.5
      ) || 2.5,

    cplMax:
      targetKPIs.cplMax ??
      null,

    cacMax:
      targetKPIs.cacMax ??
      null,

    cpoMax:
      targetKPIs.cpoMax ??
      null,
  };

  const guardrails =
    buildDefaultGuardrails({
      budget: {
        total:
          totalBudget,

        dailyMax:
          toNumber(
            budget.dailyMax
          ) ||
          round(
            totalBudget /
              days,
            0
          ),
      },

      targetKPIs:
        overallTargetKPIs,
    });

  return {
    plannerVersion:
      "1.0",

    goal,

    targetAudience,

    product,

    budget: {
      total:
        totalBudget,

      dailyRecommended:
        round(
          totalBudget /
            days,
          0
        ),

      dailyMax:
        guardrails
          .maximumDailyBudget,
    },

    timeline:
      normalizedTimeline,

    scenario,

    controlMode:
      getControlModeDefinition(
        controlMode
      ),

    guardrails,

    recommendations: {
      platforms:
        platformAnalysis,

      primaryPlatform:
        platformAnalysis[0] ||
        null,

      recommendedMediaMix:
        platformAnalysis.map(
          (item) => ({
            platform:
              item.platform,

            nameFa:
              item.nameFa,

            percent:
              item.recommendedBudgetPercent,

            amount:
              item.recommendedBudget,
          })
        ),

      strategicAdvice:
        buildStrategicAdvice({
          goal,
          scenario,
          targetAudience,
          timeline:
            normalizedTimeline,
          platformAnalysis,
        }),
    },
  };
}

/* =========================================================
   STRATEGIC ADVICE
========================================================= */

function buildStrategicAdvice({
  goal,
  scenario,
  targetAudience,
  timeline,
  platformAnalysis,
}) {
  const top =
    platformAnalysis[0];

  const second =
    platformAnalysis[1];

  const messages = [];

  if (top) {
    messages.push(
      `${top.nameFa} به عنوان کانال اصلی پیشنهاد می‌شود.`
    );
  }

  if (second) {
    messages.push(
      `${second.nameFa} به عنوان کانال مکمل برای تنوع منبع جذب استفاده شود.`
    );
  }

  if (
    targetAudience.type ===
    "b2b"
  ) {
    messages.push(
      "برای B2B، کیفیت Lead و نرخ تبدیل به مشتری مهم‌تر از حجم Click است."
    );
  }

  if (
    goal ===
    CAMPAIGN_GOALS.LEAD_GENERATION
  ) {
    messages.push(
      "CPL به‌تنهایی کافی نیست؛ Lead → Customer و CAC باید معیار اصلی Optimize باشند."
    );
  }

  if (
    goal ===
    CAMPAIGN_GOALS.SALES
  ) {
    messages.push(
      "ROAS و CPO باید مستقیماً از Revenue واقعی CRM محاسبه شوند."
    );
  }

  if (
    timeline.days <= 14
  ) {
    messages.push(
      "بازه زمانی کوتاه است؛ تغییرات بودجه باید محافظه‌کارانه و سریع ارزیابی شوند."
    );
  }

  if (
    scenario ===
    PLANNER_SCENARIOS.CONSERVATIVE
  ) {
    messages.push(
      "سناریوی محافظه‌کارانه روی کانال‌های با Intent بالاتر و ریسک کمتر تمرکز دارد."
    );
  }

  if (
    scenario ===
    PLANNER_SCENARIOS.AGGRESSIVE
  ) {
    messages.push(
      "سناریوی تهاجمی Reach و Discovery بیشتری می‌خرد و نیازمند Guardrail سخت‌گیرانه‌تر است."
    );
  }

  return messages;
}

/* =========================================================
   SCENARIOS
========================================================= */

export function buildCampaignScenarios(
  input = {}
) {
  return {
    conservative:
      planCampaign({
        ...input,

        scenario:
          PLANNER_SCENARIOS.CONSERVATIVE,
      }),

    balanced:
      planCampaign({
        ...input,

        scenario:
          PLANNER_SCENARIOS.BALANCED,
      }),

    aggressive:
      planCampaign({
        ...input,

        scenario:
          PLANNER_SCENARIOS.AGGRESSIVE,
      }),
  };
}

/* =========================================================
   HEALTH SCORE
========================================================= */

function calculateHealthScore({
  roas,
  targetROAS,

  cpc,
  maxCPC,

  cps,
  maxCPS,

  cpl,
  maxCPL,

  cpo,
  maxCPO,

  cac,
  maxCAC,

  ctr,
  minCTR,

  sessionRate,
  minSessionRate,
}) {
  let score = 100;

  if (
    targetROAS > 0 &&
    roas < targetROAS
  ) {
    score -= 20;
  }

  if (
    maxCPC &&
    cpc > maxCPC
  ) {
    score -= 10;
  }

  if (
    maxCPS &&
    cps > maxCPS
  ) {
    score -= 10;
  }

  if (
    maxCPL &&
    cpl > maxCPL
  ) {
    score -= 15;
  }

  if (
    maxCPO &&
    cpo > maxCPO
  ) {
    score -= 15;
  }

  if (
    maxCAC &&
    cac > maxCAC
  ) {
    score -= 20;
  }

  if (
    minCTR &&
    ctr < minCTR
  ) {
    score -= 5;
  }

  if (
    minSessionRate &&
    sessionRate <
      minSessionRate
  ) {
    score -= 10;
  }

  return clamp(
    score,
    0,
    100
  );
}

/* =========================================================
   PROBLEM DETECTION
========================================================= */

function detectProblems({
  performance = {},
  targets = {},
  budget = {},
  trackingHealthy = true,
}) {
  const problems = [];

  const media =
    performance.media ||
    {};

  const attributed =
    performance.attributed ||
    {};

  const kpis =
    performance.kpis ||
    {};

  const spend =
    toNumber(
      media.spend
    );

  const revenue =
    toNumber(
      attributed.revenue
    );

  const roas =
    toNumber(
      kpis.roas
    );

  const cpc =
    toNumber(
      kpis.cpc
    );

  const cps =
    toNumber(
      kpis.cps
    );

  const cpl =
    toNumber(
      kpis.cpl
    );

  const cpo =
    toNumber(
      kpis.cpo
    );

  const cac =
    toNumber(
      kpis.cac
    );

  const ctr =
    toNumber(
      kpis.ctr
    );

  const sessionRate =
    toNumber(
      kpis.sessionRate
    );

  if (!trackingHealthy) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.TRACKING_RISK,

      severity:
        "critical",

      diagnosis:
        "Tracking سالم نیست و تصمیم‌گیری خودکار می‌تواند خطرناک باشد.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.FIX_TRACKING,

      requiresApproval:
        true,
    });
  }

  if (
    spend > 0 &&
    revenue === 0
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.SPEND_WITHOUT_REVENUE,

      severity:
        "critical",

      diagnosis:
        "کمپین در حال مصرف بودجه است اما Revenue واقعی منتسب‌شده ندارد.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.REDUCE_BUDGET,

      suggestedChangePercent:
        20,

      requiresApproval:
        true,
    });
  }

  if (
    targets.roasMin &&
    roas <
      targets.roasMin
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.ROAS_LOW,

      severity:
        roas < 1
          ? "critical"
          : "high",

      diagnosis:
        `ROAS فعلی ${round(
          roas,
          2
        )}x پایین‌تر از Target ${round(
          targets.roasMin,
          2
        )}x است.`,

      recommendedAction:
        OPTIMIZATION_ACTIONS.REDUCE_BUDGET,

      suggestedChangePercent:
        roas < 1
          ? 25
          : 15,

      requiresApproval:
        true,
    });
  }

  if (
    targets.cpcMax &&
    cpc >
      targets.cpcMax
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.CPC_HIGH,

      severity:
        "medium",

      diagnosis:
        "هزینه هر کلیک از Target عبور کرده است.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.REVIEW_KEYWORDS,

      requiresApproval:
        true,
    });
  }

  if (
    targets.cpsMax &&
    cps >
      targets.cpsMax
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.CPS_HIGH,

      severity:
        "high",

      diagnosis:
        "Cost Per Session بالاتر از Target است.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.REVIEW_LANDING_PAGE,

      requiresApproval:
        true,
    });
  }

  if (
    targets.cplMax &&
    cpl >
      targets.cplMax
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.CPL_HIGH,

      severity:
        "high",

      diagnosis:
        "Cost Per Lead بالاتر از سطح هدف است.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.REVIEW_TARGETING,

      requiresApproval:
        true,
    });
  }

  if (
    targets.cpoMax &&
    cpo >
      targets.cpoMax
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.CPO_HIGH,

      severity:
        "high",

      diagnosis:
        "Cost Per Order بیش از حد هدف است.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.REDUCE_BUDGET,

      suggestedChangePercent:
        15,

      requiresApproval:
        true,
    });
  }

  if (
    targets.cacMax &&
    cac >
      targets.cacMax
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.CAC_HIGH,

      severity:
        "critical",

      diagnosis:
        "CAC بالاتر از Target اقتصادی کمپین است.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.REDUCE_BUDGET,

      suggestedChangePercent:
        20,

      requiresApproval:
        true,
    });
  }

  if (
    targets.ctrMin &&
    ctr <
      targets.ctrMin
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.CTR_LOW,

      severity:
        "medium",

      diagnosis:
        "CTR پایین است و Creative / Keyword / Targeting باید بررسی شود.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.REVIEW_CREATIVE,

      requiresApproval:
        true,
    });
  }

  if (
    targets.sessionRateMin &&
    sessionRate <
      targets.sessionRateMin
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.CLICK_TO_SESSION_DROP,

      severity:
        "high",

      diagnosis:
        "بخش قابل توجهی از Clickها به Session واقعی تبدیل نمی‌شوند.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.REVIEW_LANDING_PAGE,

      requiresApproval:
        true,
    });
  }

  const totalBudget =
    toNumber(
      budget.total
    );

  const spentPercent =
    totalBudget > 0
      ? divide(
          spend,
          totalBudget
        )
      : 0;

  if (
    spentPercent >= 0.3 &&
    revenue === 0
  ) {
    problems.push({
      code:
        OPTIMIZATION_PROBLEMS.SPEND_WITHOUT_REVENUE,

      severity:
        "critical",

      diagnosis:
        "بیش از ۳۰٪ بودجه مصرف شده اما هنوز Revenue ثبت نشده است.",

      recommendedAction:
        OPTIMIZATION_ACTIONS.PAUSE_CAMPAIGN,

      requiresApproval:
        true,
    });
  }

  return problems;
}

/* =========================================================
   WASTE SCORE
========================================================= */

function calculateWasteScore({
  problems = [],
  spend = 0,
  revenue = 0,
}) {
  let score = 0;

  for (
    const problem
    of problems
  ) {
    switch (
      problem.severity
    ) {
      case "critical":
        score += 25;
        break;

      case "high":
        score += 15;
        break;

      case "medium":
        score += 8;
        break;

      default:
        score += 3;
    }
  }

  if (
    spend > 0 &&
    revenue === 0
  ) {
    score += 20;
  }

  return clamp(
    score,
    0,
    100
  );
}

/* =========================================================
   POTENTIAL SAVINGS
========================================================= */

function estimatePotentialSavings({
  spend,
  wasteScore,
}) {
  const riskShare =
    clamp(
      wasteScore / 100,
      0,
      0.5
    );

  return round(
    toNumber(spend) *
      riskShare,
    0
  );
}

/* =========================================================
   RECOMMENDATION ENGINE
========================================================= */

function buildRecommendations({
  problems,
  performance,
  controlMode,
}) {
  const mode =
    getControlModeDefinition(
      controlMode
    );

  const recommendations =
    problems.map(
      (
        problem,
        index
      ) => {
        const canAutoExecute =
          mode.aiCanExecute &&
          problem.severity !==
            "critical";

        return {
          id:
            `recommendation-${
              index + 1
            }`,

          problem:
            problem.code,

          severity:
            problem.severity,

          diagnosis:
            problem.diagnosis,

          action:
            problem.recommendedAction,

          suggestedChangePercent:
            problem.suggestedChangePercent ??
            null,

          requiresApproval:
            canAutoExecute
              ? false
              : true,

          executable:
            canAutoExecute,

          reasoning:
            buildRecommendationReasoning(
              problem,
              performance
            ),
        };
      }
    );

  if (
    recommendations.length ===
    0
  ) {
    recommendations.push({
      id:
        "recommendation-healthy",

      problem:
        null,

      severity:
        "healthy",

      diagnosis:
        "در حال حاضر مشکل بحرانی در کمپین شناسایی نشده است.",

      action:
        OPTIMIZATION_ACTIONS.KEEP_RUNNING,

      suggestedChangePercent:
        null,

      requiresApproval:
        false,

      executable:
        false,

      reasoning:
        "Performance فعلی داخل محدوده قابل قبول Targetها قرار دارد.",
    });
  }

  return recommendations;
}

function buildRecommendationReasoning(
  problem,
  performance
) {
  const media =
    performance.media ||
    {};

  const attributed =
    performance.attributed ||
    {};

  const kpis =
    performance.kpis ||
    {};

  return {
    spend:
      toNumber(
        media.spend
      ),

    revenue:
      toNumber(
        attributed.revenue
      ),

    roas:
      toNumber(
        kpis.roas
      ),

    cpc:
      toNumber(
        kpis.cpc
      ),

    cps:
      toNumber(
        kpis.cps
      ),

    cpl:
      toNumber(
        kpis.cpl
      ),

    cpo:
      toNumber(
        kpis.cpo
      ),

    cac:
      toNumber(
        kpis.cac
      ),

    problem:
      problem.code,
  };
}

/* =========================================================
   CAMPAIGN OPTIMIZATION
========================================================= */

export function optimizeCampaign({
  campaign = {},

  performance = {},

  targets = {},

  guardrails = {},

  controlMode =
    CONTROL_MODES.COPILOT,

  trackingHealthy =
    true,
} = {}) {
  const media =
    performance.media ||
    {};

  const attributed =
    performance.attributed ||
    {};

  const kpis =
    performance.kpis ||
    {};

  const problems =
    detectProblems({
      performance: {
        media,
        attributed,
        kpis,
      },

      targets,

      budget: {
        total:
          campaign.budget ||
          guardrails
            .maximumTotalBudget ||
          0,
      },

      trackingHealthy,
    });

  const wasteScore =
    calculateWasteScore({
      problems,

      spend:
        media.spend,

      revenue:
        attributed.revenue,
    });

  const healthScore =
    calculateHealthScore({
      roas:
        kpis.roas,

      targetROAS:
        targets.roasMin,

      cpc:
        kpis.cpc,

      maxCPC:
        targets.cpcMax,

      cps:
        kpis.cps,

      maxCPS:
        targets.cpsMax,

      cpl:
        kpis.cpl,

      maxCPL:
        targets.cplMax,

      cpo:
        kpis.cpo,

      maxCPO:
        targets.cpoMax,

      cac:
        kpis.cac,

      maxCAC:
        targets.cacMax,

      ctr:
        kpis.ctr,

      minCTR:
        targets.ctrMin,

      sessionRate:
        kpis.sessionRate,

      minSessionRate:
        targets.sessionRateMin,
    });

  const recommendations =
    buildRecommendations({
      problems,

      performance,

      controlMode,
    });

  const potentialSavings =
    estimatePotentialSavings({
      spend:
        media.spend,

      wasteScore,
    });

  return {
    optimizerVersion:
      "1.0",

    campaignId:
      campaign.id ||
      null,

    controlMode:
      getControlModeDefinition(
        controlMode
      ),

    health: {
      score:
        healthScore,

      status:
        healthScore >= 80
          ? "healthy"
          : healthScore >= 60
            ? "watch"
            : healthScore >= 40
              ? "risk"
              : "critical",
    },

    waste: {
      score:
        wasteScore,

      status:
        wasteScore <= 20
          ? "low"
          : wasteScore <= 45
            ? "medium"
            : wasteScore <= 70
              ? "high"
              : "critical",

      potentialSavings,
    },

    problems,

    recommendations,

    guardrails,

    snapshot: {
      spend:
        toNumber(
          media.spend
        ),

      impressions:
        toNumber(
          media.impressions
        ),

      clicks:
        toNumber(
          media.clicks
        ),

      sessions:
        toNumber(
          media.sessions
        ),

      leads:
        toNumber(
          attributed.leads
        ),

      customers:
        toNumber(
          attributed.customers
        ),

      orders:
        toNumber(
          attributed.orders
        ),

      revenue:
        toNumber(
          attributed.revenue
        ),

      roas:
        toNumber(
          kpis.roas
        ),

      cpc:
        toNumber(
          kpis.cpc
        ),

      cps:
        toNumber(
          kpis.cps
        ),

      cpl:
        toNumber(
          kpis.cpl
        ),

      cpo:
        toNumber(
          kpis.cpo
        ),

      cac:
        toNumber(
          kpis.cac
        ),
    },
  };
}

/* =========================================================
   SIMULATION
========================================================= */

export function simulateOptimization({
  performance = {},

  recommendation = {},

  confidence = 0.7,
} = {}) {
  const media =
    performance.media ||
    {};

  const attributed =
    performance.attributed ||
    {};

  const kpis =
    performance.kpis ||
    {};

  const spend =
    toNumber(
      media.spend
    );

  const revenue =
    toNumber(
      attributed.revenue
    );

  const leads =
    toNumber(
      attributed.leads
    );

  const orders =
    toNumber(
      attributed.orders
    );

  const changePercent =
    Math.abs(
      toNumber(
        recommendation
          .suggestedChangePercent
      )
    );

  let projectedSpend =
    spend;

  let projectedRevenue =
    revenue;

  let projectedLeads =
    leads;

  let projectedOrders =
    orders;

  if (
    recommendation.action ===
    OPTIMIZATION_ACTIONS.REDUCE_BUDGET
  ) {
    projectedSpend =
      spend *
      (1 -
        changePercent /
          100);

    projectedRevenue =
      revenue *
      (1 -
        changePercent /
          200);
  }

  if (
    recommendation.action ===
    OPTIMIZATION_ACTIONS.INCREASE_BUDGET
  ) {
    projectedSpend =
      spend *
      (1 +
        changePercent /
          100);

    projectedRevenue =
      revenue *
      (1 +
        changePercent /
          125);

    projectedLeads =
      leads *
      (1 +
        changePercent /
          150);

    projectedOrders =
      orders *
      (1 +
        changePercent /
          160);
  }

  const projectedROAS =
    divide(
      projectedRevenue,
      projectedSpend
    );

  return {
    simulationVersion:
      "1.0",

    confidence:
      round(
        clamp(
          confidence,
          0,
          1
        ) * 100,
        0
      ),

    current: {
      spend,
      revenue,
      leads,
      orders,

      roas:
        toNumber(
          kpis.roas
        ),
    },

    forecast: {
      spend:
        round(
          projectedSpend,
          0
        ),

      revenue:
        round(
          projectedRevenue,
          0
        ),

      leads:
        round(
          projectedLeads,
          0
        ),

      orders:
        round(
          projectedOrders,
          0
        ),

      roas:
        round(
          projectedROAS,
          2
        ),
    },

    disclaimer:
      "این خروجی فعلاً Rule-Based Simulation است و پیش‌بینی قطعی نیست. در نسخه بعد با داده تاریخی واقعی کمپین Calibration می‌شود.",
  };
}

/* =========================================================
   BUDGET REALLOCATION
========================================================= */

export function suggestBudgetReallocation(
  campaignResults = []
) {
  if (
    !Array.isArray(
      campaignResults
    ) ||
    campaignResults.length === 0
  ) {
    return {
      totalBudget: 0,
      allocations: [],
    };
  }

  const totalBudget =
    sum(
      campaignResults,
      (item) =>
        item.performance?.media
          ?.spend || 0
    );

  const scored =
    campaignResults.map(
      (item) => {
        const roas =
          toNumber(
            item.performance
              ?.kpis?.roas
          );

        const wasteScore =
          toNumber(
            item.optimization
              ?.waste?.score
          );

        const healthScore =
          toNumber(
            item.optimization
              ?.health?.score
          );

        const score =
          clamp(
            roas * 20 +
              healthScore -
              wasteScore,
            1,
            200
          );

        return {
          campaignId:
            item.campaign?.id,

          name:
            item.campaign?.name,

          score,
        };
      }
    );

  const totalScore =
    sum(
      scored,
      (item) => item.score
    );

  const allocations =
    scored.map(
      (item) => {
        const share =
          divide(
            item.score,
            totalScore
          );

        return {
          campaignId:
            item.campaignId,

          name:
            item.name,

          recommendedBudget:
            round(
              totalBudget *
                share,
              0
            ),

          recommendedPercent:
            round(
              share * 100,
              2
            ),
        };
      }
    );

  return {
    totalBudget,
    allocations,
  };
}

/* =========================================================
   EXPORT SUMMARY
========================================================= */

export function getOptimizerCapabilities() {
  return {
    planner: true,

    scenarios: [
      PLANNER_SCENARIOS.CONSERVATIVE,
      PLANNER_SCENARIOS.BALANCED,
      PLANNER_SCENARIOS.AGGRESSIVE,
    ],

    controlModes: [
      CONTROL_MODES.MANUAL,
      CONTROL_MODES.COPILOT,
      CONTROL_MODES.AUTOPILOT,
    ],

    platforms: Object.values(
      PLATFORM_CATALOG
    ).map(
      (platform) => ({
        id:
          platform.id,

        name:
          platform.name,

        nameFa:
          platform.nameFa,
      })
    ),

    optimization: true,

    simulation: true,

    budgetReallocation: true,

    wasteDetection: true,

    guardrails: true,
  };
}