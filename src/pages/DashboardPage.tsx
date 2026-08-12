import { Link } from "react-router-dom";
import type { ElementType } from "react";

import {
  House,
  FolderOpen,
  Sparkle,
  ChartLineUp,
  Gear,
  Plus,
  BookOpenText,
  FileText,
  Globe,
  Gauge,
  InstagramLogo,
  Megaphone,
  UsersThree,
  Lightning,
  Brain,
  TrendUp,
  ArrowSquareOut,
} from "@phosphor-icons/react";

type ToolItem = {
  id: string;
  title: string;
  description: string;
  icon: ElementType;
  status: "آماده" | "به‌زودی";
  route?: string;
  externalUrl?: string;
  accent: "violet" | "cyan" | "blue" | "pink";
};

const tools: ToolItem[] = [
  {
    id: "brand",
    title: "برند بوک",
    description: "هویت، لحن و شخصیت برندت را بساز.",
    icon: BookOpenText,
    status: "آماده",
    route: "/dashboard/brand-book",
    accent: "violet",
  },
  {
    id: "proposal",
    title: "بیزنس پروپوزال",
    description: "پیشنهاد تجاری حرفه‌ای برای کسب‌وکارت بساز.",
    icon: FileText,
    status: "آماده",
    route: "/dashboard/business-proposal",
    accent: "blue",
  },
  {
    id: "website",
    title: "سایت‌ساز هوشمند",
    description: "سایت کسب‌وکارت را سریع راه‌اندازی کن.",
    icon: Globe,
    status: "آماده",
    externalUrl: "https://iportals.ir/",
    accent: "cyan",
  },
  {
    id: "kpi",
    title: "مرکز سنجش عملکرد",
    description: "KPIها و سلامت کسب‌وکارت را یکجا ببین.",
    icon: Gauge,
    status: "آماده",
    route: "/dashboard/kpi",
    accent: "violet",
  },
  {
    id: "content",
    title: "تولید محتوا",
    description: "محتوا، سناریو و ایده‌های بازاریابی تولید کن.",
    icon: Sparkle,
    status: "آماده",
    route: "/dashboard/content",
    accent: "pink",
  },
  {
    id: "social",
    title: "مدیر شبکه‌های اجتماعی",
    description: "محتوا، انتشار و عملکرد شبکه‌ها را مدیریت کن.",
    icon: InstagramLogo,
    status: "آماده",
    route: "/dashboard/social",
    accent: "pink",
  },
  {
    id: "ads",
    title: "تبلیغات هوشمند",
    description: "کمپین‌های تبلیغاتی چندکاناله بساز و مدیریت کن.",
    icon: Megaphone,
    status: "آماده",
    route: "/dashboard/ads",
    accent: "blue",
  },
  {
    id: "crm",
    title: "ارتباط با مشتری",
    description: "لیدها، مشتریان و فرصت‌های فروش را مدیریت کن.",
    icon: UsersThree,
    status: "آماده",
    route: "/dashboard/crm",
    accent: "cyan",
  },
  {
    id: "analytics",
    title: "تحلیل و گزارش",
    description: "داده‌ها را به تحلیل و تصمیم تبدیل کن.",
    icon: ChartLineUp,
    status: "آماده",
    route: "/dashboard/analytics",
    accent: "cyan",
  },
  {
    id: "automation",
    title: "اتوماسیون",
    description: "کارهای تکراری را با جریان‌های هوشمند خودکار کن.",
    icon: Lightning,
    status: "آماده",
    route: "/dashboard/automation",
    accent: "violet",
  },
  {
    id: "predictive",
    title: "پیش‌بینی آینده",
    description: "رشد، ریسک و سناریوهای آینده را پیش‌بینی کن.",
    icon: TrendUp,
    status: "آماده",
    route: "/dashboard/predictive",
    accent: "cyan",
  },
  {
    id: "brain",
    title: "مغز هوشمند کسب‌وکار",
    description: "مرکز شناخت، حافظه و تصمیم‌گیری Loadder.",
    icon: Brain,
    status: "آماده",
    route: "/dashboard/business-brain",
    accent: "violet",
  },
];

const sidebarItems = [
  {
    title: "صفحه اصلی",
    icon: House,
    route: "/dashboard",
  },
  {
    title: "پروژه‌ها",
    icon: FolderOpen,
  },
  {
    title: "متخصص‌های هوش مصنوعی",
    icon: Sparkle,
  },
  {
    title: "تحلیل و گزارش‌ها",
    icon: ChartLineUp,
    route: "/dashboard/analytics",
  },
  {
    title: "تنظیمات",
    icon: Gear,
  },
];

function getAccent(accent: ToolItem["accent"]) {
  switch (accent) {
    case "cyan":
      return {
        icon: "text-cyan-300",
        glow:
          "from-cyan-500/[0.11] via-blue-500/[0.04] to-transparent",
      };

    case "blue":
      return {
        icon: "text-blue-300",
        glow:
          "from-blue-500/[0.11] via-violet-500/[0.04] to-transparent",
      };

    case "pink":
      return {
        icon: "text-fuchsia-300",
        glow:
          "from-fuchsia-500/[0.11] via-violet-500/[0.04] to-transparent",
      };

    default:
      return {
        icon: "text-violet-300",
        glow:
          "from-violet-500/[0.12] via-blue-500/[0.04] to-transparent",
      };
  }
}

