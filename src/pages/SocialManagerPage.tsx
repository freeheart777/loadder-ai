import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  InstagramLogo,
  TelegramLogo,
  WhatsappLogo,
  YoutubeLogo,
  FacebookLogo,
  LinkedinLogo,
  Sparkle,
  Brain,
  Plus,
  CalendarBlank,
  Clock,
  CheckCircle,
  WarningCircle,
  TrendUp,
  Eye,
  ChatCircleText,
  Heart,
  ShareNetwork,
  UsersThree,
  Megaphone,
  PencilSimple,
  Trash,
  PaperPlaneTilt,
  Lightning,
  Target,
  Funnel,
  ChartLineUp,
} from "@phosphor-icons/react";

type SocialPlatform = {
  id: string;
  title: string;
  handle: string;
  icon: React.ElementType;
  connected: boolean;
  followers: string;
  engagement: string;
  growth: string;
};

type ScheduledPost = {
  id: number;
  title: string;
  platform: string;
  date: string;
  time: string;
  status: "آماده" | "در حال ساخت" | "منتشر شده";
};

type InboxItem = {
  id: number;
  name: string;
  platform: string;
  message: string;
  time: string;
  unread: boolean;
};

const platforms: SocialPlatform[] = [
  {
    id: "instagram",
    title: "اینستاگرام",
    handle: "@brand",
    icon: InstagramLogo,
    connected: true,
    followers: "۱۲۸K",
    engagement: "۸.۴٪",
    growth: "+۱۲٪",
  },
  {
    id: "telegram",
    title: "تلگرام",
    handle: "@brand_channel",
    icon: TelegramLogo,
    connected: true,
    followers: "۴۸K",
    engagement: "۶.۲٪",
    growth: "+۸٪",
  },
  {
    id: "whatsapp",
    title: "واتساپ",
    handle: "Business",
    icon: WhatsappLogo,
    connected: true,
    followers: "۱۶K",
    engagement: "۹.۱٪",
    growth: "+۱۵٪",
  },
  {
    id: "youtube",
    title: "یوتیوب",
    handle: "Brand Channel",
    icon: YoutubeLogo,
    connected: false,
    followers: "—",
    engagement: "—",
    growth: "—",
  },
  {
    id: "linkedin",
    title: "لینکدین",
    handle: "Company Page",
    icon: LinkedinLogo,
    connected: false,
    followers: "—",
    engagement: "—",
    growth: "—",
  },
  {
    id: "facebook",
    title: "فیسبوک",
    handle: "Brand Page",
    icon: FacebookLogo,
    connected: false,
    followers: "—",
    engagement: "—",
    growth: "—",
  },
];

const scheduledPosts: ScheduledPost[] = [
  {
    id: 1,
    title: "۵ اشتباه رایج در تبلیغات",
    platform: "اینستاگرام",
    date: "شنبه ۲۱ مرداد",
    time: "۱۸:۳۰",
    status: "آماده",
  },
  {
    id: 2,
    title: "ویدیو معرفی محصول جدید",
    platform: "اینستاگرام",
    date: "یکشنبه ۲۲ مرداد",
    time: "۲۰:۰۰",
    status: "در حال ساخت",
  },
  {
    id: 3,
    title: "راهنمای رشد فروش آنلاین",
    platform: "تلگرام",
    date: "دوشنبه ۲۳ مرداد",
    time: "۱۲:۰۰",
    status: "آماده",
  },
  {
    id: 4,
    title: "پیشنهاد ویژه هفته",
    platform: "واتساپ",
    date: "سه‌شنبه ۲۴ مرداد",
    time: "۱۰:۳۰",
    status: "آماده",
  },
  {
    id: 5,
    title: "پست آموزشی رشد کسب‌وکار",
    platform: "اینستاگرام",
    date: "چهارشنبه ۲۵ مرداد",
    time: "۱۹:۰۰",
    status: "منتشر شده",
  },
];

