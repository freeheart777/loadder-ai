import {
  ArrowLeft,
  Brain,
  Sparkle,
  ChartLineUp,
  UsersThree,
  Megaphone,
  Lightning,
  InstagramLogo,
  Gauge,
  PlayCircle,
} from "@phosphor-icons/react";

const modules = [
  {
    icon: Brain,
    title: "مغز هوشمند",
    text: "شناخت برند، مشتری، محصول و فرصت‌های رشد",
  },
  {
    icon: Sparkle,
    title: "تولید محتوا",
    text: "محتوای هماهنگ با هویت و اهداف کسب‌وکار",
  },
  {
    icon: InstagramLogo,
    title: "شبکه‌های اجتماعی",
    text: "مدیریت محتوا، تعامل و لیدها",
  },
  {
    icon: Megaphone,
    title: "تبلیغات",
    text: "کمپین‌های چندکاناله و مدیریت عملکرد",
  },
  {
    icon: UsersThree,
    title: "CRM",
    text: "مشتری، لید و تاریخچه تعامل",
  },
  {
    icon: ChartLineUp,
    title: "تحلیل و گزارش",
    text: "داده، قیف فروش و تحلیل عملکرد",
  },
  {
    icon: Gauge,
    title: "KPI و رشد",
    text: "کنترل اهداف و فاصله تا تحقق آن‌ها",
  },
  {
    icon: Lightning,
    title: "اتوماسیون",
    text: "تبدیل اتفاقات کسب‌وکار به اقدام",
  },
];

