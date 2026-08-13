import { useRef } from "react";

import {
  Brain,
  UsersThree,
  Megaphone,
  InstagramLogo,
  Sparkle,
  ChartLineUp,
  Lightning,
} from "@phosphor-icons/react";

import {
  gsap,
  MotionPathPlugin,
  useGSAP,
} from "../lib/animations/gsap";

export default function BusinessBrainMotion() {
  const scope = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const dots = gsap.utils.toArray<HTMLElement>(
        "[data-brain-dot]"
      );

      dots.forEach((dot, index) => {
        const pathId =
          dot.getAttribute("data-path");

        if (!pathId) return;

        gsap.to(dot, {
          duration: 4.5 + index * 0.35,
          repeat: -1,
          ease: "none",
          motionPath: {
            path: `#${pathId}`,
            align: `#${pathId}`,
            alignOrigin: [0.5, 0.5],
            autoRotate: false,
          },
          delay: index * 0.5,
        });
      });

      gsap.to("[data-brain-core]", {
        scale: 1.05,
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.to("[data-brain-glow]", {
        opacity: 0.75,
        scale: 1.08,
        duration: 2.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    },
    {
      scope,
    }
  );

  return (
    <section
      ref={scope}
      dir="rtl"
      className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080a10] p-8"
    >
      <div
        data-brain-glow
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.10] blur-[120px]"
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/10 px-4 py-2">
              <Brain
                size={16}
                weight="duotone"
                className="text-violet-300"
              />

              <span className="text-sm text-violet-200">
                Business Brain
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-bold">
              همه ماژول‌ها به یک مغز مشترک وصل می‌شوند.
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-8 text-white/50">
              داده از CRM، تبلیغات، شبکه‌های اجتماعی، محتوا،
              Analytics و Automation وارد Business Brain می‌شود و
              دوباره به تصمیم و اقدام تبدیل می‌شود.
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-8 h-[620px] max-w-[1050px]">
          <svg
            viewBox="0 0 1000 620"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <path
              id="brain-path-crm"
              d="M500 310 C390 210 270 170 150 155"
              fill="none"
              stroke="rgba(139,92,246,0.14)"
              strokeWidth="2"
            />

            <path
              id="brain-path-ads"
              d="M500 310 C610 200 735 170 850 155"
              fill="none"
              stroke="rgba(34,211,238,0.14)"
              strokeWidth="2"
            />

            <path
              id="brain-path-social"
              d="M500 310 C360 310 255 310 135 310"
              fill="none"
              stroke="rgba(217,70,239,0.14)"
              strokeWidth="2"
            />

            <path
              id="brain-path-content"
              d="M500 310 C640 310 745 310 865 310"
              fill="none"
              stroke="rgba(59,130,246,0.14)"
              strokeWidth="2"
            />

            <path
              id="brain-path-analytics"
              d="M500 310 C400 420 285 460 165 475"
              fill="none"
              stroke="rgba(34,211,238,0.14)"
              strokeWidth="2"
            />

            <path
              id="brain-path-automation"
              d="M500 310 C605 420 725 460 840 475"
              fill="none"
              stroke="rgba(245,158,11,0.14)"
              strokeWidth="2"
            />
          </svg>

          <div
            data-brain-dot
            data-path="brain-path-crm"
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,0.95)]"
          />

          <div
            data-brain-dot
            data-path="brain-path-ads"
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.95)]"
          />

          <div
            data-brain-dot
            data-path="brain-path-social"
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-fuchsia-300 shadow-[0_0_18px_rgba(240,171,252,0.95)]"
          />

          <div
            data-brain-dot
            data-path="brain-path-content"
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-blue-300 shadow-[0_0_18px_rgba(147,197,253,0.95)]"
          />

          <div
            data-brain-dot
            data-path="brain-path-analytics"
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.95)]"
          />

          <div
            data-brain-dot
            data-path="brain-path-automation"
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.95)]"
          />

          <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <div
              data-brain-core
              className="relative flex h-[220px] w-[220px] items-center justify-center rounded-[58px] border border-violet-300/25 bg-gradient-to-br from-violet-500/20 via-[#10131d] to-cyan-500/10 shadow-[0_0_90px_rgba(124,58,237,0.25)] backdrop-blur-2xl"
            >
              <div className="absolute inset-4 rounded-[46px] border border-white/[0.05]" />

              <div className="text-center">
                <Brain
                  size={52}
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
                  Intelligence Layer
                </div>
              </div>
            </div>
          </div>

          <BrainNode
            className="left-[5%] top-[11%]"
            icon={UsersThree}
            title="مدیریت مشتریان"
            subtitle="داده‌های مشتری"
          />

          <BrainNode
            className="right-[5%] top-[11%]"
            icon={Megaphone}
            title="تبلیغات"
            subtitle="داده‌های کمپین"
          />

          <BrainNode
            className="left-[1%] top-[41%]"
            icon={InstagramLogo}
            title="شبکه‌های اجتماعی"
            subtitle="داده‌های مخاطب"
          />

          <BrainNode
            className="right-[1%] top-[41%]"
            icon={Sparkle}
            title="تولید محتوا"
            subtitle="داده‌های محتوا"
          />

          <BrainNode
            className="left-[6%] bottom-[6%]"
            icon={ChartLineUp}
            title="تحلیل و گزارش"
            subtitle="داده‌های عملکرد"
          />

          <BrainNode
            className="right-[6%] bottom-[6%]"
            icon={Lightning}
            title="اتوماسیون"
            subtitle="لایه اجرا"
          />
        </div>
      </div>
    </section>
  );
}

function BrainNode({
  icon: Icon,
  title,
  subtitle,
  className,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  className: string;
}) {
  return (
    <div
      className={`absolute z-10 w-[185px] rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl ${className}`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20">
        <Icon
          size={22}
          weight="duotone"
          className="text-cyan-300"
        />
      </div>

      <h3 className="mt-4 text-base font-semibold">
        {title}
      </h3>

      <p className="mt-1 text-sm text-white/40">
        {subtitle}
      </p>
    </div>
  );
}