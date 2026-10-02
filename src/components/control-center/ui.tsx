import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "../../lib/api";

export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Query<T> = { data: T | null; error: string; loading: boolean; reload: () => Promise<void> };
export type Notice = { tone: "ok" | "error"; text: string } | null;

export const fa = (value: number) => value.toLocaleString("fa-IR");
export const input = "min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-[#2b2a27]";
export const button = "min-h-11 rounded-xl bg-[#2b2a27] px-4 text-sm font-bold text-white disabled:opacity-40";
export const ghost = "min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-bold";

/** One read of a canonical endpoint. `path = null` skips the request (module not open yet). */
export function useQuery<T>(path: string | null): Query<T> {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(Boolean(path));
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const response = await apiFetch(path);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(response.status === 403 ? "این بخش فقط برای مالک یا مدیر Workspace در دسترس است." : body.message || "بارگذاری ناموفق بود."); setData(null); }
      else { setData(body as T); setError(""); }
    } catch { setError("ارتباط با سرور برقرار نشد."); } finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}

export const Panel = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => <section className="min-w-0 rounded-3xl border border-[#2b2a27]/10 bg-white p-5 sm:p-6"><h2 className="text-lg font-black">{title}</h2>{hint && <p className="mt-1 text-xs leading-6 text-stone-500">{hint}</p>}<div className="mt-4">{children}</div></section>;
export const Empty = ({ children }: { children: ReactNode }) => <p data-empty className="rounded-2xl border border-dashed border-stone-300 p-4 text-sm leading-7 text-stone-600">{children}</p>;
export const Problem = ({ children }: { children: ReactNode }) => children ? <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{children}</p> : null;
export const Stat = ({ label, value }: { label: string; value: number | string }) => <div data-stat={label} className="rounded-2xl bg-[#f7f3ea] p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-2xl font-black">{typeof value === "number" ? fa(value) : value}</p></div>;
export const Row = ({ children }: { children: ReactNode }) => <article className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f7f3ea] p-4 text-sm">{children}</article>;
export const NoticeBar = ({ notice }: { notice: Notice }) => notice ? <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm ${notice.tone === "error" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>{notice.text}</p> : null;