export default function PresentationHomePage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#04050a] text-white"
    >
      {/* HEADER */}

      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#04050a]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-8 py-5">
          <a
            href="/"
            dir="ltr"
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/10">
              <Sparkle
                size={22}
                weight="fill"
                className="text-violet-300"
              />
            </div>

            <div>
              <div className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-2xl font-bold text-transparent">
                Loadder AI
              </div>

              <div className="text-[11px] text-white/35">
                AI Business Growth Platform
              </div>
            </div>
          </a>

          <nav className="hidden gap-7 text-sm text-white/50 lg:flex">
            <a
              href="#platform"
              className="transition hover:text-white"
            >
              پلتفرم
            </a>

            <a
              href="#brain"
              className="transition hover:text-white"
            >
              مغز هوشمند
            </a>

            <a
              href="#demo"
              className="transition hover:text-white"
            >
              نسخه دمو
            </a>
          </nav>

          <div className="flex gap-2">
            <a
              href="/dashboard"
              className="rounded-xl border border-white/[0.10] bg-white/[0.04] px-5 py-3 text-sm transition hover:bg-white/[0.08]"
            >
              ورود
            </a>

            <a
              href="/dashboard?demo=1"
              className="rounded-xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold"
            >
              نسخه دمو
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}

      <section className="mx-auto grid min-h-[760px] max-w-[1500px] items-center gap-14 px-8 py-20 xl:grid-cols-[1fr_560px]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/[0.08] px-4 py-2">
            <Sparkle
              size={14}
              weight="fill"
              className="text-violet-300"
            />

            <span className="text-sm text-violet-200">
              پلتفرم هوشمند رشد کسب‌وکار
            </span>
          </div>

          <h1 className="mt-7 max-w-[800px] text-5xl font-bold leading-[1.5] lg:text-6xl">
            تمام موتورهای رشد کسب‌وکارت
            <span className="bg-gradient-to-l from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              {" "}
              در یک مغز هوشمند.
            </span>
          </h1>

          <p className="mt-6 max-w-[760px] text-lg leading-10 text-white/55">
            Loadder محتوا، شبکه‌های اجتماعی، تبلیغات، CRM،
            Analytics، KPI و Automation را به یک Business Brain
            مشترک متصل می‌کند.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="/dashboard?demo=1"
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-7 py-4 text-base font-semibold shadow-[0_15px_45px_rgba(139,92,246,0.24)] transition hover:scale-[1.02]"
            >
              <PlayCircle
                size={20}
                weight="fill"
              />

              تجربه نسخه دمو

              <ArrowLeft size={18} />
            </a>

            <a
              href="#platform"
              className="rounded-2xl border border-white/[0.10] bg-white/[0.035] px-7 py-4 text-base text-white/70 transition hover:bg-white/[0.07]"
            >
              مشاهده امکانات
            </a>
          </div>

          <div className="mt-10 grid max-w-[700px] grid-cols-3 gap-3">
            <Stat value="۹+" label="متخصص هوشمند" />
            <Stat value="360°" label="دید کسب‌وکار" />
            <Stat value="۱" label="مغز مشترک" />
          </div>
        </div>

        {/* SAFE VISUAL */}

        <div className="rounded-[36px] border border-violet-300/15 bg-gradient-to-br from-violet-500/[0.09] via-[#0b0e15] to-cyan-500/[0.04] p-8">
          <div className="mx-auto flex h-[250px] w-[250px] items-center justify-center rounded-[65px] border border-violet-300/25 bg-[#0d1018] shadow-[0_0_100px_rgba(124,58,237,0.22)]">
            <div className="text-center">
              <Brain
                size={58}
                weight="duotone"
                className="mx-auto text-violet-300"
              />

              <div
                dir="ltr"
                className="mt-4 text-xl font-bold"
              >
                Loadder Brain
              </div>

              <div className="mt-2 text-sm text-white/40">
                مغز هوشمند کسب‌وکار
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <SmallModule icon={UsersThree} title="CRM" />
            <SmallModule icon={Megaphone} title="تبلیغات" />
            <SmallModule icon={Sparkle} title="محتوا" />
            <SmallModule icon={ChartLineUp} title="تحلیل" />
          </div>
        </div>
      </section>

      {/* PLATFORM */}

      <section
        id="platform"
        className="border-y border-white/[0.06] bg-white/[0.015] py-24"
      >
        <div className="mx-auto max-w-[1500px] px-8">
          <div className="text-sm text-violet-300">
            پلتفرم Loadder
          </div>

          <h2 className="mt-3 text-4xl font-bold">
            یک پلتفرم؛ چند موتور رشد.
          </h2>

          <p className="mt-4 max-w-[800px] text-base leading-9 text-white/50">
            هر سرویس می‌تواند مستقل استفاده شود؛ اما قدرت واقعی
            Loadder زمانی شکل می‌گیرد که همه آن‌ها به یک مغز مشترک
            متصل شوند.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;

              return (
                <div
                  key={module.title}
                  className="rounded-[26px] border border-white/[0.08] bg-[#0a0d13] p-6"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10">
                    <Icon
                      size={23}
                      weight="duotone"
                      className="text-cyan-300"
                    />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold">
                    {module.title}
                  </h3>

                  <p className="mt-3 text-sm leading-8 text-white/45">
                    {module.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BRAIN */}

      <section
        id="brain"
        className="mx-auto grid max-w-[1500px] gap-10 px-8 py-24 xl:grid-cols-2"
      >
        <div>
          <div className="text-sm text-violet-300">
            Business Brain
          </div>

          <h2 className="mt-3 text-4xl font-bold leading-[1.5]">
            AI باید قبل از تصمیم، کسب‌وکار را بشناسد.
          </h2>

          <p className="mt-5 max-w-[700px] text-base leading-9 text-white/50">
            داده‌های برند، مشتری، محتوا، تبلیغات و فروش وارد یک
            Business DNA می‌شوند تا همه متخصص‌های AI از یک منبع
            حقیقت مشترک استفاده کنند.
          </p>

          <a
            href="/dashboard/business-brain?demo=1"
            className="mt-7 inline-flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500/10 px-5 py-3.5 text-sm"
          >
            <Brain size={18} />
            مشاهده مغز هوشمند
            <ArrowLeft size={15} />
          </a>
        </div>

        <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-violet-300">
                Nova Beauty
              </div>

              <div className="mt-1 text-xl font-semibold">
                Business DNA
              </div>
            </div>

            <div className="text-4xl font-bold">
              86٪
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Insight text="محتوای آموزشی بیشترین Lead را ایجاد کرده است." />
            <Insight text="Paid Search بالاترین کیفیت Lead را دارد." />
            <Insight text="۳۲ لید داغ نیازمند پیگیری سریع هستند." />
          </div>
        </div>
      </section>

      {/* DEMO */}

      <section
        id="demo"
        className="border-t border-white/[0.06] py-28"
      >
        <div className="mx-auto max-w-[1100px] px-8">
          <div className="rounded-[38px] border border-violet-300/20 bg-gradient-to-l from-violet-500/[0.12] via-[#0a0d13] to-cyan-500/[0.06] p-12 text-center">
            <Brain
              size={45}
              weight="duotone"
              className="mx-auto text-violet-300"
            />

            <h2 className="mt-6 text-4xl font-bold">
              Loadder را تجربه کن.
            </h2>

            <p className="mx-auto mt-5 max-w-[700px] text-base leading-9 text-white/55">
              وارد Nova Beauty شو و Dashboard، CRM، Ads، Social،
              Analytics، KPI، Business Brain و Automation را در یک
              سناریوی واحد ببین.
            </p>

            <a
              href="/dashboard?demo=1"
              className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-8 py-4 text-base font-semibold"
            >
              <PlayCircle
                size={20}
                weight="fill"
              />
              شروع نسخه دمو
              <ArrowLeft size={18} />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="text-2xl font-bold">
        {value}
      </div>

      <div className="mt-1 text-sm text-white/40">
        {label}
      </div>
    </div>
  );
}

function SmallModule({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <Icon
        size={19}
        weight="duotone"
        className="text-cyan-300"
      />

      <span className="text-sm">
        {title}
      </span>
    </div>
  );
}

function Insight({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-sm leading-7 text-white/55">
      {text}
    </div>
  );
}
