import { useState } from "react";

type Props = { src?: string; poster?: string; title: string };
type State = "loading" | "ready" | "error";

// Native HTML5 video for a published detail. Only an https address is played;
// without one the page states that no video is published instead of faking it.
export default function PerformanceVideo({ src, poster, title }: Props) {
  const [state, setState] = useState<State>("loading");
  const playable = typeof src === "string" && /^https:\/\//i.test(src);
  if (!playable) return <p data-video-state="unavailable" className="mt-8 rounded-2xl border border-dashed border-[#d9bc83]/35 p-5 text-sm leading-7 text-[#f5f0e5]/75">ویدئوی این اجرا هنوز منتشر نشده است.</p>;
  return <figure className="mt-8" data-video-state={state}>
    <div className="relative overflow-hidden rounded-3xl bg-black">
      <video aria-label={title} className="block max-h-[520px] w-full" controls playsInline preload="metadata" poster={poster && /^https:\/\//i.test(poster) ? poster : undefined} src={src}
        onLoadedData={() => setState("ready")} onError={() => setState("error")} />
      {state === "loading" && <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-[#f5f0e5]/70">در حال بارگذاری ویدئو…</p>}
    </div>
    {state === "error" && <p role="alert" className="mt-3 rounded-2xl border border-rose-300/30 bg-rose-950/30 p-4 text-sm">پخش ویدئو ممکن نیست. فایل در دسترس نیست یا قالب آن پشتیبانی نمی‌شود.</p>}
  </figure>;
}
