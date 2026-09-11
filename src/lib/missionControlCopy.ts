/**
 * Mission Control presentation vocabulary.
 *
 * Extracted so Home and the full attention surface translate identical
 * canonical values identically. Nothing here reads or derives; it is a lookup
 * from canonical tokens to everyday Persian, plus the two guards that keep
 * raw tokens and unvetted deep links off the screen.
 */

export type Fact={label:string;value:unknown;sourceRef:{type:string;id:string}};
export type Belief={recommendationId:string;code:string;state:string;confidence:number|null;confidenceReason:string};
export type Item={signalId:string;band:string;facts:Fact[];beliefs:Belief[];unknown:string[];action:{label:string;requiredApproval:string;executable:false;deepLink:string};explainability:Record<string,unknown>;whyThisIsHere:string};
export type MissionControl={contractVersion:number;generatedAt:string;items:Item[];banners:Array<{code:string;staleReasons?:string[]}>;signalStatus:Array<{signalId:string;status:"ok"|"failed"}>;bounds:{maxItems:number;truncated:boolean}};

export const signalLabels:Record<string,string>={EXPERIMENT_WINDOW_CLOSED_NO_DECISION:"پنجره سنجش آزمایش بسته شده است",CONVERTED_LEAD_WITHOUT_TREATMENT_LINKAGE:"تبدیل CRM به شواهد رشد متصل نیست",UNDECIDED_RECOMMENDATION:"یک پیشنهاد منتظر تصمیم انسانی است",CONTENT_CANDIDATE_STUCK:"نامزد محتوا نیازمند بررسی است"};
export const actionLabels:Record<string,string>={REVIEW_EXPERIMENT_OUTCOME:"بررسی نتیجه آزمایش",REVIEW_EVIDENCE_LINKAGE:"بررسی اتصال شواهد",REVIEW_RECOMMENDATION:"بررسی پیشنهاد",REVIEW_CONTENT_CANDIDATE:"بررسی نامزد محتوا"};
export const factLabels:Record<string,string>={EXPERIMENT_STATUS:"وضعیت آزمایش",MEASUREMENT_WINDOW_ENDED_AT:"پایان پنجره سنجش",DECISION_STATE:"وضعیت تصمیم",CRM_EVENT_TYPE:"رویداد CRM",OCCURRED_AT:"زمان وقوع",EVIDENCE_AUTHORITY:"مرجع شواهد",RECOMMENDATION_TYPE:"نوع پیشنهاد",CALCULATED_AT:"زمان محاسبه",CANDIDATE_STATE:"وضعیت نامزد",CREATED_AT:"زمان ایجاد"};
export const bandLabels:Record<string,string>={DECIDE_TODAY:"امروز تصمیم بگیرید",REVIEW:"بررسی",FYI:"اطلاعی"};
export const bandStyles:Record<string,{card:string;chip:string;tone:string}>={
  DECIDE_TODAY:{card:"border-amber-300/35 bg-amber-400/[0.09]",chip:"border-amber-200/30 bg-amber-300/15 text-amber-50",tone:"strong"},
  REVIEW:{card:"border-violet-300/20 bg-black/25",chip:"border-violet-200/25 bg-violet-400/10 text-violet-100",tone:"normal"},
  FYI:{card:"border-white/[0.08] bg-white/[0.025]",chip:"border-white/10 bg-white/[0.04] text-white/65",tone:"subtle"},
};
export const values:Record<string,string>={NO_DECISION:"بدون تصمیم",DEFERRED:"به تعویق افتاده",AMBIGUOUS:"مبهم؛ نیازمند بررسی",CANONICAL_RECORD:"رکورد معتبر دامنه",REPORTED:"گزارش‌شده",UNKNOWN:"نامشخص",RECONCILIATION_REQUIRED:"نیازمند تطبیق",PENDING:"در انتظار",DRAFT:"پیش‌نویس",READY:"آماده",RUNNING:"در حال اجرا",COMPLETED:"تکمیل‌شده",EXPERIMENT_OUTCOME_REVIEW:"بازبینی نتیجه آزمایش",INSPECT_FUNNEL_BOTTLENECK:"بررسی گلوگاه قیف",GATHER_MORE_EVIDENCE:"گردآوری شواهد بیشتر",CREATE_CONTENT_VARIANT:"ساخت نسخه محتوایی تازه",PREPARE_NEXT_EXPERIMENT_DRAFT:"آماده‌سازی پیش‌نویس آزمایش بعدی",INCONCLUSIVE:"نتیجه نامشخص",ACTIONABLE:"آماده بررسی انسانی","lead.converted":"تبدیل سرنخ"};
export const reasons:Record<string,string>={MEASUREMENT_WINDOW_ENDED_WITHOUT_GOVERNED_DECISION:"پنجره سنجش تمام شده اما تصمیم نهایی و قابل اتکا ثبت نشده است.",CANONICAL_CRM_CONVERSION_HAS_NO_GROWTH_EVIDENCE_LINK:"یک تبدیل معتبر CRM هنوز به درمان یا آزمایش رشد متصل نشده است؛ این به معنی از دست رفتن درآمد یا انتساب نیست.",GOVERNED_RECOMMENDATION_HAS_NO_DECISION:"پیشنهاد ثبت شده است، اما تصمیم انسانی درباره آن وجود ندارد.",PROVIDER_OUTCOME_REQUIRES_RECONCILIATION:"نتیجه ارائه‌دهنده قطعی نیست و باید پیش از هر اقدام تطبیق داده شود.",CANDIDATE_PENDING_BEYOND_AGE_FLOOR:"نامزد محتوا بیش از آستانه سیاست در انتظار مانده است."};
export const unknownLabels:Record<string,string>={BUSINESS_IMPACT_VALUE:"اثر کسب‌وکاری نامشخص",CAUSALITY:"رابطه علّی نامشخص",ATTRIBUTION:"انتساب نامشخص",EXPERIMENT_EFFECTIVENESS:"اثربخشی نامشخص",TREATMENT_LINKAGE:"اتصال درمان نامشخص",PROVIDER_OUTCOME:"نتیجه ارائه‌دهنده نامشخص"};
export const staleLabels:Record<string,string>={BUSINESS_PROFILE_CHANGED:"پروفایل کسب‌وکار تغییر کرده است",BUSINESS_DNA_CHANGED:"DNA کسب‌وکار تغییر کرده است",BRAND_BOOK_CHANGED:"برندبوک تغییر کرده است"};
export const allowedLinks=[/^\/dashboard\/growth-loop\/[^/?#]+$/, /^\/dashboard\/content$/, /^\/dashboard\/crm$/, /^\/intelligence$/];

export function text(value:unknown){const raw=String(value??"UNKNOWN");if(values[raw])return values[raw];if(/^\d{4}-\d{2}-\d{2}T/.test(raw)){const date=new Date(raw);if(!Number.isNaN(date.getTime()))return new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short"}).format(date);}return /^[A-Z][A-Z0-9_]*$/.test(raw)?"وضعیت ثبت‌شده":"مقدار ثبت‌شده";}
export function safeLink(link:string){return allowedLinks.some(pattern=>pattern.test(link))?link:null;}

