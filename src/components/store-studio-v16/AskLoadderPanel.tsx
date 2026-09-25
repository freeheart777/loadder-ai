import { useState } from "react";
import { MagicWand, Warning } from "@phosphor-icons/react";
import { apiFetch } from "../../lib/api";

type Operation = { type: string; target: string; path?: string; value?: unknown };
type ValidationResult = { index: number; outcome: string; propertyClass?: string };
type Patch = { id: string; baseRevision: number; operations: Operation[] };

const OUTCOME_FA: Record<string, string> = {
  ACCEPTED: "پذیرفته شد",
  REJECTED_INVALID_TARGET: "هدف نامعتبر است",
  REJECTED_INVALID_PATH: "این ویژگی در این بخش قابل تغییر نیست",
  REJECTED_INVALID_VALUE: "مقدار نامعتبر است",
  REJECTED_PROTECTED_PROPERTY: "رد شد؛ محافظت صحت تجاری (Commerce Truth)",
  REJECTED_SCHEMA: "ساختار درخواست نامعتبر است",
  REJECTED_PERMISSION: "بدون دسترسی",
  CONFLICT_REVISION: "این پیشنهاد بر پایه نسخه قدیمی بوده است",
};

const PATH_FA: Record<string, string> = {
  spacingTop: "فاصله بالای بخش",
  spacingBottom: "فاصله پایین بخش",
  visibleProductCount: "تعداد محصولات نمایش‌داده‌شده",
  productImageSize: "اندازه تصویر محصولات",
  price: "قیمت (محافظت‌شده)",
};

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.code ? ` (${data.code})` : "";
    throw new Error(`${data.message || "درخواست Ask Loadder ناموفق بود"}${code}`);
  }
  return data;
}

type Phase = "idle" | "translated" | "previewed" | "applied" | "undone";

type Props = {
  projectId: string;
  sectionId: string;
  sectionTitle: string;
  onApplied: (content: Record<string, any>, revision: number) => void;
  // Saves the editor's current draft first. The translator and the patch engine
  // work on the SAVED document, so without this a section that exists only in
  // the editor (e.g. defaults of a never-saved project) is "not found", and
  // unsaved edits would be overwritten by the applied patch.
  beforePropose?: () => Promise<void>;
};