const inboxItems: InboxItem[] = [
  {
    id: 1,
    name: "علی رضایی",
    platform: "اینستاگرام",
    message: "سلام، درباره قیمت سرویس تبلیغات سؤال داشتم.",
    time: "۸ دقیقه پیش",
    unread: true,
  },
  {
    id: 2,
    name: "سارا کریمی",
    platform: "واتساپ",
    message: "برای همکاری با مجموعه شما چه مراحلی باید انجام بدیم؟",
    time: "۲۲ دقیقه پیش",
    unread: true,
  },
  {
    id: 3,
    name: "محمد نادری",
    platform: "تلگرام",
    message: "ممنون بابت محتوای آموزشی امروز.",
    time: "۱ ساعت پیش",
    unread: false,
  },
  {
    id: 4,
    name: "مریم احمدی",
    platform: "اینستاگرام",
    message: "لینک ثبت‌نام کمپین رو می‌فرستید؟",
    time: "۲ ساعت پیش",
    unread: false,
  },
];

const contentPerformance = [
  {
    title: "پست آموزشی",
    reach: "۸۴K",
    engagement: "۹.۲٪",
    score: 94,
  },
  {
    title: "ریلز معرفی محصول",
    reach: "۶۸K",
    engagement: "۸.۱٪",
    score: 88,
  },
  {
    title: "استوری فروش",
    reach: "۴۲K",
    engagement: "۷.۴٪",
    score: 82,
  },
  {
    title: "پست تبلیغاتی مستقیم",
    reach: "۳۸K",
    engagement: "۵.۱٪",
    score: 68,
  },
];

