import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { navigationPages, normalizeSlug, slugProblem } from "./pages";
import type { StudioActions, StudioConfig } from "./types";

// The smallest page manager that covers the model: list, add, rename, address,
// switch, delete (Home protected), navigation visibility and per-page SEO.
// Theme, header and footer stay site-wide and are edited elsewhere.

const field = "min-h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none focus:border-emerald-400";

export default function PageManager({ config, actions }: { config: StudioConfig; actions: StudioActions }) {
  const [slugDraft, setSlugDraft] = useState<Record<string, string>>({});
  const active = config.pages.find((page) => page.id === config.activePageId) || config.pages[0];
  const navCount = navigationPages(config.pages).length;

  return (
    <div className="space-y-4" data-page-manager="v16">
      <div>
        <p className="text-[10px] font-black tracking-[.18em] text-emerald-300">PAGES</p>
        <h2 className="mt-1 text-lg font-black">صفحه‌های سایت</h2>
        <p className="mt-2 text-xs leading-6 text-white/40">قالب، هدر و فوتر بین همه صفحه‌ها مشترک است؛ بخش‌ها، آدرس و SEO برای هر صفحه جداگانه است.</p>
      </div>

      <div className="space-y-2">
        {config.pages.map((page, index) => {
          const selected = page.id === active?.id;
          const draft = slugDraft[page.id] ?? page.slug;
          const problem = page.isHome ? null : slugProblem(draft, config.pages, page.id);
          return (
            <div key={page.id} data-page-row={page.id} className={`rounded-xl border p-3 ${selected ? "border-emerald-400 bg-emerald-400/5" : "border-white/10 bg-white/[.025]"}`}>
              <button type="button" onClick={() => actions.selectPage(page.id)} className="w-full text-right">
                <b className="block text-xs">{page.title}</b>
                <span className="text-[10px] text-white/35">{page.isHome ? "/ (خانه)" : `/${page.slug}`}</span>
              </button>

              {selected && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <label className="block text-[10px] text-white/50">عنوان صفحه
                    <input className={`mt-1 ${field}`} aria-label="عنوان صفحه" value={page.title} onChange={(event) => actions.patchPage(page.id, { title: event.target.value })} />
                  </label>
                  {!page.isHome && (
                    <label className="block text-[10px] text-white/50">آدرس صفحه
                      <input
                        className={`mt-1 ${field} ${problem ? "border-rose-400" : ""}`}
                        aria-label="آدرس صفحه"
                        value={draft}
                        onChange={(event) => setSlugDraft((current) => ({ ...current, [page.id]: event.target.value }))}
                        onBlur={() => {
                          const next = normalizeSlug(draft);
                          if (!problem && next) actions.patchPage(page.id, { slug: next });
                          setSlugDraft((current) => ({ ...current, [page.id]: problem ? draft : (next || page.slug) }));
                        }}
                      />
                      {problem && <span role="alert" className="mt-1 block text-[10px] text-rose-300">{problem}</span>}
                    </label>
                  )}
                  <label className="flex min-h-10 items-center justify-between gap-3 rounded-xl bg-black/20 px-3 text-[11px] text-white/60">
                    <span>نمایش در منو</span>
                    <input type="checkbox" aria-label="نمایش در منو" checked={page.showInNav !== false}
                      disabled={page.showInNav !== false && navCount < 2}
                      onChange={(event) => actions.patchPage(page.id, { showInNav: event.target.checked })}
                      className="h-5 w-5 accent-emerald-400" />
                  </label>
                  <label className="block text-[10px] text-white/50">عنوان SEO
                    <input className={`mt-1 ${field}`} aria-label="عنوان SEO" value={page.seo.title} onChange={(event) => actions.patchPage(page.id, { seo: { ...page.seo, title: event.target.value } })} />
                  </label>
                  <label className="block text-[10px] text-white/50">توضیح SEO
                    <textarea className={`mt-1 ${field} min-h-20 py-2`} aria-label="توضیح SEO" value={page.seo.description} onChange={(event) => actions.patchPage(page.id, { seo: { ...page.seo, description: event.target.value } })} />
                  </label>
                  {!page.isHome && (
                    <div className="flex gap-1">
                      <button type="button" aria-label="بالا" onClick={() => actions.movePage(page.id, -1)} disabled={index < 2} className="grid min-h-9 min-w-9 place-items-center rounded-lg bg-white/5 disabled:opacity-30"><ArrowUp /></button>
                      <button type="button" aria-label="پایین" onClick={() => actions.movePage(page.id, 1)} disabled={index >= config.pages.length - 1} className="grid min-h-9 min-w-9 place-items-center rounded-lg bg-white/5 disabled:opacity-30"><ArrowDown /></button>
                      <button type="button" aria-label="حذف صفحه" onClick={() => actions.deletePage(page.id)} className="grid min-h-9 min-w-9 place-items-center rounded-lg bg-rose-500/10 text-rose-300"><Trash /></button>
                    </div>
                  )}
                  {page.isHome && <p className="text-[10px] leading-5 text-white/35">صفحه خانه آدرس اصلی سایت است و حذف نمی‌شود.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={actions.addPage} data-add-page className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-xs font-black text-emerald-300">
        <Plus /> افزودن صفحه
      </button>
    </div>
  );
}
