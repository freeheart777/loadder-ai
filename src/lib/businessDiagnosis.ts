import {
  BUSINESS_FOUNDATION_DESTINATION,
  DIRECT_SERVICE_DESTINATIONS,
} from "./customerJourney";

export type DiagnosisAreaId = "website" | "social" | "content" | "ads" | "crm";
export type DiagnosisAreaState = "UNANSWERED" | "UNKNOWN" | "MISSING" | "NEEDS_WORK" | "HEALTHY";
export type DiagnosisGoal = "UNSURE" | "PRESENCE" | "LEADS" | "CONTENT" | "SALES";

export type DiagnosisAnswers = Record<DiagnosisAreaId, DiagnosisAreaState>;

export type DiagnosisRecommendation = {
  id: string;
  title: string;
  reason: string;
  destination: string | null;
  actionLabel: string | null;
  priority: "HIGH" | "MEDIUM" | "INFO";
};

export const DIAGNOSIS_AREAS = Object.freeze([
  { id: "website", title: "وب‌سایت", description: "حضور رسمی، معرفی خدمات و مسیر تبدیل مشتری" },
  { id: "social", title: "شبکه‌های اجتماعی", description: "پیج فعال، حضور منظم و ارتباط با مخاطب" },
  { id: "content", title: "محتوا", description: "محتوای متنی یا تبلیغاتی منظم و قابل استفاده" },
  { id: "ads", title: "تبلیغات", description: "کمپین فعال یا سابقه تبلیغات قابل اندازه‌گیری" },
  { id: "crm", title: "CRM و مدیریت لید", description: "ثبت لیدها، مشتریان و پیگیری ارتباطات" },
] as const);

export const DIAGNOSIS_STATE_OPTIONS = Object.freeze([
  { value: "MISSING", label: "ندارم" },
  { value: "NEEDS_WORK", label: "دارم، ولی نیاز به بهبود دارد" },
  { value: "HEALTHY", label: "دارم و فعلاً مناسب است" },
  { value: "UNKNOWN", label: "مطمئن نیستم" },
] as const);

export const EMPTY_DIAGNOSIS_ANSWERS: DiagnosisAnswers = Object.freeze({
  website: "UNANSWERED",
  social: "UNANSWERED",
  content: "UNANSWERED",
  ads: "UNANSWERED",
  crm: "UNANSWERED",
});

export function diagnosisComplete(answers: DiagnosisAnswers) {
  return Object.values(answers).every((value) => value !== "UNANSWERED");
}

export function recommendDiagnosisNextSteps(
  answers: DiagnosisAnswers,
  goal: DiagnosisGoal,
): DiagnosisRecommendation[] {
  const recommendations: DiagnosisRecommendation[] = [];
  const websiteWeak = answers.website === "MISSING" || answers.website === "NEEDS_WORK";
  const contentWeak = answers.content === "MISSING" || answers.content === "NEEDS_WORK";

  if (websiteWeak) {
    recommendations.push({
      id: "website",
      title: answers.website === "MISSING" ? "ساخت زیرساخت وب‌سایت" : "بازطراحی یا تکمیل وب‌سایت",
      reason: answers.website === "MISSING"
        ? "خودت اعلام کردی وب‌سایت نداری؛ برای حضور رسمی و مسیر تبدیل، این شکاف بنیادی است."
        : "خودت وضعیت وب‌سایت را نیازمند بهبود ثبت کردی؛ قبل از توسعه کانال‌های دیگر، این پایه باید قابل اتکا شود.",
      destination: DIRECT_SERVICE_DESTINATIONS.WEBSITE,
      actionLabel: "رفتن به سایت‌ساز",
      priority: "HIGH",
    });
  }

  if (!websiteWeak && answers.website === "HEALTHY" && goal === "LEADS") {
    recommendations.push({
      id: "landing",
      title: "ساخت مسیر جذب لید",
      reason: "وب‌سایتت را مناسب اعلام کردی و هدفت جذب لید است؛ یک لندینگ متمرکز می‌تواند مسیر تبدیل مشخص‌تری بسازد.",
      destination: DIRECT_SERVICE_DESTINATIONS.LANDING,
      actionLabel: "ساخت صفحه فرود",
      priority: "HIGH",
    });
  }

  if (contentWeak && (goal === "CONTENT" || goal === "PRESENCE" || answers.website === "HEALTHY")) {
    recommendations.push({
      id: "content",
      title: answers.content === "MISSING" ? "ایجاد پایه محتوایی" : "تقویت سیستم محتوا",
      reason: answers.content === "MISSING"
        ? "خودت اعلام کردی محتوای منظم نداری؛ برای ارتباط مستمر با مخاطب این شکاف باید پوشش داده شود."
        : "خودت وضعیت محتوا را نیازمند بهبود ثبت کردی؛ بهتر است قبل از افزایش حجم انتشار، پایه پیام و محتوا تقویت شود.",
      destination: DIRECT_SERVICE_DESTINATIONS.CONTENT,
      actionLabel: "رفتن به استودیوی محتوا",
      priority: "MEDIUM",
    });
  }

  const unsupportedGaps = [
    answers.social !== "HEALTHY" ? "شبکه‌های اجتماعی" : null,
    answers.ads !== "HEALTHY" ? "تبلیغات" : null,
    answers.crm !== "HEALTHY" ? "CRM و مدیریت لید" : null,
  ].filter(Boolean) as string[];

  if (unsupportedGaps.length) {
    recommendations.push({
      id: "recorded-gaps",
      title: "نیازهایی که فعلاً فقط ثبت می‌شوند",
      reason: `در پاسخ‌ها برای ${unsupportedGaps.join("، ")} شکاف یا ابهام وجود دارد. لودر در این نسخه این موارد را به‌عنوان نیاز تشخیص می‌دهد، اما آن‌ها را به سرویس ساختگی یا اجرای خودکار وصل نمی‌کند.`,
      destination: null,
      actionLabel: null,
      priority: "INFO",
    });
  }

  if (!recommendations.some((item) => item.destination)) {
    recommendations.unshift({
      id: "deeper-foundation",
      title: "بررسی عمیق‌تر کسب‌وکار",
      reason: goal === "UNSURE"
        ? "از پاسخ‌های فعلی هنوز یک اقدام مستقیم قطعی به‌دست نمی‌آید و هدف اصلی هم روشن نیست؛ مرحله منطقی بعدی تکمیل شناخت کسب‌وکار است."
        : "از پاسخ‌های فعلی یک اقدام مستقیم قطعی به‌دست نمی‌آید؛ برای پیشنهاد دقیق‌تر باید شناخت کسب‌وکار و هدف رشد کامل‌تر شود.",
      destination: BUSINESS_FOUNDATION_DESTINATION,
      actionLabel: "ادامه شناخت کسب‌وکار",
      priority: "MEDIUM",
    });
  }

  return recommendations.slice(0, 4);
}
