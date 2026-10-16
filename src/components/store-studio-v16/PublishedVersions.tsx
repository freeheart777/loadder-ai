import { useEffect, useState } from "react";
import { ClockCounterClockwise, X } from "@phosphor-icons/react";
import { apiFetch } from "../../lib/api";

type Version = { id: string; version: number; publishedAt?: string; manifest?: { rollbackOfVersionId?: string } };

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "عملیات ناموفق بود");
  return data;
}

// Published history of a site: the newest version is live; any earlier one can be made live again.
// A rollback publishes a NEW version holding the old content (nothing is deleted) and replaces the draft with it.
export default function PublishedVersions({ projectId, dirty, onRolledBack, open: controlledOpen, onOpenChange, hideTrigger = false }: { projectId: string; dirty: boolean; onRolledBack: () => Promise<void>; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = (value: boolean) => { setOwnOpen(value); onOpenChange?.(value); };
  const [versions, setVersions] = useState<Version[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setError("");
    apiFetch(`/api/site-projects/${projectId}/versions`, { signal: controller.signal }).then(read)
      .then((data) => setVersions(Array.isArray(data.versions) ? data.versions : []))
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود"); });
    return () => controller.abort();
  }, [open, projectId]);

  async function rollback(version: Version) {
    const warning = dirty ? " تغییرات ذخیره‌نشدهٔ فعلی از بین می‌روند." : " پیش‌نویس فعلی با این نسخه جایگزین می‌شود.";
    if (!window.confirm(`نسخهٔ ${version.version} دوباره منتشر شود؟${warning}`)) return;
    setBusyId(version.id); setError("");
    try {
      await read(await apiFetch(`/api/site-projects/${projectId}/publish-rollback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetVersionId: version.id }) }));
      await onRolledBack();
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "بازگردانی ناموفق بود"); }
    finally { setBusyId(""); }
  }

  return <>
    {!hideTrigger && <button type="button" onClick={() => setOpen(true)} data-published-versions-open className="flex min-h-10 items-center gap-1 rounded-xl border border-white/10 bg-white/[.045] px-3 text-[10px] font-bold text-white/80 hover:bg-white/[.08]"><ClockCounterClockwise size={14} /> نسخه‌های منتشرشده</button>}
    {open && <div role="dialog" aria-label="نسخه‌های منتشرشده" data-published-versions className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/80 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl border border-white/10 bg-[#0a111b] p-4 text-white shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><b>نسخه‌های منتشرشده</b><button type="button" aria-label="بستن" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><X size={16} /></button></div>
        {error && <p role="alert" className="mb-2 rounded-lg bg-rose-500/15 p-2 text-[11px] text-rose-200">{error}</p>}
        <ul className="grid gap-2">
          {versions.map((v, index) => <li key={v.id} data-version={v.version} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 p-3 text-xs">
            <span><b>نسخهٔ {v.version}</b>{index === 0 && <span className="mr-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-200">فعلی</span>}
              {v.manifest?.rollbackOfVersionId && <span className="mr-2 text-[10px] text-white/45">بازگردانی‌شده</span>}
              {v.publishedAt && <span className="mt-1 block text-[10px] text-white/45">{new Date(v.publishedAt).toLocaleString("fa-IR")}</span>}</span>
            {index > 0 && <button type="button" disabled={Boolean(busyId)} onClick={() => void rollback(v)} className="rounded-lg bg-violet-400/20 px-3 py-2 text-[11px] font-bold text-violet-100 disabled:opacity-40">{busyId === v.id ? "…" : "بازگردانی"}</button>}
          </li>)}
          {!error && versions.length === 0 && <li className="p-3 text-center text-[11px] text-white/45">هنوز نسخه‌ای منتشر نشده است.</li>}
        </ul>
      </div>
    </div>}
  </>;
}
