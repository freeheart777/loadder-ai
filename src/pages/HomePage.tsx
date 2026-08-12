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
} from "@phosphor-icons/react";

const menuItems = [
  { label: "صفحه اصلی", icon: House },
  { label: "پروژه‌ها", icon: FolderOpen },
  { label: "متخصص‌های هوش مصنوعی", icon: Sparkle },
  { label: "تحلیل و گزارش‌ها", icon: ChartLineUp },
  { label: "تنظیمات", icon: Gear },
];

const aiTools = [
  { title: "برند بوک", icon: BookOpenText, status: "آماده" },
  { title: "بیزنس پروپوزال", icon: FileText, status: "آماده" },
  { title: "سایت‌ساز هوشمند", icon: Globe, status: "آماده" },
  { title: "KPI", icon: Gauge, status: "نیاز به تنظیم" },
  { title: "تولید محتوا", icon: Sparkle, status: "آماده" },
  { title: "مدیر سوشال", icon: InstagramLogo, status: "نیاز به اتصال" },
  { title: "تبلیغات هوشمند", icon: Megaphone, status: "آماده" },
  { title: "CRM", icon: UsersThree, status: "نیاز به تنظیم" },
  { title: "تحلیل و گزارش", icon: ChartLineUp, status: "آماده" },
  { title: "اتوماسیون", icon: Lightning, status: "آماده" },
];

export default function DashboardPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#050507] text-white">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="fixed right-0 top-0 z-40 flex h-screen w-[260px] flex-col border-l border-white/[0.08] bg-black/60 p-5 backdrop-blur-2xl">
          <div className="mb-10">
            <div
              dir="ltr"
              className="text-left text-xl font-semibold tracking-tight"
            >
              Loadder AI
            </div>

            <div className="mt-1 text-xs text-white/35">
              مرکز هوشمند کسب‌وکار
            </div>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    index === 0
                      ? "border border-violet-400/20 bg-violet-500/10 text-white"
                      : "text-white/45 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon size={19} weight="duotone" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="text-xs text-white/40">فضای کاری</div>

            <div className="mt-1 text-sm font-medium">
              کسب‌وکار من
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full w-[35%] rounded-full bg-gradient-to-l from-violet-500 via-fuchsia-500 to-cyan-400" />
            </div>

            <div className="mt-2 text-[10px] text-white/30">
              تکمیل پروفایل ۳۵٪
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <section className="mr-[260px] min-h-screen flex-1">
          {/* HEADER */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[#050507]/80 px-8 py-5 backdrop-blur-2xl">
            <div>
              <h1 className="text-xl font-semibold">داشبورد</h1>

              <p className="mt-1 text-xs text-white/35">
                همه ابزارهای هوش مصنوعی کسب‌وکارت در یک جا
              </p>
            </div>

            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-gradient-to-l from-violet-500/20 to-fuchsia-500/15 px-5 py-3 text-xs font-medium transition hover:scale-[1.02] hover:border-fuchsia-300/40"
            >
              <Plus size={15} weight="bold" />
              پروژه جدید
            </button>
          </header>

          <div className="p-8">
            {/* WELCOME */}
            <section className="relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.035] p-8">
              <div className="pointer-events-none absolute -left-20 -top-20 h-[300px] w-[300px] rounded-full bg-violet-500/10 blur-[100px]" />

              <div className="pointer-events-none absolute -bottom-24 right-[20%] h-[250px] w-[250px] rounded-full bg-fuchsia-500/[0.07] blur-[100px]" />

              <div className="relative z-10">
                <span
                  dir="ltr"
                  className="text-[10px] uppercase tracking-[0.2em] text-violet-300/50"
                >
                  Loadder Workspace
                </span>

                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
                  کسب‌وکارت را هوشمندتر مدیریت کن.
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/40">
                  هر متخصص را مستقل استفاده کن یا چند ابزار را به هم متصل کن
                  و یک چرخه هوشمند برای ساخت، بازاریابی، فروش و رشد
                  کسب‌وکارت بساز.
                </p>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/10 px-5 py-3 text-xs text-white transition hover:bg-violet-500/20"
                  >
                    <Plus size={14} />
                    شروع پروژه
                  </button>

                  <button
                    type="button"
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    تکمیل پروفایل کسب‌وکار
                  </button>
                </div>
              </div>
            </section>

            {/* AI EXPERTS */}
            <section className="mt-10">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    متخصص‌های هوش مصنوعی
                  </h2>

                  <p className="mt-1 text-xs text-white/35">
                    ابزار موردنظرت را انتخاب کن و پروژه را شروع کن.
                  </p>
                </div>

                <button
                  type="button"
                  className="text-xs text-violet-300/70 transition hover:text-violet-200"
                >
                  مشاهده همه
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                {aiTools.map((tool) => {
                  const Icon = tool.icon;
                  const ready = tool.status === "آماده";

                  return (
                    <button
                      key={tool.title}
                      type="button"
                      className="group relative min-h-[180px] overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 text-right transition duration-300 hover:-translate-y-1 hover:border-violet-300/20 hover:bg-white/[0.055]"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.06] via-transparent to-fuchsia-500/[0.04] opacity-0 transition duration-300 group-hover:opacity-100" />

                      <div className="relative z-10">
                        <div className="mb-6 flex items-start justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/[0.08] bg-black/25 text-cyan-300 transition group-hover:border-violet-300/20 group-hover:text-white">
                            <Icon size={21} weight="duotone" />
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[9px] ${
                              ready
                                ? "bg-emerald-400/10 text-emerald-300"
                                : "bg-amber-400/10 text-amber-300"
                            }`}
                          >
                            {tool.status}
                          </span>
                        </div>

                        <h3 className="text-sm font-medium">
                          {tool.title}
                        </h3>

                        <p className="mt-2 text-[11px] leading-5 text-white/30">
                          برای شروع پروژه جدید کلیک کن
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* RECENT PROJECTS */}
            <section className="mt-10">
              <div className="mb-5">
                <h2 className="text-lg font-semibold">
                  پروژه‌های اخیر
                </h2>

                <p className="mt-1 text-xs text-white/35">
                  آخرین فعالیت‌های فضای کاری
                </p>
              </div>

              <div className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-white/[0.025]">
                <div className="flex min-h-[180px] items-center justify-center p-8 text-center">
                  <div>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                      <FolderOpen
                        size={25}
                        weight="duotone"
                        className="text-white/20"
                      />
                    </div>

                    <p className="mt-4 text-sm text-white/40">
                      هنوز پروژه‌ای ساخته نشده
                    </p>

                    <p className="mt-2 text-xs text-white/20">
                      اولین پروژه را از یکی از متخصص‌های هوش مصنوعی شروع کن.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}