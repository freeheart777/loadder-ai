import { ArrowLeft as FlowArrow, Sparkle } from "@phosphor-icons/react";
import {
  DIAGNOSIS, LEARNING, MATURE, OUTPUT, PERMISSION, PLAN, REPLAN, RESULT, SHORTLIST, TOOLS, WORK,
} from "./fixtures";
import {
  Actions, Brand, Card, ConfidenceLine, Figures, GhostButton, Hero, PermissionBlock, PostureBar,
  PrimaryButton, QuietButton, Screen, StepRow, ToolSection, Zone,
} from "./ui";

/* PROTOTYPE SCREENS — fixture-rendered, no canonical API calls. */

/** 1 — Day one. No data, no charts, no module wall. Still useful, and tools are already there. */
export function Day1() {
  return (
    <Screen>
      <Brand />
      <Hero sub="آدرس سایت یا صفحهٔ اینستاگرامتان را بدهید. نگاه می‌کنم و می‌گویم چه دیدم. چند دقیقه طول می‌کشد و لازم نیست چیزی وصل کنید.">
        بگذارید اول کسب‌وکارتان را بشناسم.
      </Hero>
      <Card tone="lifted">
        <label className="block text-[13px] text-white/40">آدرس سایت یا پیج</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="flex min-h-12 flex-1 items-center rounded-2xl bg-black/30 px-5 text-[15px] text-white/30">instagram.com/…</div>
          <PrimaryButton>نگاه کن</PrimaryButton>
        </div>
        <p className="mt-5 text-[13px] leading-[1.9] text-white/35">
          فقط نگاه می‌کنم · خرج: ۰ تومان · پیام به مشتری: ۰
        </p>
      </Card>
      <p className="mt-8 text-[15px] leading-[2] text-white/40">
        اگر می‌دانید دنبال چه هستید، لازم نیست منتظر من بمانید.
      </p>
      <ToolSection tools={TOOLS} />
    </Screen>
  );
}

/** 2 — Diagnosis. Facts, and one honest unknown, in everyday words. */
export function Diagnosis() {
  return (
    <Screen>
      <Brand note={DIAGNOSIS.business} />
      <Hero>{DIAGNOSIS.headline}</Hero>
      <Card>
        <div className="divide-y divide-white/[0.05]">
          {DIAGNOSIS.findings.map((f) => (
            <ConfidenceLine key={f.text} tone={f.tone}>{f.text}</ConfidenceLine>
          ))}
        </div>
      </Card>
      <div className="mt-9 rounded-[28px] border border-violet-300/15 bg-violet-500/[0.06] p-7 sm:p-9">
        <div className="mb-3 flex items-center gap-2 text-[12px] font-bold text-violet-200/80"><Sparkle size={14} weight="fill" />به نظرم</div>
        <p className="text-[18px] leading-[2] text-white/85">{DIAGNOSIS.conclusion}</p>
      </div>
      <Actions>
        <PrimaryButton>برنامه‌ات را ببینم</PrimaryButton>
        <QuietButton>چیز دیگری مهم‌تر است</QuietButton>
      </Actions>
    </Screen>
  );
}

