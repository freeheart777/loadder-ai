import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { restoreConfig } from "./config";
import StudioCanvas from "./StudioCanvas";
import type { DeviceMode, Selection } from "./types";
import { apiFetch } from "../../lib/api";

// The live corporate site is the same V16 canvas the studio renders, fed by the
// published version instead of the draft. It is a data adapter, not a renderer:
// preview and live cannot drift because they share StudioCanvas.

type SiteMeta = {
  site: { id: string; name: string; siteType: string };
  presentation: Record<string, unknown>;
  publishedVersion: { id: string; version: number; publishedAt: string };
};

const read = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "سایت در دسترس نیست.");
  return data;
};
const deviceForWidth = (width: number): DeviceMode => (width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop");

export default function PublicSiteRuntime() {
  const { siteProjectId } = useParams();
  const [meta, setMeta] = useState<SiteMeta | null>(null);
  const [selected, setSelected] = useState<Selection>({ type: "hero", id: "hero" });
  const [device, setDevice] = useState<DeviceMode>(() => deviceForWidth(window.innerWidth));
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onResize = () => setDevice(deviceForWidth(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!siteProjectId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        setMeta(await read(await apiFetch(`/api/auth/site/${siteProjectId}`, { signal: controller.signal })));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMessage(error instanceof Error ? error.message : "سایت در دسترس نیست.");
        }
      }
    })();
    return () => controller.abort();
  }, [siteProjectId]);

  const config = useMemo(() => restoreConfig(meta?.presentation || {}, "BUSINESS"), [meta]);

  useEffect(() => {
    if (!meta) return;
    const title = config.seo.title || meta.site.name;
    document.title = title;
    const tag = document.querySelector('meta[name="description"]') || document.head.appendChild(Object.assign(document.createElement("meta"), { name: "description" }));
    tag.setAttribute("content", config.seo.description || config.hero.subtitle || "");
  }, [config, meta]);

  const submitLead = async (input: { name: string; phone: string; email: string; company: string; message: string }) => {
    const response = await apiFetch(`/api/auth/site/${siteProjectId}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    await read(response);
  };

  if (message) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="rounded-3xl border bg-white p-8 text-center"><p>{message}</p><Link to="/" className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-3 text-white">بازگشت</Link></div></main>;
  if (!meta) return <main className="min-h-screen bg-slate-50" aria-label="در حال بارگذاری سایت" />;

  return <main data-published-version-id={meta.publishedVersion.id} data-published-version={meta.publishedVersion.version}>
    <StudioCanvas config={config} products={[]} device={device} selected={selected} select={setSelected} interactive={false} onLeadSubmit={submitLead} />
  </main>;
}
