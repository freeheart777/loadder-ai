import type { StepId } from "./types";

const steps: Array<{ id: Exclude<StepId, "COMPLETE">; label: string }> = [
  { id: "BUSINESS", label: "کسب‌وکار" },
  { id: "OFFERING", label: "محصولات" },
  { id: "AUDIENCE", label: "مشتریان" },
  { id: "BRAND", label: "لحن برند" },
  { id: "REVIEW", label: "مرور" },
];

export function OnboardingProgress({ current }: { current: Exclude<StepId, "COMPLETE"> }) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return (
    <nav aria-label="مراحل راه‌اندازی" className="mb-8">
      <p className="mb-3 text-sm text-white/55">مرحله {currentIndex + 1} از ۵</p>
      <ol className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <li key={step.id} aria-current={step.id === current ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${index <= currentIndex ? "bg-violet-400" : "bg-white/10"}`} />
            <span className="mt-2 hidden text-xs text-white/50 sm:block">{step.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