export default function SocialManagerPage() {
  const [activePlatform, setActivePlatform] =
    useState("instagram");

  const [notice, setNotice] = useState("");

  const currentPlatform = useMemo(
    () =>
      platforms.find(
        (platform) => platform.id === activePlatform
      ) ?? platforms[0],
    [activePlatform]
  );

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2200);
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
              to="/dashboard"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowRight size={18} />
            </Link>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/15 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
              <InstagramLogo
                size={25}
                weight="duotone"
                className="text-fuchsia-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                مدیریت شبکه‌های اجتماعی
              </h1>

              <p className="mt-1 text-sm text-white/45">
                برنامه‌ریزی، انتشار و تحلیل شبکه‌های اجتماعی
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              showNotice(
                "ساخت محتوای جدید بعداً به استودیوی محتوا متصل می‌شود."
              )
            }
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-fuchsia-500 px-5 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(99,102,241,.18)]"
          >
            <Plus size={17} />
            محتوای جدید
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1550px] px-8 py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[20%] h-[320px] w-[320px] rounded-full bg-fuchsia-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_380px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/15 bg-fuchsia-500/[0.08] px-4 py-2 text-sm text-fuchsia-200">
                <Brain
                  size={16}
                  weight="duotone"
                />
                مدیریت هوشمند شبکه‌های اجتماعی
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                همه شبکه‌ها را از یک جا مدیریت کن؛
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {" "}
                  محتوا، پیام و عملکرد.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                Loadder در آینده محتوای تولیدشده، تقویم انتشار، پیام‌های
                مشتریان و داده‌های عملکرد شبکه‌های اجتماعی را یکپارچه
                می‌کند تا مدیریت Social Media از یک مرکز انجام شود.
              </p>
            </div>

            <div className="rounded-[26px] border border-violet-300/15 bg-violet-500/[0.06] p-6">
              <div className="flex items-center gap-3">
                <Sparkle
                  size={21}
                  weight="fill"
                  className="text-violet-300"
                />

                <h3 className="text-lg font-semibold">
                  پیشنهاد امروز Loadder
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                پست‌های آموزشی بیشترین تعامل این هفته را ایجاد کرده‌اند.
                پیشنهاد می‌شود دو محتوای آموزشی دیگر برای اینستاگرام منتشر شود.
              </p>

              <div className="mt-5 flex items-center gap-2 text-xs text-cyan-300/75">
                <TrendUp size={16} />
                فرصت رشد تعامل
              </div>
            </div>
          </div>
        </section>

        {/* PLATFORM CARDS */}
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                شبکه‌های اجتماعی
              </h2>

              <p className="mt-1 text-sm text-white/40">
                شبکه موردنظر را انتخاب کن.
              </p>
            </div>

            <div className="text-xs text-white/35">
              ۳ شبکه متصل
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {platforms.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                active={
                  activePlatform === platform.id
                }
                onClick={() =>
                  setActivePlatform(platform.id)
                }
              />
            ))}
          </div>
        </section>

        {/* PLATFORM OVERVIEW */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {currentPlatform.title}
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  {currentPlatform.handle}
                </p>
              </div>

              <span
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  currentPlatform.connected
                    ? "border-emerald-400/10 bg-emerald-500/[0.07] text-emerald-300"
                    : "border-white/[0.07] bg-white/[0.03] text-white/35"
                }`}
              >
                {currentPlatform.connected
                  ? "متصل"
                  : "اتصال انجام نشده"}
              </span>
            </div>

            {currentPlatform.connected ? (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <MetricCard
                    title="دنبال‌کننده"
                    value={currentPlatform.followers}
                    icon={UsersThree}
                  />

                  <MetricCard
                    title="نرخ تعامل"
                    value={currentPlatform.engagement}
                    icon={Heart}
                  />

                  <MetricCard
                    title="رشد این دوره"
                    value={currentPlatform.growth}
                    icon={TrendUp}
                  />
                </div>

                <div className="mt-6 h-[220px] rounded-[24px] border border-white/[0.05] bg-black/20 p-6">
                  <div className="flex h-full items-end gap-3">
                    {[42, 55, 48, 67, 74, 70, 86, 92].map(
                      (value, index) => (
                        <div
                          key={index}
                          className="flex h-full flex-1 items-end"
                        >
                          <div
                            className="w-full rounded-t-xl bg-gradient-to-t from-violet-600/50 via-blue-500/70 to-cyan-300/90"
                            style={{
                              height: `${value}%`,
                            }}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-[24px] border border-dashed border-white/[0.08] bg-black/15 p-6 text-center">
                <div>
                  <WarningCircle
                    size={28}
                    weight="duotone"
                    className="mx-auto text-white/25"
                  />

                  <p className="mt-4 text-sm leading-7 text-white/40">
                    این شبکه هنوز به Loadder متصل نشده است.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      showNotice(
                        `اتصال ${currentPlatform.title} در مرحله API فعال می‌شود.`
                      )
                    }
                    className="mt-4 rounded-xl border border-violet-300/15 bg-violet-500/[0.08] px-4 py-3 text-sm text-violet-200"
                  >
                    اتصال شبکه
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* QUICK ANALYTICS */}
          <aside className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-fuchsia-500/[0.04] p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <ChartLineUp
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  تحلیل سریع
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  وضعیت کلی محتوای شبکه
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <AnalyticsRow
                title="دیده‌شدن"
                value="۱۱۸K"
              />

              <AnalyticsRow
                title="تعامل"
                value="۸.۴٪"
              />

              <AnalyticsRow
                title="پیام جدید"
                value="۴۸"
              />

              <AnalyticsRow
                title="مشتری بالقوه"
                value="۲۷"
              />
            </div>
          </aside>
        </section>

        {/* CONTENT CALENDAR */}
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                برنامه انتشار
              </h2>

              <p className="mt-1 text-sm text-white/40">
                محتوای برنامه‌ریزی‌شده این هفته
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                showNotice(
                  "تقویم حرفه‌ای در مرحله اتصال Content Studio فعال می‌شود."
                )
              }
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/55"
            >
              <CalendarBlank size={16} />
              مشاهده تقویم کامل
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {scheduledPosts.map((post) => (
              <ScheduledPostCard
                key={post.id}
                post={post}
                onEdit={() =>
                  showNotice(
                    `ویرایش «${post.title}» در مرحله بعد فعال می‌شود.`
                  )
                }
              />
            ))}
          </div>
        </section>

        {/* INBOX + CONTENT PERFORMANCE */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1fr_1.15fr]">
          {/* SOCIAL INBOX */}
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  صندوق پیام‌ها
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  پیام‌های شبکه‌های اجتماعی در یک جا
                </p>
              </div>

              <ChatCircleText
                size={23}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div className="mt-6 space-y-3">
              {inboxItems.map((item) => (
                <InboxRow
                  key={item.id}
                  item={item}
                  onReply={() =>
                    showNotice(
                      `پاسخ به ${item.name} در مرحله اتصال پیام‌ها فعال می‌شود.`
                    )
                  }
                />
              ))}
            </div>
          </div>

          {/* PERFORMANCE */}
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  عملکرد محتوا
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  چه محتوایی بهتر نتیجه می‌دهد؟
                </p>
              </div>

              <Eye
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div className="mt-6 space-y-4">
              {contentPerformance.map(
                (item) => (
                  <PerformanceRow
                    key={item.title}
                    {...item}
                  />
                )
              )}
            </div>
          </div>
        </section>

        {/* SOCIAL FUNNEL */}
        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Funnel
              size={23}
              weight="duotone"
              className="text-violet-300"
            />

            <div>
              <h2 className="text-xl font-semibold">
                مسیر تبدیل مخاطب شبکه اجتماعی
              </h2>

              <p className="mt-1 text-sm text-white/40">
                از دیده‌شدن تا تبدیل به مشتری
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-5">
            <FunnelCard
              title="دیده‌شدن"
              value="۱۱۸K"
            />

            <FunnelCard
              title="تعامل"
              value="۹.۸K"
            />

            <FunnelCard
              title="پیام"
              value="۸۴۰"
            />

            <FunnelCard
              title="مشتری بالقوه"
              value="۲۱۳"
            />

            <FunnelCard
              title="خرید"
              value="۶۸"
            />
          </div>
        </section>

        {/* AI SOCIAL BRAIN */}
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
                    مغز شبکه‌های اجتماعی Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    محتوا، رفتار مخاطب و فروش در یک تحلیل
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                در نسخه کامل، Loadder محتوای منتشرشده، تعامل کاربران،
                پیام‌ها، مشتریان بالقوه و فروش را کنار هم تحلیل می‌کند
                تا مشخص شود کدام محتوا واقعاً به رشد کسب‌وکار کمک می‌کند.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <SmartCard
                  icon={Target}
                  title="موضوع پیشنهادی"
                  value="محتوای آموزشی"
                />

                <SmartCard
                  icon={Clock}
                  title="زمان پیشنهادی"
                  value="۱۸:۳۰ تا ۲۱"
                />

                <SmartCard
                  icon={Megaphone}
                  title="محتوای مناسب تبلیغ"
                  value="پست با امتیاز ۹۴"
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
                  اقدام پیشنهادی
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <ActionButton
                  icon={Sparkle}
                  text="ساخت ۵ ایده محتوایی"
                  onClick={() =>
                    showNotice(
                      "ایده‌ها بعداً از Content Studio تولید می‌شوند."
                    )
                  }
                />

                <ActionButton
                  icon={CalendarBlank}
                  text="ساخت برنامه یک هفته‌ای"
                  onClick={() =>
                    showNotice(
                      "تقویم هوشمند بعداً بر اساس داده واقعی ساخته می‌شود."
                    )
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "انتشار خودکار پس از اتصال API شبکه‌ها و Automation فعال می‌شود."
                    )
                  }
                  className="w-full rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-fuchsia-500 px-4 py-3 text-sm font-semibold"
                >
                  انتشار با تأیید من
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

function PlatformCard({
  platform,
  active,
  onClick,
}: {
  platform: SocialPlatform;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = platform.icon;

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
            className="text-fuchsia-300"
          />
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs ${
            platform.connected
              ? "border-emerald-400/10 bg-emerald-500/[0.07] text-emerald-300"
              : "border-white/[0.07] bg-white/[0.03] text-white/35"
          }`}
        >
          {platform.connected
            ? "متصل"
            : "آماده اتصال"}
        </span>
      </div>

      <h3 className="mt-4 font-semibold">
        {platform.title}
      </h3>

      <div className="mt-1 text-xs text-white/35">
        {platform.handle}
      </div>

      {platform.connected && (
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-white/35">
            دنبال‌کننده
          </span>

          <span className="font-semibold text-cyan-300">
            {platform.followers}
          </span>
        </div>
      )}
    </button>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <Icon
        size={20}
        weight="duotone"
        className="text-cyan-300"
      />

      <div className="mt-4 text-xs text-white/35">
        {title}
      </div>

      <div className="mt-1 text-xl font-bold">
        {value}
      </div>
    </div>
  );
}

function AnalyticsRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <span className="text-sm text-white/40">
        {title}
      </span>

      <span className="text-sm font-semibold">
        {value}
      </span>
    </div>
  );
}

function ScheduledPostCard({
  post,
  onEdit,
}: {
  post: ScheduledPost;
  onEdit: () => void;
}) {
  const statusStyle =
    post.status === "آماده"
      ? "border-emerald-400/10 bg-emerald-500/[0.07] text-emerald-300"
      : post.status === "در حال ساخت"
        ? "border-amber-400/10 bg-amber-500/[0.07] text-amber-300"
        : "border-violet-400/10 bg-violet-500/[0.07] text-violet-300";

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <CalendarBlank
          size={21}
          weight="duotone"
          className="text-cyan-300"
        />

        <span
          className={`rounded-full border px-3 py-1.5 text-xs ${statusStyle}`}
        >
          {post.status}
        </span>
      </div>

      <h3 className="mt-4 font-semibold leading-7">
        {post.title}
      </h3>

      <div className="mt-3 text-xs text-white/35">
        {post.platform}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-white/40">
        <span>{post.date}</span>
        <span>{post.time}</span>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 text-xs text-white/55"
        >
          <PencilSimple size={14} />
          ویرایش
        </button>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/10 bg-red-500/[0.04] text-red-300/60"
        >
          <Trash size={15} />
        </button>
      </div>
    </div>
  );
}

