import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CursorClick } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import InspectorPanel from "../components/store-studio-v16/InspectorPanel";
import StudioCanvas from "../components/store-studio-v16/StudioCanvas";
import StudioToolbar from "../components/store-studio-v16/StudioToolbar";
import {
  defaultProductSettings,
  designDefaults,
  restoreConfig,
} from "../components/store-studio-v16/config";
import type {
  DeviceMode,
  MediaAsset,
  Product,
  SectionConfig,
  StudioActions,
  StudioConfig,
} from "../components/store-studio-v16/types";
import { apiFetch } from "../lib/api";

type Project = {
  id: string;
  name?: string;
  content: Record<string, any>;
};

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "عملیات Studio ناموفق بود");
  return data;
}

function newSection(type: SectionConfig["type"]): SectionConfig {
  const labels = {
    products: "محصولات جدید",
    banner: "بنر جدید",
    trust: "مزیت‌های خرید",
    text: "متن جدید",
    spacer: "فاصله",
  };
  return {
    id: `${type}-${crypto.randomUUID()}`,
    type,
    enabled: true,
    title: labels[type],
    subtitle: type === "spacer" ? "" : "برای ویرایش این بخش روی آن کلیک کنید.",
    backgroundColor: type === "banner" ? designDefaults.primaryColor : designDefaults.surfaceColor,
    textColor: type === "banner" ? "#ffffff" : designDefaults.textColor,
    spacingTop: type === "spacer" ? 32 : designDefaults.sectionSpacing,
    spacingBottom: type === "spacer" ? 32 : designDefaults.sectionSpacing,
    ...(type === "products" ? { productSettings: { ...defaultProductSettings } } : {}),
  };
}

export default function StoreWebsiteStudioPageV16() {
  const [project, setProject] = useState<Project | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [config, setConfig] = useState<StudioConfig>(() => restoreConfig({}));
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [inspectorTab, setInspectorTab] = useState<"context" | "sections" | "design">("context");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const listing = await read(await apiFetch("/api/site-projects", { signal: controller.signal }));
        const selected = (listing.projects || []).find((item: any) => String(item.siteType).toUpperCase() === "STORE") || listing.projects?.[0];
        if (!selected) throw new Error("پروژه فروشگاهی پیدا نشد");
        const detail = await read(await apiFetch(`/api/site-projects/${selected.id}`, { signal: controller.signal }));
        const loaded = detail.project as Project;
        setProject(loaded);
        setConfig(restoreConfig(loaded.content || {}));
        setAssets((detail.assets || []).filter((asset: MediaAsset) => typeof asset.url === "string"));
        const catalog = await read(await apiFetch(`/api/stores/${selected.id}/products`, { signal: controller.signal }));
        setProducts(catalog.products || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "بارگذاری Studio ناموفق بود");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const actions = useMemo<StudioActions>(() => ({
    select: (selectedElement) => {
      setConfig((current) => ({ ...current, selectedElement }));
      setInspectorTab("context");
    },
    patchDesign: (patch) => setConfig((current) => ({ ...current, design: { ...current.design, ...patch } })),
    patchHeader: (patch) => setConfig((current) => ({ ...current, header: { ...current.header, ...patch } })),
    patchHero: (patch) => setConfig((current) => ({ ...current, hero: { ...current.hero, ...patch } })),
    patchSection: (id, patch) => setConfig((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section) })),
    patchProduct: (id, patch) => setConfig((current) => ({ ...current, commerce: { ...current.commerce, productOverrides: { ...current.commerce.productOverrides, [id]: { ...(current.commerce.productOverrides[id] || {}), ...patch } } } })),
    patchCommerce: (patch) => setConfig((current) => ({ ...current, commerce: { ...current.commerce, ...patch } })),
  }), []);

  function moveSection(id: string, delta: number) {
    setConfig((current) => {
      const index = current.sections.findIndex((section) => section.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections };
    });
  }

  function duplicateSection(id: string) {
    setConfig((current) => {
      const index = current.sections.findIndex((section) => section.id === id);
      if (index < 0) return current;
      const copy = { ...current.sections[index], id: `${current.sections[index].type}-${crypto.randomUUID()}`, title: `${current.sections[index].title} (کپی)`, productSettings: current.sections[index].productSettings ? { ...current.sections[index].productSettings!, productIds: [...current.sections[index].productSettings!.productIds] } : undefined };
      const sections = [...current.sections];
      sections.splice(index + 1, 0, copy);
      return { ...current, sections, selectedElement: { type: copy.type === "banner" ? "banner" : copy.type === "trust" ? "trust" : "section", id: copy.id } };
    });
  }

  function deleteSection(id: string) {
    setConfig((current) => {
      const sections = current.sections.filter((section) => section.id !== id);
      return { ...current, sections, selectedElement: current.selectedElement.id === id ? { type: "hero", id: "hero" } : current.selectedElement };
    });
  }

  function addSection(type: SectionConfig["type"]) {
    const section = newSection(type);
    setConfig((current) => ({ ...current, sections: [...current.sections, section], selectedElement: { type: type === "banner" ? "banner" : type === "trust" ? "trust" : "section", id: section.id } }));
    setInspectorTab("context");
  }

  async function save() {
    if (!project) return;
    setBusy(true);
    setMessage("");
    try {
      const storeBuilderV16: StudioConfig = { ...config, version: 16 };
      const content = { ...project.content, storeBuilderV16 };
      const output = await read(await apiFetch(`/api/site-projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }));
      setProject(output.project);
      setMessage("طراحی Commerce Studio V16 ذخیره شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره Studio ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  const inspectorProps = { config, products, assets, actions, moveSection, duplicateSection, deleteSection, addSection };

  return (
    <main dir="rtl" className="h-screen overflow-hidden bg-[#070b12] text-white" data-studio-version="16">
      <header className="flex min-h-20 flex-wrap items-center gap-3 border-b border-emerald-400/15 bg-[#0a111b] px-4 py-3">
        <Link to="/dashboard" aria-label="بازگشت به داشبورد" className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 bg-white/5"><ArrowRight /></Link>
        <div className="min-w-52"><div className="text-[10px] font-black tracking-[.18em] text-emerald-300">TRUE VISUAL COMMERCE BUILDER</div><h1 className="text-base font-black sm:text-lg">Loadder Commerce Studio V16</h1><p className="mt-1 flex items-center gap-1 text-[10px] text-white/35"><CursorClick /> روی فروشگاه کلیک کنید و همان‌جا ویرایش کنید</p></div>
        <StudioToolbar device={device} page={config.activePage} busy={busy || !project} onDevice={setDevice} onPage={(activePage) => setConfig((current) => ({ ...current, activePage, selectedElement: { type: activePage === "storefront" ? "hero" : activePage, id: activePage === "storefront" ? "hero" : activePage } }))} onSave={() => void save()} />
      </header>
      <div className="grid h-[calc(100vh-80px)] min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="order-2 min-h-0 overflow-auto bg-[#202936] p-4 sm:p-7 lg:order-1">
          {busy && !project ? <div className="grid min-h-96 place-items-center text-white/45">در حال آماده‌سازی بوم V16…</div> : <StudioCanvas config={config} products={products} device={device} selected={config.selectedElement} select={actions.select} />}
        </section>
        <div className="order-1 max-h-[48vh] min-h-0 lg:order-2 lg:max-h-none">
          <InspectorPanel {...inspectorProps} tab={inspectorTab} onTab={setInspectorTab} />
        </div>
      </div>
      {message && <div role="status" className="fixed bottom-5 left-5 z-50 max-w-sm rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-xs shadow-2xl">{message}</div>}
    </main>
  );
}
