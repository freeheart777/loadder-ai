import { useRef } from "react";
import { Link } from "react-router-dom";

import {
  ArrowLeft,
  Sparkle,
  Article,
  Brain,
  Target,
} from "@phosphor-icons/react";

import {
  gsap,
  useGSAP,
} from "../lib/animations/gsap";

const features = [
  {
    title: "شناخت کسب‌وکار",
    icon: Brain,
  },
  {
    title: "تولید محتوا",
    icon: Article,
  },
  {
    title: "لحن یکپارچه برند",
    icon: Target,
  },
];

export default function OriginalLandingPage() {
  const rootRef =
    useRef<HTMLDivElement | null>(null);

  const heroVisualRef =
    useRef<HTMLDivElement | null>(null);

  const tickerRef =
    useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

      tl.from("[data-logo]", {
        opacity: 0,
        x: -50,
        duration: 0.9,
      })
        .from(
          "[data-top-action]",
          {
            opacity: 0,
            y: -24,
            stagger: 0.1,
            duration: 0.65,
          },
          "-=0.55"
        )
        .from(
          "[data-eyebrow]",
          {
            opacity: 0,
            y: 18,
            duration: 0.55,
          },
          "-=0.25"
        )
        .from(
          "[data-title-line]",
          {
            opacity: 0,
            y: 55,
            filter: "blur(10px)",
            stagger: 0.12,
            duration: 0.85,
          },
          "-=0.3"
        )
        .from(
          "[data-description]",
          {
            opacity: 0,
            y: 22,
            duration: 0.7,
          },
          "-=0.4"
        )
        .from(
          "[data-visual]",
          {
            opacity: 0,
            x: 70,
            scale: 0.96,
            duration: 1.15,
          },
          "-=0.95"
        )
        .from(
          "[data-ticker]",
          {
            opacity: 0,
            y: 35,
            duration: 0.75,
          },
          "-=0.45"
        );

      gsap.to("[data-loader]", {
        y: -10,
        duration: 3.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.to("[data-pattern-one]", {
        x: 35,
        y: -18,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.to("[data-pattern-two]", {
        x: -30,
        y: 24,
        duration: 7,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });




      const root = rootRef.current;
      const heroVisual =
        heroVisualRef.current;

      if (!root || !heroVisual) {
        return;
      }

      const handleMove = (
        event: MouseEvent
      ) => {
        if (window.innerWidth < 1024) {
          return;
        }

        const x =
          event.clientX / window.innerWidth -
          0.5;

        const y =
          event.clientY / window.innerHeight -
          0.5;

        gsap.to(heroVisual, {
          x: x * 18,
          y: y * 12,
          rotateY: x * 1.7,
          rotateX: -y * 1.2,
          duration: 1.1,
          ease: "power3.out",
        });

        gsap.to("[data-grid]", {
          x: x * -12,
          y: y * -8,
          duration: 1.4,
          ease: "power3.out",
        });
      };

      window.addEventListener(
        "mousemove",
        handleMove
      );

      return () => {
        window.removeEventListener(
          "mousemove",
          handleMove
        );
      };
    },
    {
      scope: rootRef,
    }
  );

  return (
    <main
      ref={rootRef}
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[#03040b] text-white"
    >
      {/* BACKGROUND VIDEO */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source
            src="/header-optimized.webm"
            type="video/webm"
          />
        </video>

        {/* DARK / BRAND OVERLAY */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,3,10,.92)_0%,rgba(3,4,13,.78)_34%,rgba(5,5,18,.42)_62%,rgba(4,3,15,.28)_100%)]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_40%,rgba(68,45,180,0.18),transparent_34%),radial-gradient(circle_at_14%_74%,rgba(113,33,219,0.12),transparent_33%)]" />

        <div
          data-grid
          className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)]"
        />
      </div>

      {/* HEADER */}
      <header
        dir="ltr"
        className="relative z-30 mx-auto flex w-full max-w-[1600px] items-start justify-between px-7 pt-7 lg:px-12 xl:px-16"
      >
        {/* LOGO - LEFT */}
        <div
          data-logo
          className="flex items-center justify-start"
        >
          <img
            src="/loadder-logo.png"
            alt="Loadder"
            className="h-auto w-[190px] object-contain lg:w-[230px] xl:w-[260px]"
          />
        </div>

        {/* ACTIONS - RIGHT */}
        <div
          dir="rtl"
          className="flex items-center gap-3"
        >
          <Link
            to="/signup"
            className="group flex items-center gap-3 rounded-[18px] bg-white px-6 py-3.5 text-[15px] font-semibold text-black shadow-[0_12px_40px_rgba(255,255,255,.08)] transition hover:scale-[1.025]"
          >
            ورود به پنل

            <ArrowLeft
              size={18}
              weight="bold"
              className="transition group-hover:-translate-x-1"
            />
          </Link>

        </div>
      </header>

      {/* HERO */}
      <section className="relative z-20 mx-auto grid min-h-[calc(100vh-105px)] max-w-[1600px] items-center gap-8 px-7 pb-[145px] pt-8 lg:grid-cols-[0.88fr_1.12fr] lg:px-12 lg:pt-3 xl:px-16">
        {/* COPY */}
        <div className="relative z-20 order-2 max-w-[650px] lg:order-1">
          <div
            data-eyebrow
            className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/[0.06] px-4 py-2.5 backdrop-blur-xl"
          >
            <Sparkle
              size={16}
              weight="fill"
              className="text-violet-300"
            />

            <span className="text-[14px] text-white/75">
              آینده کسب‌وکارت را با هوش مصنوعی بساز
            </span>
          </div>

          <div className="mt-7 overflow-hidden">
            <h1
              data-title-line
              className="hero-headline text-[46px] font-bold leading-[1.38] tracking-[-0.04em] text-white lg:text-[58px] xl:text-[66px]"
            >
              محتوای هوشمند.
            </h1>
          </div>

          <div className="overflow-hidden">
            <h2
              data-title-line
              className="hero-headline bg-gradient-to-l from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-[46px] font-bold leading-[1.38] tracking-[-0.045em] text-transparent lg:text-[58px] xl:text-[66px]"
            >
              هماهنگ با برند شما.
            </h2>
          </div>

          <p
            data-description
            className="mt-7 max-w-[585px] text-[16px] leading-[2.15] text-white/60 lg:text-[17px]"
          >
            Loadder اطلاعات کسب‌وکار و هویت برند شما را به
            پیش‌نویس‌های بازاریابی منسجم تبدیل می‌کند تا سریع‌تر
            محتوای مناسب برندتان را آماده کنید.
          </p>

          <div
            data-description
            className="mt-7 flex flex-wrap gap-2.5"
          >
            <MiniTag title="Business Context" />
            <MiniTag title="Brand Aware" />
            <MiniTag title="Content Studio" />
          </div>
        </div>

        {/* VISUAL */}
        <div
          ref={heroVisualRef}
          data-visual
          className="relative order-1 flex min-h-[380px] items-center justify-center lg:order-2 lg:min-h-[620px] [perspective:1400px]"
        >
          {/* GLOW */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[72%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.09] blur-[105px]" />

          {/* PATTERN 1 */}
          <div
            data-pattern-one
            className="pointer-events-none absolute bottom-[18%] left-[12%] h-[160px] w-[160px] rounded-full border border-cyan-300/15 opacity-70"
          />

          {/* PATTERN 2 */}
          <div
            data-pattern-two
            className="pointer-events-none absolute bottom-[14%] right-[12%] h-[220px] w-[220px] rounded-full border border-violet-300/10 opacity-60"
          />

          {/* DATA DOTS */}
          <div className="pointer-events-none absolute bottom-[8%] left-[16%] grid grid-cols-8 gap-2 opacity-45">
            {Array.from({
              length: 48,
            }).map((_, index) => (
              <span
                key={index}
                className="h-1.5 w-1.5 rounded-full bg-cyan-300/60"
              />
            ))}
          </div>
        </div>
      </section>

            {/* MOVING TICKER */}
      <section
        className="absolute bottom-[135px] left-1/2 z-30 w-[calc(100%-40px)] max-w-[1500px] -translate-x-1/2 overflow-hidden rounded-[28px] border border-violet-400/20 bg-[#070913]/80 py-4 shadow-[0_0_35px_rgba(84,54,255,.10)] backdrop-blur-2xl"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-24 bg-gradient-to-r from-[#070913] to-transparent" />

        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-24 bg-gradient-to-l from-[#070913] to-transparent" />

        <div
          dir="ltr"
          className="loadder-marquee"
        >
          <div className="loadder-marquee-group">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <div
                  key={`first-${feature.title}-${index}`}
                  className="loadder-marquee-item"
                >
                  <Icon
                    size={18}
                    weight="duotone"
                    className="text-cyan-300"
                  />

                  <span dir="rtl">
                    {feature.title}
                  </span>

                  <span className="mx-5 h-1.5 w-1.5 rounded-full bg-violet-400/50" />
                </div>
              );
            })}
          </div>

          <div
            className="loadder-marquee-group"
            aria-hidden="true"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <div
                  key={`second-${feature.title}-${index}`}
                  className="loadder-marquee-item"
                >
                  <Icon
                    size={18}
                    weight="duotone"
                    className="text-cyan-300"
                  />

                  <span dir="rtl">
                    {feature.title}
                  </span>

                  <span className="mx-5 h-1.5 w-1.5 rounded-full bg-violet-400/50" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      </section>
    </main>
  );
}

function MiniTag({
  title,
}: {
  title: string;
}) {
  return (
    <div className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 py-2 text-[12px] text-white/45 backdrop-blur-lg">
      {title}
    </div>
  );
}