/** 3 — A plan derived from the diagnosis, not from a template. */
export function Plan() {
  return (
    <Screen>
      <Brand note={`هدف: ${PLAN.goal}`} />
      <Hero sub={PLAN.because}>این کاری است که پیشنهاد می‌کنم.</Hero>
      <Card>
        <ol className="divide-y divide-white/[0.05]">
          {PLAN.steps.map((s, i) => (
            <li key={s.title} className="flex gap-5 py-6 first:pt-0 last:pb-0">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.05] text-[13px] text-white/45">
                {new Intl.NumberFormat("fa-IR").format(i + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] leading-[1.9] text-white/90">{s.title}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
                  <span className="text-white/35">نتیجه‌اش: {s.output}</span>
                  {s.needsYou
                    ? <span className="text-amber-200/90">اینجا نظر شما لازم است</span>
                    : <span className="text-white/25">خودم انجام می‌دهم</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <p className="mt-7 text-[14px] leading-[2] text-white/35">
        تأیید این برنامه یعنی شروع کنم. یعنی اجازهٔ انتشار یا خرج کردن نیست؛ آن را جدا می‌پرسم.
      </p>
      <Actions>
        <PrimaryButton>باشه، شروع کن</PrimaryButton>
        <GhostButton>چرا این ترتیب؟</GhostButton>
        <QuietButton>فعلاً نه</QuietButton>
      </Actions>
    </Screen>
  );
}

/** 4 — Permission for one action, with the four facts and the standing posture. */
export function Permission() {
  return (
    <Screen>
      <Brand />
      <Hero sub="این کار روی چیزی اثر می‌گذارد که بیرون از لودر است، پس بدون اجازهٔ شما انجامش نمی‌دهم.">
        برای «{PERMISSION.action}» اجازه می‌خواهم.
      </Hero>
      <Card>
        <PermissionBlock facts={PERMISSION.facts} />
      </Card>
      <div className="mt-6">
        <PostureBar items={PERMISSION.posture} />
      </div>
      <Actions>
        <PrimaryButton>اجازه می‌دهم</PrimaryButton>
        <GhostButton>اول پیش‌نمایش را ببینم</GhostButton>
        <QuietButton>فعلاً نه</QuietButton>
      </Actions>
    </Screen>
  );
}

/** 5 — Work. One human progress line; module names never appear. */
export function Work() {
  return (
    <Screen>
      <Brand note="اصلاح صفحهٔ کافه" />
      <Hero sub="لازم نیست منتظر بمانید. وقتی کاری با شما داشتم خبر می‌دهم.">دارم کار می‌کنم.</Hero>
      <Card>
        <div className="divide-y divide-white/[0.04]">
          {WORK.map((s) => <StepRow key={s.text} state={s.state} text={s.text} />)}
        </div>
      </Card>
      <div className="mt-6 rounded-[28px] border border-amber-300/20 bg-amber-400/[0.05] p-7">
        <p className="text-[16px] leading-[1.9] text-amber-100/90">یک نسخهٔ تازه از صفحه آماده است. تا نظرتان را نگویید منتشرش نمی‌کنم.</p>
        <Actions><PrimaryButton>ببینمش</PrimaryButton></Actions>
      </div>
      <ToolSection tools={SHORTLIST} title="در همین حال" footer={<a href="/dashboard" className="text-[13px] text-white/35">همه ابزارها</a>} />
    </Screen>
  );
}

/** 6 — The output itself, shown as the thing rather than described. */
export function Output() {
  return (
    <Screen>
      <Brand note={OUTPUT.kind} />
      <Hero>این نسخه را ساختم.</Hero>
      <div className="overflow-hidden rounded-[28px] border border-white/[0.08]">
        <div className="flex items-center gap-2 bg-white/[0.04] px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <div className="bg-gradient-to-b from-[#141019] to-[#0B0A0F] px-8 py-14 text-center sm:px-14 sm:py-20">
          <p className="text-[12px] tracking-[0.3em] text-amber-200/60">RASTA</p>
          <h3 className="mt-5 text-[30px] font-bold leading-[1.5] sm:text-[38px]">{OUTPUT.title}</h3>
          <p className="mt-4 text-[16px] leading-[2] text-white/50">{OUTPUT.tagline}</p>
          <p className="mt-7 text-[20px] font-bold text-amber-200/90">{OUTPUT.price}</p>
          <span className="mt-8 inline-flex min-h-12 items-center rounded-2xl bg-amber-300 px-8 text-[15px] font-bold text-[#1A1206]">{OUTPUT.cta}</span>
        </div>
      </div>
      <p className="mt-6 text-[15px] leading-[2] text-white/45">{OUTPUT.note}</p>
      <Actions>
        <PrimaryButton>می‌پسندم</PrimaryButton>
        <GhostButton>عوضش کن</GhostButton>
        <QuietButton>چرا این را ساختی؟</QuietButton>
      </Actions>
      <p className="mt-7 text-[13px] text-white/30">پسندیدن یعنی نگهش دارم. انتشار را جدا می‌پرسم.</p>
    </Screen>
  );
}

/** 7 — Hero screen. Loadder changes its mind because reality changed. */
export function Replan() {
  return (
    <Screen>
      <Brand />
      <Hero sub="چیزی دیدم که قبلاً نمی‌دانستم، و به نظرم ترتیب کارها باید عوض شود.">{REPLAN.headline}</Hero>
      <Card>
        <Figures items={REPLAN.numbers} />
        <p className="mt-8 text-[17px] leading-[2] text-white/80">{REPLAN.reasoning}</p>
      </Card>
      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] px-6 py-5">
          <div className="text-[12px] text-white/30">قدم بعدی قبلاً</div>
          <div className="mt-2 text-[16px] text-white/40 line-through decoration-white/20">{REPLAN.before}</div>
        </div>
        <FlowArrow size={20} className="mx-auto hidden text-white/20 sm:block" />
        <div className="rounded-2xl border border-violet-300/20 bg-violet-500/[0.08] px-6 py-5">
          <div className="text-[12px] text-violet-200/70">حالا</div>
          <div className="mt-2 text-[16px] font-bold text-white">{REPLAN.after}</div>
        </div>
      </div>
      <Actions>
        <PrimaryButton>باشه، برنامه را عوض کن</PrimaryButton>
        <GhostButton>چرا؟</GhostButton>
        <QuietButton>فعلاً ادامه نده</QuietButton>
      </Actions>
    </Screen>
  );
}

/** 8 — Result. Number, then meaning, then the edge of what is known. */
export function Result() {
  return (
    <Screen>
      <Brand note="دو هفته بعد" />
      <Hero>نتیجهٔ صفحهٔ تازه.</Hero>
      <Card>
        <Figures items={RESULT.numbers} />
        <p className="mt-8 text-[20px] leading-[1.9] text-white/90">{RESULT.meaning}</p>
      </Card>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] border border-emerald-300/15 bg-emerald-400/[0.05] p-6">
          <div className="text-[12px] font-bold text-emerald-200/85">می‌دانم</div>
          <p className="mt-2.5 text-[15px] leading-[1.95] text-white/75">{RESULT.known}</p>
        </div>
        <div className="rounded-[24px] border border-amber-300/15 bg-amber-400/[0.05] p-6">
          <div className="text-[12px] font-bold text-amber-200/85">هنوز نمی‌دانم</div>
          <p className="mt-2.5 text-[15px] leading-[1.95] text-white/75">{RESULT.unknown}</p>
        </div>
      </div>
      <Actions>
        <PrimaryButton>قدم بعدی چیست؟</PrimaryButton>
        <QuietButton>جزئیات کامل</QuietButton>
      </Actions>
    </Screen>
  );
}

/** 9 — Learning, with the confidence boundary attached rather than added later. */
export function Learning() {
  return (
    <Screen>
      <Brand />
      <Hero>این را یاد گرفتم.</Hero>
      <Card>
        <div className="divide-y divide-white/[0.05]">
          <ConfidenceLine tone="saw">{LEARNING.saw}</ConfidenceLine>
          <ConfidenceLine tone="think">{LEARNING.think}</ConfidenceLine>
        </div>
      </Card>
      <div className="mt-9 rounded-[28px] border border-violet-300/15 bg-violet-500/[0.06] p-7 sm:p-9">
        <p className="text-[17px] leading-[2] text-white/85">{LEARNING.offer}</p>
        <Actions>
          <PrimaryButton>بگذار امتحان کنیم</PrimaryButton>
          <QuietButton>فعلاً نه</QuietButton>
        </Actions>
      </div>
    </Screen>
  );
}

/** 10 — Mature home. Four zones, one primary attention item, tools variant A or B. */
export function MatureHome({ variant }: { variant: "full" | "shortlist" }) {
  const m = MATURE.primary;
  return (
    <Screen>
      <Brand note="روز ۱۸۰" />
      <Zone label="به شما نیاز دارد">
        <Card tone="lifted">
          <p className="text-[24px] font-bold leading-[1.6] sm:text-[28px]">{m.title}</p>
          <div className="mt-7 space-y-5">
            <div>
              <div className="text-[12px] font-bold text-violet-300/70">برداشت من</div>
              <p className="mt-1.5 text-[16px] leading-[1.95] text-white/75">{m.belief}</p>
            </div>
            <div>
              <div className="text-[12px] font-bold text-violet-300/70">پیشنهاد من</div>
              <p className="mt-1.5 text-[16px] leading-[1.95] text-white/75">{m.suggestion}</p>
            </div>
            <div>
              <div className="text-[12px] font-bold text-violet-300/70">از شما چه می‌خواهم</div>
              <p className="mt-1.5 text-[16px] leading-[1.95] text-white/75">{m.ask}</p>
            </div>
          </div>
          <p className="mt-7 text-[13px] text-white/35">{m.consequence}</p>
          <Actions>
            <PrimaryButton>باشه، آماده کن</PrimaryButton>
            <GhostButton>چرا این را می‌گویی؟</GhostButton>
            <QuietButton>فعلاً نه</QuietButton>
          </Actions>
        </Card>
        <p className="mt-4 px-2 text-[14px] text-white/30">{MATURE.quiet}</p>
      </Zone>

      <Zone label="در حال انجام">
        <Card tone="quiet">
          <div className="divide-y divide-white/[0.04]">
            {MATURE.inProgress.map((p) => <StepRow key={p.text} state="waiting" text={p.text} detail={p.detail} />)}
          </div>
        </Card>
      </Zone>

      <Zone label="چیزی که یاد گرفته‌ام">
        <Card tone="quiet">
          <p className="text-[16px] leading-[1.95] text-white/80">{MATURE.learned.saw}</p>
          <p className="mt-3 text-[14px] leading-[1.9] text-amber-200/70">{MATURE.learned.boundary}</p>
        </Card>
      </Zone>

      {variant === "full"
        ? <ToolSection tools={TOOLS} />
        : <ToolSection tools={SHORTLIST} footer={<a href="/dashboard" className="inline-flex min-h-11 items-center text-[14px] text-white/40">همه ابزارها ({new Intl.NumberFormat("fa-IR").format(TOOLS.length)})</a>} />}
    </Screen>
  );
}
