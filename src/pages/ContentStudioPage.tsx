import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { withDemo } from "../lib/demoMode";
import { apiFetch } from "../lib/api";

import {
  ArrowRight,
  Sparkle,
  Brain,
  FileText,
  InstagramLogo,
  VideoCamera,
  Image,
  CalendarBlank,
  Plus,
  Check,
  Copy,
  MagicWand,
  Target,
  Lightbulb,
  TrendUp,
  ChatCircleText,
  Megaphone,
  Hash,
  Clock,
  Eye,
  PencilSimple,
  CheckCircle,
  Lightning,
  BookOpenText,
  UsersThree,
} from "@phosphor-icons/react";

type ContentType = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  accent: "violet" | "cyan" | "pink" | "blue";
};

type Idea = {
  title: string;
  category: string;
  score: number;
  description: string;
};

type CalendarItem = {
  day: string;
  title: string;
  type: string;
  status: "آماده" | "در حال ساخت" | "برنامه‌ریزی";
};

const contentTypes: ContentType[] = [
  {
    id: "instagram",
    title: "پست اینستاگرام",
    description: "کپشن، ساختار اسلاید و ایده بصری",
    icon: InstagramLogo,
    accent: "pink",
  },
  {
    id: "reel",
    title: "ریلز و ویدیو کوتاه",
    description: "سناریو، هوک، متن و ساختار ویدیو",
    icon: VideoCamera,
    accent: "violet",
  },
  {
    id: "blog",
    title: "مقاله و بلاگ",
    description: "مقاله آموزشی، سئو و محتوای تخصصی",
    icon: FileText,
    accent: "blue",
  },
  {
    id: "banner",
    title: "متن تبلیغاتی",
    description: "تیتر، پیشنهاد فروش و پیام کمپین",
    icon: Megaphone,
    accent: "cyan",
  },
  {
    id: "story",
    title: "استوری",
    description: "استوری فروش، آموزشی و تعاملی",
    icon: Image,
    accent: "pink",
  },
  {
    id: "sms",
    title: "پیام کوتاه",
    description: "پیامک، اعلان و پیام‌های کوتاه تبلیغاتی",
    icon: ChatCircleText,
    accent: "cyan",
  },
];

const ideas: Idea[] = [
  {
    title: "۵ اشتباه رایج در بازاریابی که فروش را کم می‌کند",
    category: "آموزشی",
    score: 94,
    description: "مناسب برای پست اسلایدی و ریلز آموزشی",
  },
  {
    title: "چطور در ۳۰ روز مشتری بیشتری جذب کنیم؟",
    category: "رشد",
    score: 91,
    description: "موضوع مناسب برای محتوای ارزش‌محور و لیدساز",
  },
  {
    title: "پشت صحنه یک کمپین موفق",
    category: "اعتمادسازی",
    score: 88,
    description: "مناسب برای ویدیو کوتاه و استوری",
  },
  {
    title: "چرا بعضی تبلیغات نتیجه نمی‌دهند؟",
    category: "تحلیلی",
    score: 86,
    description: "موضوع مناسب برای مقاله و پست تخصصی",
  },
];

const calendarItems: CalendarItem[] = [
  {
    day: "شنبه",
    title: "پست آموزشی",
    type: "اینستاگرام",
    status: "آماده",
  },
  {
    day: "یکشنبه",
    title: "ریلز محصول",
    type: "ویدیو",
    status: "در حال ساخت",
  },
  {
    day: "دوشنبه",
    title: "مقاله وبلاگ",
    type: "مقاله",
    status: "برنامه‌ریزی",
  },
  {
    day: "سه‌شنبه",
    title: "استوری فروش",
    type: "استوری",
    status: "آماده",
  },
];

