import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { GROUP_LABELS } from "./modules";
import type { ControlCenterKind, ModuleKey } from "./modules";

// The single Control Center shell. Desktop: persistent navigation on the RIGHT (RTL).
// Mobile: a compact bar with a menu sheet. It owns navigation and the build<->operate links
// only; every module renders its own canonical data inside it.
export type ShellModule = { key: ModuleKey; group: "overview" | "operate" | "content" | "system"; label: string };
export type ShellLink = { label: string; to: string; newTab?: boolean; testId: string };

const ACCENT: Record<ControlCenterKind, { active: string; chip: string; mark: string }> = {
  MEDICAL: { active: "bg-[#5f7560] text-white", chip: "bg-[#e6ede2] text-[#3f5a42]", mark: "bg-[#5f7560]" },
  EDUCATION: { active: "bg-[#a98242] text-white", chip: "bg-[#f1e6cf] text-[#7a5d2a]", mark: "bg-[#a98242]" },
  STORE: { active: "bg-[#2b2a27] text-white", chip: "bg-stone-200 text-stone-700", mark: "bg-[#2b2a27]" },
  GENERIC: { active: "bg-[#2b2a27] text-white", chip: "bg-stone-200 text-stone-700", mark: "bg-[#2b2a27]" },
};

const navItem = "flex min-h-11 items-center rounded-xl px-3 text-sm font-bold";

type Props = {
  kind: ControlCenterKind;
  title: string;
  kicker: string;
  statusLabel?: string;
  modules: ShellModule[];
  active: ModuleKey;
  pathFor: (key: ModuleKey) => string;
  /** Build surface links (Website Studio, public site). Empty for workspace-level screens. */
  websiteLinks?: ShellLink[];
  backTo?: { label: string; to: string };
  children: ReactNode;
};

export default function ControlCenterShell({ kind, title, kicker, statusLabel, modules, active, pathFor, websiteLinks = [], backTo = { label: "سایت‌های من", to: "/dashboard/websites" }, children }: Props) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const accent = ACCENT[kind];
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const link = (item: ShellLink) => <a key={item.testId} data-cc-link={item.testId} href={item.to} {...(item.newTab ? { target: "_blank", rel: "noopener" } : {})} className={`${navItem} text-stone-700 hover:bg-black/5`}>{item.label}</a>;
  const websiteGroup = websiteLinks.length > 0 && <div key="website" data-cc-group="website">
    <p className="mb-1 px-3 text-[11px] font-black text-stone-400">وب‌سایت</p>
    <div className="flex flex-col gap-1">{websiteLinks.map((l) => l.newTab ? link(l) : <Link key={l.testId} data-cc-link={l.testId} to={l.to} className={`${navItem} text-stone-700 hover:bg-black/5`}>{l.label}</Link>)}</div>
  </div>;
  const groupNav = (group: ShellModule["group"]) => {
    const items = modules.filter((m) => m.group === group);
    if (!items.length) return null;
    return <div key={group} data-cc-group={group}>
      {!(items.length === 1 && items[0].label === GROUP_LABELS[group]) && <p className="mb-1 px-3 text-[11px] font-black text-stone-400">{GROUP_LABELS[group]}</p>}
      <div className="flex flex-col gap-1">
        {items.map((m) => <Link key={m.key} to={pathFor(m.key)} data-tab={m.key} aria-current={active === m.key ? "page" : undefined} className={`${navItem} ${active === m.key ? accent.active : "text-[#2b2a27] hover:bg-black/5"}`}>{m.label}</Link>)}
      </div>
    </div>;
  };
  // Order: مرکز کنترل · وب‌سایت · محتوا · عملیات · سیستم
  const nav = <nav aria-label="مرکز کنترل" className="flex flex-col gap-5">{groupNav("overview")}{websiteGroup}{groupNav("content")}{groupNav("operate")}{groupNav("system")}</nav>;

  const brand = <div className="flex items-center gap-3"><span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-black text-white ${accent.mark}`}>{(title || "•").trim().slice(0, 1)}</span><div className="min-w-0"><p className="truncate text-sm font-black">{title}</p><p className="truncate text-[11px] text-stone-500">{kicker}</p></div></div>;

  return <div dir="rtl" data-control-center data-cc-kind={kind} className="min-h-screen bg-[#f7f3ea] text-[#2b2a27] lg:flex">
    <aside data-cc-sidebar className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-black/10 bg-[#fffdf8] p-5 lg:flex">
      {brand}
      {nav}
      <Link to={backTo.to} className={`${navItem} mt-auto text-xs text-stone-500 hover:bg-black/5`}>{backTo.label}</Link>
    </aside>

    <div className="min-w-0 flex-1">
      <div data-cc-mobilebar className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-black/10 bg-[#fffdf8]/95 px-4 py-2 backdrop-blur lg:hidden">
        <div className="min-w-0">{brand}</div>
        <button type="button" data-cc-menu-button aria-expanded={open} aria-controls="cc-menu" onClick={() => setOpen(true)} className="min-h-11 shrink-0 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold">منو</button>
      </div>

      {open && <div className="fixed inset-0 z-40 lg:hidden" data-cc-menu>
        <button type="button" aria-label="بستن منو" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
        <div id="cc-menu" role="dialog" aria-modal="true" aria-label="منوی مرکز کنترل" className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col gap-6 overflow-y-auto bg-[#fffdf8] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">{brand}<button type="button" onClick={() => setOpen(false)} className="min-h-11 min-w-11 rounded-xl border border-stone-300 text-sm font-bold" aria-label="بستن">✕</button></div>
          {nav}
          <Link to={backTo.to} className={`${navItem} mt-auto text-xs text-stone-500`}>{backTo.label}</Link>
        </div>
      </div>}

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-8 sm:py-10">
        <header data-cc-header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-stone-500">{kicker}</p>
            <h1 className="mt-1 break-words text-2xl font-black sm:text-3xl">{title}</h1>
            {statusLabel && <span data-cc-status className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${accent.chip}`}>{statusLabel}</span>}
          </div>
          {websiteLinks.length > 0 && <div className="flex flex-wrap gap-2">{websiteLinks.map((l, i) => l.newTab
            ? <a key={l.testId} data-cc-action={l.testId} href={l.to} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold">{l.label}</a>
            : <Link key={l.testId} data-cc-action={l.testId} to={l.to} className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold ${i === 0 ? "bg-[#2b2a27] text-white" : "border border-stone-300 bg-white"}`}>{l.label}</Link>)}</div>}
        </header>
        {children}
      </main>
    </div>
  </div>;
}
