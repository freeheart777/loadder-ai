import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Resource = { id: string; title: string; assetType: "document" | "audio" | "video"; mimeType: string; sizeBytes: number };
type View = "loading" | "ready" | "signin" | "not-enrolled" | "error";

// An invite is single-use: share one exchange per token so a re-run of the
// effect (StrictMode, remount) cannot consume it twice.
const exchanges = new Map<string, Promise<string | null>>();
function exchangeInvite(projectId: string, invite: string) {
  const key = `${projectId}:${invite}`;
  let pending = exchanges.get(key);
  if (!pending) {
    pending = apiFetch(`/api/auth/public/apps/${encodeURIComponent(projectId)}/invite/exchange`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: invite }) })
      .then(async (response) => { const body = await response.json().catch(() => ({})); return response.ok && body.session?.token ? String(body.session.token) : null; })
      .catch(() => null);
    exchanges.set(key, pending);
  }
  return pending;
}

const typeLabel: Record<Resource["assetType"], string> = { document: "جزوه و سند", audio: "فایل صوتی", video: "ویدئوی آموزشی" };

// Student Portal: authenticated by the existing app-user session, authorized by
// an active enrolment on the server. Files are fetched with the session header
// and never exposed through a public or guessable URL.
export default function EducationPortalPage() {
  const { projectId = "", siteProjectId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tokenKey = `loadder-public-app-token:${projectId}`;
  const [view, setView] = useState<View>("loading");
  const [resources, setResources] = useState<Resource[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const playingUrl = useRef("");

  const token = () => { try { return sessionStorage.getItem(tokenKey) || ""; } catch { return ""; } };
  const base = `/api/auth/public/apps/${encodeURIComponent(projectId)}/education/sites/${encodeURIComponent(siteProjectId)}/resources`;
  const authed = useCallback((path: string, signal?: AbortSignal) => apiFetch(path, { signal, headers: { "X-Loadder-App-Token": token() } }), [tokenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const invite = params.get("invite");
        if (invite) {
          const sessionToken = await exchangeInvite(projectId, invite);
          if (!sessionToken) throw Object.assign(new Error("دعوت معتبر نیست یا قبلاً استفاده شده است."), { view: "signin" });
          try { sessionStorage.setItem(tokenKey, sessionToken); } catch { /* storage unavailable */ }
          params.delete("invite"); setParams(params, { replace: true });
        }
        if (!token()) { setView("signin"); return; }
        const response = await authed(base, controller.signal);
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) { setView("signin"); return; }
        if (response.status === 403) { setView("not-enrolled"); return; }
        if (!response.ok || !Array.isArray(data.resources)) throw new Error("منابع آموزشی در دسترس نیست.");
        setResources(data.resources); setView("ready");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "دسترسی ممکن نیست.");
        setView((error as { view?: View }).view || "error");
      }
    })();
    return () => controller.abort();
  }, [projectId, siteProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (playingUrl.current) URL.revokeObjectURL(playingUrl.current); }, []);

  async function open(resource: Resource, mode: "download" | "play") {
    setBusyId(resource.id); setMessage("");
    try {
      const response = await authed(`${base}/${encodeURIComponent(resource.id)}/file${mode === "play" ? "?disposition=inline" : ""}`);
      if (!response.ok) throw new Error(response.status === 403 ? "دسترسی شما به این منبع فعال نیست." : "دریافت فایل ممکن نشد.");
      const url = URL.createObjectURL(await response.blob());
      if (mode === "play") {
        if (playingUrl.current) URL.revokeObjectURL(playingUrl.current);
        playingUrl.current = url; setPlaying({ id: resource.id, url });
      } else {
        const link = document.createElement("a");
        link.href = url; link.download = resource.title; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "دریافت فایل ممکن نشد."); }
    finally { setBusyId(""); }
  }

  function signOut() { try { sessionStorage.removeItem(tokenKey); } catch { /* ignore */ } setResources([]); setPlaying(null); setView("signin"); }

  const notice = (text: string, tone: "plain" | "alert" = "plain") => <p role={tone === "alert" ? "alert" : undefined} className={`mt-8 rounded-2xl border p-5 text-sm leading-7 ${tone === "alert" ? "border-rose-300/30 bg-rose-950/30" : "border-[#d9bc83]/25 text-[#f5f0e5]/75"}`}>{text}</p>;

  return <main dir="rtl" className="min-h-screen bg-[#242321] px-4 py-7 text-[#f5f0e5] sm:p-10">
    <section className="mx-auto max-w-4xl">
      <header className="rounded-[2rem] border border-[#d9bc83]/25 bg-[#2d2b27] p-6 sm:p-9">
        <p className="text-sm text-[#d9bc83]">پرتال آموزشی</p>
        <h1 className="mt-2 text-3xl font-black">منابع کلاس شما</h1>
        <p className="mt-4 max-w-2xl leading-8 text-[#f5f0e5]/70">فقط دانشجویانِ ثبت‌نام‌شده به منابع خصوصی این دوره دسترسی دارند.</p>
        {view === "ready" && <button type="button" onClick={signOut} className="mt-5 min-h-11 rounded-xl border border-[#d9bc83]/40 px-4 text-sm font-bold text-[#d9bc83]">خروج</button>}
      </header>
      {message && view === "ready" && notice(message, "alert")}
      {view === "loading" && <p className="mt-8 text-sm text-[#f5f0e5]/60">در حال دریافت منابع…</p>}
      {view === "signin" && notice(message || "برای مشاهدهٔ منابع، از لینک دعوتی که برای شما ارسال شده وارد شوید.")}
      {view === "not-enrolled" && notice("حساب شما در این دوره ثبت‌نام فعال ندارد. برای دسترسی با مسئول آموزشگاه تماس بگیرید.")}
      {view === "error" && notice(message || "منابع آموزشی در دسترس نیست.", "alert")}
      {view === "ready" && !resources.length && <div className="mt-8 rounded-3xl border border-dashed border-[#d9bc83]/30 p-7 text-sm leading-7 text-[#f5f0e5]/65">هنوز منبع آموزشی‌ای برای شما منتشر نشده است.</div>}
      {view === "ready" && <div className="mt-8 grid gap-4 sm:grid-cols-2">{resources.map((resource) => <article key={resource.id} className="min-w-0 rounded-3xl border border-[#d9bc83]/20 bg-[#f5f0e5] p-5 text-[#292721]">
        <span className="text-xs font-bold text-[#8d6b35]">{typeLabel[resource.assetType]}</span>
        <h2 className="mt-2 break-words text-lg font-black">{resource.title}</h2>
        <p className="mt-2 text-xs text-stone-500">{Math.ceil(resource.sizeBytes / 1024).toLocaleString("fa-IR")} کیلوبایت</p>
        {playing?.id === resource.id && (resource.assetType === "video"
          ? <video className="mt-4 w-full rounded-xl" controls src={playing.url} />
          : <audio className="mt-4 w-full" controls src={playing.url} />)}
        <div className="mt-5 flex flex-wrap gap-2">
          {resource.assetType !== "document" && <button type="button" disabled={busyId === resource.id} onClick={() => open(resource, "play")} className="min-h-11 rounded-xl border border-[#292721] px-4 text-sm font-bold disabled:opacity-50">پخش</button>}
          <button type="button" disabled={busyId === resource.id} onClick={() => open(resource, "download")} className="min-h-11 rounded-xl bg-[#292721] px-4 text-sm font-bold text-white disabled:opacity-50">دانلود امن</button>
        </div>
      </article>)}</div>}
    </section>
  </main>;
}