export default function AskLoadderPanel({ projectId, sectionId, sectionTitle, onApplied, beforePropose }: Props) {
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [patch, setPatch] = useState<Patch | null>(null);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [appliedRevision, setAppliedRevision] = useState<number | null>(null);
  const [undoRevision, setUndoRevision] = useState<number | null>(null);

  const target = `section:${sectionId}`;

  function reset() {
    setPhase("idle");
    setWarnings([]);
    setOperations([]);
    setPatch(null);
    setResults([]);
    setAppliedRevision(null);
    setUndoRevision(null);
    setError("");
  }

  async function propose() {
    setBusy(true);
    setError("");
    try {
      await beforePropose?.();
      const translated = await read(await apiFetch(`/api/site-projects/${projectId}/ask-loadder/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, instruction }),
      }));
      setOperations(translated.operations);
      setWarnings(translated.warnings || []);

      const idempotencyKey = crypto.randomUUID();
      const proposed = await read(await apiFetch(`/api/site-projects/${projectId}/document-patches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations: translated.operations, idempotencyKey }),
      }));
      setPatch(proposed.patch);

      const preview = await read(await apiFetch(`/api/site-projects/${projectId}/document-patches/${proposed.patch.id}/preview`, { method: "POST" }));
      setResults(preview.results || []);
      setPhase("previewed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "پیشنهاد Ask Loadder ناموفق بود.");
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }

  async function confirmApply() {
    if (!patch) return;
    setBusy(true);
    setError("");
    try {
      const applied = await read(await apiFetch(`/api/site-projects/${projectId}/document-patches/${patch.id}/apply`, { method: "POST" }));
      setResults(applied.results || results);
      setAppliedRevision(applied.revision ?? null);
      setUndoRevision(patch.baseRevision);
      setPhase("applied");
      if (applied.project?.content && typeof applied.revision === "number") {
        onApplied(applied.project.content, applied.revision);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "اعمال تغییرات Ask Loadder ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (undoRevision === null) return;
    setBusy(true);
    setError("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const restored = await read(await apiFetch(`/api/site-projects/${projectId}/document-revisions/${undoRevision}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey }),
      }));
      setPhase("undone");
      if (restored.project?.content && typeof restored.revision === "number") {
        onApplied(restored.project.content, restored.revision);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "بازگردانی ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const accepted = results.filter((r) => r.outcome === "ACCEPTED").length;
  const rejected = results.length - accepted;

  return (
    <div data-ask-loadder-panel="true" className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.04] p-4">
      <div className="flex items-center gap-2 text-emerald-200"><MagicWand size={16} /><b className="text-xs font-black">Ask Loadder · {sectionTitle}</b></div>
      <p className="mt-1 text-[10px] leading-5 text-white/40">دستور خود را به زبان طبیعی بنویسید؛ فقط همین بخش تغییر می‌کند و پیش از اعمال، پیش‌نمایش نشان داده می‌شود.</p>

      <textarea
        aria-label="دستور Ask Loadder"
        value={instruction}
        disabled={busy || phase === "previewed"}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="مثلاً: این بخش را خلوت‌تر کن، فقط ۳ محصول نشان بده و تصاویر را بزرگ‌تر کن."
        className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-xs text-white outline-none focus:border-emerald-400"
      />

      {error && <div role="alert" data-ask-loadder-error="true" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-[11px] leading-6 text-rose-100"><Warning size={14} className="mt-0.5 shrink-0" />{error}</div>}

      {phase === "idle" && (
        <button type="button" disabled={busy || !instruction.trim()} onClick={() => void propose()} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-400 px-4 text-xs font-black text-slate-950 disabled:opacity-40">
          {busy ? "در حال ساخت پیش‌نمایش…" : "پیشنهاد بده و پیش‌نمایش نشان بده"}
        </button>
      )}

      {phase === "previewed" && (
        <div data-ask-loadder-preview="true" className="mt-3 space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <b className="text-[10px] font-black text-white/60">پیش‌نمایش تغییرات (هنوز اعمال نشده)</b>
            <ul className="mt-2 space-y-1.5">
              {operations.map((operation, index) => {
                const outcome = results[index]?.outcome || "ACCEPTED";
                const isOk = outcome === "ACCEPTED";
                return (
                  <li key={index} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px] ${isOk ? "bg-emerald-400/10 text-emerald-100" : "bg-rose-500/10 text-rose-100"}`}>
                    <span>{PATH_FA[operation.path || ""] || operation.path}{operation.value !== undefined ? ` → ${JSON.stringify(operation.value)}` : ""}</span>
                    <span className="shrink-0 font-black">{OUTCOME_FA[outcome] || outcome}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[10px] text-white/40">{accepted} مورد قابل اعمال{rejected > 0 ? ` · ${rejected} مورد رد شد` : ""}</p>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-[11px] leading-6 text-amber-100">
              {warnings.map((warning, i) => <p key={i}>{warning}</p>)}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={reset} className="min-h-11 flex-1 rounded-xl border border-white/10 px-4 text-xs font-bold disabled:opacity-40">انصراف</button>
            <button type="button" disabled={busy || accepted === 0} data-ask-loadder-confirm="true" onClick={() => void confirmApply()} className="min-h-11 flex-1 rounded-xl bg-emerald-400 px-4 text-xs font-black text-slate-950 disabled:opacity-40">
              {busy ? "در حال اعمال…" : "تایید و اعمال"}
            </button>
          </div>
        </div>
      )}

      {phase === "applied" && (
        <div data-ask-loadder-applied="true" className="mt-3 space-y-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-[11px] leading-6 text-emerald-100">
          <p>تغییرات اعمال شد{appliedRevision !== null ? ` (نسخه ${appliedRevision})` : ""}.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} data-ask-loadder-undo="true" onClick={() => void undo()} className="min-h-11 flex-1 rounded-xl border border-emerald-300/40 px-4 text-xs font-black text-emerald-100 disabled:opacity-40">
              {busy ? "در حال بازگردانی…" : "بازگردانی (Undo)"}
            </button>
            <button type="button" disabled={busy} onClick={() => { reset(); setInstruction(""); }} className="min-h-11 flex-1 rounded-xl bg-emerald-400 px-4 text-xs font-black text-slate-950 disabled:opacity-40">دستور جدید</button>
          </div>
        </div>
      )}

      {phase === "undone" && (
        <div data-ask-loadder-undone="true" className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-6 text-white/60">
          <p>تغییر بازگردانی شد؛ یک نسخه رو به جلوی تازه ثبت شد.</p>
          <button type="button" onClick={() => { reset(); setInstruction(""); }} className="min-h-11 w-full rounded-xl bg-emerald-400 px-4 text-xs font-black text-slate-950">دستور جدید</button>
        </div>
      )}
    </div>
  );
}