function ToolCard({
  tool,
}: {
  tool: ToolItem;
}) {
  const Icon = tool.icon;
  const accent = getAccent(tool.accent);

  const className = `
    group relative min-h-[220px]
    overflow-hidden rounded-[26px]
    border border-white/[0.08]
    bg-[#080d1d]/65 p-5
    text-right backdrop-blur-xl
    transition duration-300
    hover:-translate-y-1
    hover:border-violet-300/30
    hover:bg-[#0b1124]/85
    cursor-pointer
  `;

  const content = (
    <>
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.glow}`}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/25">
            <Icon
              size={23}
              weight="duotone"
              className={accent.icon}
            />
          </div>

          <div className="flex items-center gap-2">
            {tool.externalUrl && (
              <ArrowSquareOut
                size={15}
                className="text-white/35"
              />
            )}

            <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.08] px-3 py-1.5 text-xs text-emerald-300">
              {tool.status}
            </span>
          </div>
        </div>

        <h3 className="mt-5 text-[17px] font-semibold">
          {tool.title}
        </h3>

        <p className="mt-2 text-sm leading-7 text-white/45">
          {tool.description}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-5 text-sm text-violet-200/75 transition group-hover:text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.8)]" />

          ورود به ابزار
        </div>
      </div>
    </>
  );

  if (tool.externalUrl) {
    return (
      <a
        href={tool.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }

  if (tool.route) {
    return (
      <Link
        to={tool.route}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main
      dir="rtl"
      className="loadder-dashboard-bg min-h-screen text-white"
    >
      {/* SIDEBAR */}

      <aside className="fixed right-0 top-0 z-50 flex h-screen w-[270px] flex-col border-l border-white/[0.07] bg-[#030617]/80 p-5 backdrop-blur-2xl">
        <div className="mb-8 border-b border-white/[0.06] pb-6">
          <div className="flex items-center justify-between">
            <div>
              <div
                dir="ltr"
                className="text-left text-2xl font-bold"
              >
                Loadder AI
              </div>

              <div className="mt-1 text-xs text-white/35">
                مرکز هوشمند کسب‌وکار
              </div>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
              <Brain
                size={22}
                weight="duotone"
                className="text-violet-300"
              />
            </div>
          </div>
        </div>

        <nav className="space-y-2">
          {sidebarItems.map(
            (item, index) => {
              const Icon = item.icon;

              const classes = `
                flex w-full items-center gap-3
                rounded-2xl px-4 py-3.5
                text-sm transition
                ${
                  index === 0
                    ? "border border-violet-400/20 bg-gradient-to-l from-violet-600/20 to-blue-500/10 text-white"
                    : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                }
              `;

              if (item.route) {
                return (
                  <Link
                    key={item.title}
                    to={item.route}
                    className={classes}
                  >
                    <Icon size={20} />
                    {item.title}
                  </Link>
                );
              }

              return (
                <button
                  key={item.title}
                  type="button"
                  className={classes}
                >
                  <Icon size={20} />
                  {item.title}
                </button>
              );
            }
          )}
        </nav>

        <div className="mt-auto rounded-[24px] border border-violet-400/15 bg-[#080d1d]/65 p-5">
          <div className="text-xs text-white/35">
            فضای کاری
          </div>

          <div className="mt-1 font-semibold">
            کسب‌وکار من
          </div>

          <div className="mt-5 flex justify-between text-xs text-white/35">
            <span>تکمیل پروفایل</span>
            <span>۳۵٪</span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-[35%] rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300" />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <section className="relative z-10 mr-[270px] min-h-screen">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-[#030617]/70 px-8 py-5 backdrop-blur-2xl">
          <div>
            <h1 className="text-2xl font-bold">
              داشبورد
            </h1>

            <p className="mt-1 text-sm text-white/40">
              همه ابزارهای هوش مصنوعی کسب‌وکارت در یک جا
            </p>
          </div>

          <button
            type="button"
            className="flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-gradient-to-l from-violet-600/25 via-blue-500/15 to-cyan-500/10 px-5 py-3 text-sm font-semibold"
          >
            <Plus size={17} />
            پروژه جدید
          </button>
        </header>

        <div className="p-8">
          {/* HERO */}

          <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/65 p-8 backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

            <div className="pointer-events-none absolute -bottom-32 left-[25%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

            <div className="relative z-10">
              <div className="text-xs tracking-[0.3em] text-violet-300/65">
                LOADDER WORKSPACE
              </div>

              <h2 className="mt-6 max-w-4xl text-3xl font-bold leading-[1.55]">
                کسب‌وکارت را هوشمندتر مدیریت کن.
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/45">
                هر ابزار را مستقل استفاده کن یا آن‌ها را به یک چرخه
                هوشمند برای ساخت، بازاریابی، فروش و رشد کسب‌وکارت
                متصل کن.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/dashboard/business-brain"
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold"
                >
                  <Brain size={17} />
                  مغز هوشمند کسب‌وکار
                </Link>

                <Link
                  to="/dashboard/predictive"
                  className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-5 py-3 text-sm text-white/65"
                >
                  پیش‌بینی آینده
                </Link>
              </div>
            </div>
          </section>

          {/* TOOL GRID */}

          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  متخصص‌های هوش مصنوعی
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  ابزار موردنظرت را انتخاب کن و شروع کن.
                </p>
              </div>

              <div className="text-xs text-violet-300/70">
                ۱۲ ابزار فعال
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {tools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}