function InboxRow({
  item,
  onReply,
}: {
  item: InboxItem;
  onReply: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        item.unread
          ? "border-violet-400/15 bg-violet-500/[0.05]"
          : "border-white/[0.06] bg-black/20"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {item.name}
            </span>

            {item.unread && (
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.8)]" />
            )}
          </div>

          <div className="mt-1 text-xs text-white/30">
            {item.platform}
          </div>
        </div>

        <span className="text-xs text-white/25">
          {item.time}
        </span>
      </div>

      <p className="mt-3 text-sm leading-7 text-white/50">
        {item.message}
      </p>

      <button
        type="button"
        onClick={onReply}
        className="mt-4 flex items-center gap-2 text-xs text-violet-300"
      >
        <PaperPlaneTilt size={14} />
        پاسخ
      </button>
    </div>
  );
}

function PerformanceRow({
  title,
  reach,
  engagement,
  score,
}: {
  title: string;
  reach: string;
  engagement: string;
  score: number;
}) {
  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">
            {title}
          </div>

          <div className="mt-1 text-xs text-white/35">
            دیده‌شدن {reach} • تعامل {engagement}
          </div>
        </div>

        <span className="text-lg font-bold text-cyan-300">
          {score}٪
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300"
          style={{
            width: `${score}%`,
          }}
        />
      </div>
    </div>
  );
}

function FunnelCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5 text-center">
      <div className="text-xs text-white/35">
        {title}
      </div>

      <div className="mt-2 text-2xl font-bold">
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