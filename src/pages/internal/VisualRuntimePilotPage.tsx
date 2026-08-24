import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";

const LoadderDotMatrixPilot = lazy(() => import("../../internal/visual-pilot/LoadderDotMatrixPilot"));

export default function VisualRuntimePilotPage() {
  return <main className="min-h-screen bg-[#05040b] text-white">
    <section className="relative isolate flex min-h-[72vh] items-center overflow-hidden border-b border-white/10 px-6 py-24">
      <Suspense fallback={<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,.18),transparent_65%)]" aria-hidden="true" />}>
        <LoadderDotMatrixPilot density={44} intensity={0.74} speed={0.16} qualityTier="BALANCED" />
      </Suspense>
      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <p className="mb-5 text-sm font-semibold tracking-[0.24em] text-cyan-300">INTERNAL · NATIVE VISUAL RUNTIME PILOT</p>
        <h1 className="max-w-4xl text-4xl font-black leading-tight sm:text-6xl">یک مرز بصری کنترل‌شده، بدون قربانی‌کردن کیفیت سیستم</h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">این پس‌زمینه صرفاً تزئینی است. محتوا، عنوان و مسیر بازگشت همگی در DOM باقی می‌مانند و بدون WebGL نیز قابل استفاده‌اند.</p>
        <Link to="/dashboard" className="mt-9 inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-black/25 px-5 font-semibold text-white backdrop-blur">بازگشت به داشبورد</Link>
      </div>
    </section>
    <section className="mx-auto grid max-w-5xl gap-4 px-6 py-12 sm:grid-cols-3">
      {[["Runtime","Raw WebGL · one canvas"],["Fallback","CSS-only · no assets"],["Policy","Internal and development-only"]].map(([label,value])=><article key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-sm text-violet-300">{label}</h2><p className="mt-2 text-white/70">{value}</p></article>)}
    </section>
  </main>;
}