export default function ContentStudioPage() {
  const [activeType, setActiveType] = useState("instagram");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("حرفه‌ای و صمیمی");
  const [goal, setGoal] = useState("افزایش تعامل");
  const [notice, setNotice] = useState("");

  const [generatedContent, setGeneratedContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const currentType = useMemo(
    () =>
      contentTypes.find((item) => item.id === activeType) ??
      contentTypes[0],
    [activeType]
  );

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2200);
  };

  const generateContent = async () => {
    if (!topic.trim()) {
      setAiError("لطفاً ابتدا موضوع یا ایده اصلی را وارد کن.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const response = await apiFetch(
        "/api/agent/run",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "content",
            topic,
            goal,
            tone,
            contentType: currentType.id,
            typeTitle: currentType.title,
            maxTokens: 500,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تولید محتوا انجام نشد."
        );
      }

      setGeneratedContent(data.answer || "");
      showNotice("محتوا با موفقیت تولید شد.");
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : "ارتباط با موتور هوش مصنوعی برقرار نشد."
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <main
      dir="rtl"
      className="loadder-dashboard-bg min-h-screen text-white"
    >
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1550px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              to={withDemo("/dashboard")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowRight size={18} />
            </Link>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/15 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
              <Sparkle
                size={25}
                weight="fill"
                className="text-fuchsia-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                استودیوی تولید محتوا
              </h1>

              <p className="mt-1 text-sm text-white/45">
                ایده، متن، سناریو و برنامه محتوایی در یک مرکز
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              showNotice(
                "ساخت پروژه محتوایی جدید در مرحله اتصال Business Brain فعال می‌شود."
              )
            }
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-fuchsia-500 px-5 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(99,102,241,.18)]"
          >
            <Plus size={17} />
            پروژه محتوایی جدید
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1550px] px-8 py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[22%] h-[320px] w-[320px] rounded-full bg-fuchsia-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_380px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/15 bg-fuchsia-500/[0.08] px-4 py-2 text-sm text-fuchsia-200">
                <Brain
                  size={16}
                  weight="duotone"
                />
                تولید محتوای هوشمند
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                از یک ایده ساده،
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {" "}
                  محتوای آماده انتشار بساز.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                Loadder در آینده برند، محصول، لحن، مخاطب و هدف بازاریابی
                را می‌شناسد و بر اساس همان اطلاعات محتوای متناسب برای
                هر کانال تولید می‌کند.
              </p>
            </div>

            <div className="rounded-[26px] border border-violet-300/15 bg-violet-500/[0.06] p-6">
              <div className="flex items-center gap-3">
                <Lightbulb
                  size={22}
                  weight="duotone"
                  className="text-violet-300"
                />

                <h3 className="text-lg font-semibold">
                  پیشنهاد امروز Loadder
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                محتوای آموزشی درباره حل یک مشکل واقعی مخاطب بیشترین
                پتانسیل تعامل را دارد. پیشنهاد می‌شود امروز یک پست
                اسلایدی آموزشی منتشر شود.
              </p>

              <div className="mt-5 flex items-center gap-2 text-xs text-cyan-300/75">
                <TrendUp size={16} />
                پتانسیل تعامل بالا
              </div>
            </div>
          </div>
        </section>

        {/* CONTENT TYPES */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              چه محتوایی می‌خواهی بسازی؟
            </h2>

            <p className="mt-1 text-sm text-white/40">
              نوع محتوا را انتخاب کن.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contentTypes.map((item) => (
              <ContentTypeCard
                key={item.id}
                item={item}
                active={item.id === activeType}
                onClick={() => setActiveType(item.id)}
              />
            ))}
          </div>
        </section>

        {/* GENERATOR */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <MagicWand
                size={24}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  ساخت محتوا
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  چند اطلاعات ساده بده؛ Loadder بقیه را می‌سازد.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-white/55">
                  موضوع یا ایده اصلی
                </label>

                <textarea
                  value={topic}
                  onChange={(event) =>
                    setTopic(event.target.value)
                  }
                  placeholder="مثلاً: چطور یک کسب‌وکار کوچک با بودجه کم تبلیغات مؤثر داشته باشد؟"
                  rows={5}
                  className="w-full resize-none rounded-[20px] border border-white/[0.08] bg-black/20 p-4 text-sm leading-8 text-white outline-none placeholder:text-white/25 focus:border-violet-400/30"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="هدف محتوا"
                  value={goal}
                  options={[
                    "افزایش تعامل",
                    "فروش",
                    "آگاهی از برند",
                    "جذب مشتری بالقوه",
                    "آموزش",
                  ]}
                  onChange={setGoal}
                />

                <SelectField
                  label="لحن محتوا"
                  value={tone}
                  options={[
                    "حرفه‌ای و صمیمی",
                    "رسمی",
                    "آموزشی",
                    "جسور و خلاق",
                    "فروش‌محور",
                  ]}
                  onChange={setTone}
                />
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                <div className="text-xs text-white/35">
                  نوع محتوا
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <currentType.icon
                    size={19}
                    weight="duotone"
                    className="text-cyan-300"
                  />

                  <span className="text-sm font-semibold">
                    {currentType.title}
                  </span>
                </div>
              </div>

              {aiError && (
                <div className="rounded-2xl border border-red-400/15 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200">
                  {aiError}
                </div>
              )}

              <button
                type="button"
                onClick={generateContent}
                disabled={aiLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-fuchsia-500 px-6 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <Lightning
                      size={18}
                      weight="fill"
                      className="animate-pulse"
                    />
                    Loadder در حال ساخت محتواست...
                  </>
                ) : (
                  <>
                    <Sparkle
                      size={18}
                      weight="fill"
                    />
                    تولید محتوا با Loadder
                  </>
                )}
              </button>
            </div>
          </div>

          {/* GENERATED PREVIEW */}
          <aside className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-fuchsia-500/[0.04] p-7 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  پیش‌نمایش محتوا
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  نمونه خروجی آماده ویرایش
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!generatedContent) {
                    showNotice("هنوز محتوایی تولید نشده است.");
                    return;
                  }

                  await navigator.clipboard.writeText(
                    generatedContent
                  );

                  showNotice("محتوا کپی شد.");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/50 transition hover:bg-white/[0.07] hover:text-white"
              >
                <Copy size={17} />
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/[0.07] bg-black/20 p-5">
              <div className="text-xs text-violet-300">
                نمونه محتوای تولیدشده
              </div>

              {generatedContent ? (
                <div className="mt-4 whitespace-pre-wrap text-sm leading-9 text-white/70">
                  {generatedContent}
                </div>
              ) : (
                <>
                  <h3 className="mt-4 text-lg font-bold leading-8">
                    خروجی هوش مصنوعی اینجا نمایش داده می‌شود
                  </h3>

                  <p className="mt-4 text-sm leading-8 text-white/45">
                    موضوع، هدف و لحن محتوا را مشخص کن و روی
                    «تولید محتوا با Loadder» بزن.
                  </p>
                </>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  "#بازاریابی",
                  "#تبلیغات",
                  "#فروش",
                  "#کسب_و_کار",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-cyan-300/10 bg-cyan-500/[0.06] px-3 py-1.5 text-xs text-cyan-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <ActionButton
                icon={PencilSimple}
                text="ویرایش محتوا"
                onClick={() =>
                  showNotice(
                    "ویرایشگر حرفه‌ای محتوا در مرحله بعد فعال می‌شود."
                  )
                }
              />

              <ActionButton
                icon={CheckCircle}
                text="تأیید محتوا"
                onClick={() =>
                  showNotice(
                    "محتوا برای انتشار تأیید شد."
                  )
                }
              />
            </div>
          </aside>
        </section>

        {/* IDEAS */}
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                ایده‌های پیشنهادی
              </h2>

              <p className="mt-1 text-sm text-white/40">
                موضوعاتی که احتمال عملکرد بهتر دارند.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-cyan-300/75">
              <Sparkle size={15} weight="fill" />
              پیشنهاد هوشمند
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.title}
                idea={idea}
                onClick={() => {
                  setTopic(idea.title);
                  showNotice(
                    "ایده به بخش تولید محتوا منتقل شد."
                  );
                }}
              />
            ))}
          </div>
        </section>

        {/* CONTENT PERFORMANCE */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  عملکرد محتوا
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  چه نوع محتوایی بهتر نتیجه می‌دهد؟
                </p>
              </div>

              <Eye
                size={22}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div className="mt-6 space-y-4">
              <PerformanceRow
                title="محتوای آموزشی"
                value={91}
                description="بیشترین تعامل"
              />

              <PerformanceRow
                title="معرفی محصول"
                value={78}
                description="عملکرد مناسب فروش"
              />

              <PerformanceRow
                title="محتوای اعتمادساز"
                value={84}
                description="مناسب افزایش اعتماد"
              />

              <PerformanceRow
                title="محتوای مستقیم فروش"
                value={64}
                description="نیازمند بهبود پیام"
              />
            </div>
          </div>

          {/* CONTENT CALENDAR */}
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  تقویم محتوا
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  برنامه انتشار هفته
                </p>
              </div>

              <CalendarBlank
                size={22}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div className="mt-6 space-y-3">
              {calendarItems.map((item) => (
                <CalendarRow
                  key={`${item.day}-${item.title}`}
                  item={item}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                showNotice(
                  "تقویم محتوایی کامل در مرحله Social Manager یکپارچه می‌شود."
                )
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/55"
            >
              <Plus size={15} />
              افزودن محتوا به تقویم
            </button>
          </div>
        </section>

        {/* CONTENT DNA */}
        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                DNA محتوای برند
              </h2>

              <p className="mt-1 text-sm text-white/40">
                ویژگی‌هایی که Loadder در تولید محتوا رعایت می‌کند.
              </p>
            </div>

            <BookOpenText
              size={23}
              weight="duotone"
              className="text-violet-300"
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DNAItem
              icon={Target}
              title="هدف"
              value="رشد و اعتمادسازی"
            />

            <DNAItem
              icon={ChatCircleText}
              title="لحن"
              value="حرفه‌ای و صمیمی"
            />

            <DNAItem
              icon={UsersThreeIcon}
              title="مخاطب"
              value="مدیر و صاحب کسب‌وکار"
            />

            <DNAItem
              icon={Hash}
              title="سبک محتوا"
              value="آموزشی و کاربردی"
            />
          </div>
        </section>

        {/* AI CONTENT BRAIN */}
        <section className="mt-8 overflow-hidden rounded-[32px] border border-violet-400/15 bg-gradient-to-l from-violet-500/[0.10] via-[#080d1d]/70 to-fuchsia-500/[0.05] p-8 backdrop-blur-xl">
          <div className="grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/[0.08]">
                  <Brain
                    size={26}
                    weight="duotone"
                    className="text-violet-300"
                  />
                </div>

                <div>
                  <h2 className="text-2xl font-bold">
                    مغز محتوایی Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    تولید محتوا بر اساس شناخت واقعی کسب‌وکار
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                در نسخه کامل، Loadder از Brand Book، محصولات، رفتار مخاطب،
                عملکرد محتوای گذشته، اهداف فروش و داده‌های شبکه‌های اجتماعی
                استفاده می‌کند تا به‌جای محتوای عمومی، محتوای اختصاصی همان
                کسب‌وکار را تولید کند.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <SmartCard
                  icon={Brain}
                  title="شناخت برند"
                  value="بر اساس Brand Book"
                />

                <SmartCard
                  icon={TrendUp}
                  title="شناخت عملکرد"
                  value="بر اساس داده واقعی"
                />

                <SmartCard
                  icon={Target}
                  title="شناخت هدف"
                  value="بر اساس KPI"
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-6">
              <div className="flex items-center gap-2">
                <Lightning
                  size={20}
                  weight="duotone"
                  className="text-cyan-300"
                />

                <span className="font-semibold">
                  اقدام هوشمند
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <ActionButton
                  icon={Lightbulb}
                  text="پیشنهاد ۱۰ ایده جدید"
                  onClick={() =>
                    showNotice(
                      "ایده‌ها در آینده بر اساس داده واقعی برند تولید می‌شوند."
                    )
                  }
                />

                <ActionButton
                  icon={CalendarBlank}
                  text="ساخت تقویم یک ماهه"
                  onClick={() =>
                    showNotice(
                      "تقویم هوشمند در مرحله اتصال Social Manager فعال می‌شود."
                    )
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "ساخت خودکار کمپین محتوایی پس از اتصال Automation فعال می‌شود."
                    )
                  }
                  className="w-full rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-fuchsia-500 px-4 py-3 text-sm font-semibold"
                >
                  ساخت کمپین محتوایی
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {notice && (
        <div className="fixed bottom-7 left-7 z-[100] max-w-md rounded-2xl border border-violet-300/20 bg-[#090e1e]/95 px-5 py-4 text-sm shadow-2xl backdrop-blur-xl">
          {notice}
        </div>
      )}
    </main>
  );
}

function ContentTypeCard({
  item,
  active,
  onClick,
}: {
  item: ContentType;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  const accentMap = {
    violet: "text-violet-300",
    cyan: "text-cyan-300",
    pink: "text-fuchsia-300",
    blue: "text-blue-300",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-5 text-right backdrop-blur-xl transition ${
        active
          ? "border-violet-400/30 bg-violet-500/[0.08]"
          : "border-white/[0.08] bg-[#080d1d]/62 hover:-translate-y-1 hover:border-violet-300/20"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20">
          <Icon
            size={22}
            weight="duotone"
            className={accentMap[item.accent]}
          />
        </div>

        {active && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-white">
            <Check
              size={14}
              weight="bold"
            />
          </div>
        )}
      </div>

      <h3 className="mt-4 font-semibold">
        {item.title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-white/40">
        {item.description}
      </p>
    </button>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-white/55">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-violet-400/30"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
            className="bg-[#080d1d]"
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function IdeaCard({
  idea,
  onClick,
}: {
  idea: Idea;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 text-right backdrop-blur-xl transition hover:-translate-y-1 hover:border-violet-300/20"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-violet-300/10 bg-violet-500/[0.06] px-3 py-1.5 text-xs text-violet-200">
          {idea.category}
        </span>

        <span className="text-sm font-bold text-cyan-300">
          {idea.score}٪
        </span>
      </div>

      <h3 className="mt-4 font-semibold leading-7">
        {idea.title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-white/40">
        {idea.description}
      </p>
    </button>
  );
}

function PerformanceRow({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">
            {title}
          </div>

          <div className="mt-1 text-xs text-white/35">
            {description}
          </div>
        </div>

        <div className="text-sm font-bold text-cyan-300">
          {value}٪
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300"
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}

function CalendarRow({
  item,
}: {
  item: CalendarItem;
}) {
  const statusStyle =
    item.status === "آماده"
      ? "text-emerald-300 bg-emerald-500/[0.07] border-emerald-400/10"
      : item.status === "در حال ساخت"
        ? "text-amber-300 bg-amber-500/[0.07] border-amber-400/10"
        : "text-violet-300 bg-violet-500/[0.07] border-violet-400/10";

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div>
        <div className="text-xs text-white/30">
          {item.day}
        </div>

        <div className="mt-1 text-sm font-semibold">
          {item.title}
        </div>

        <div className="mt-1 text-xs text-white/35">
          {item.type}
        </div>
      </div>

      <span
        className={`rounded-full border px-3 py-1.5 text-xs ${statusStyle}`}
      >
        {item.status}
      </span>
    </div>
  );
}

function DNAItem({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <Icon
        size={21}
        weight="duotone"
        className="text-cyan-300"
      />

      <div className="mt-4 text-xs text-white/35">
        {title}
      </div>

      <div className="mt-1 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}

function SmartCard({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <Icon
        size={20}
        weight="duotone"
        className="text-cyan-300"
      />

      <div className="mt-3 text-sm font-semibold">
        {title}
      </div>

      <div className="mt-1 text-xs text-white/35">
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  text,
  onClick,
}: {
  icon: React.ElementType;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60 transition hover:bg-white/[0.06]"
    >
      <Icon size={16} />
      {text}
    </button>
  );
}

function UsersThreeIcon({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <UsersThree
      size={size}
      weight="duotone"
      className={className}
    />
  );
}
