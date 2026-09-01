import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CursorClick, ImageSquare, Plus, Tag, UploadSimple, X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import InspectorPanel from "../components/store-studio-v16/InspectorPanel";
import StudioCanvas from "../components/store-studio-v16/StudioCanvas";
import StudioToolbar from "../components/store-studio-v16/StudioToolbar";
import {
  defaultProductSettings,
  designDefaults,
  productsForSection,
  restoreConfig,
} from "../components/store-studio-v16/config";
import type {
  DeviceMode,
  MediaAsset,
  Product,
  ProductSettings,
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

type MediaTarget =
  | { kind: "hero" }
  | { kind: "banner"; sectionId: string }
  | { kind: "logo" };

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

function normalizeManualSettings(settings: ProductSettings, products: Product[]) {
  if (settings.source === "manual") return { ...settings, productIds: [...settings.productIds] };
  return {
    ...settings,
    source: "manual" as const,
    productIds: productsForSection(products, settings).slice(0, 12).map((product) => product.id),
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null);
  const [mediaTarget, setMediaTarget] = useState<MediaTarget | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);

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
      if (selectedElement.type === "hero") setMediaTarget({ kind: "hero" });
      if (selectedElement.type === "banner" && selectedElement.id) setMediaTarget({ kind: "banner", sectionId: selectedElement.id });
    },
    patchDesign: (patch) => setConfig((current) => ({ ...current, design: { ...current.design, ...patch } })),
    patchHeader: (patch) => setConfig((current) => ({ ...current, header: { ...current.header, ...patch } })),
    patchHero: (patch) => setConfig((current) => ({ ...current, hero: { ...current.hero, ...patch } })),
    patchSection: (id, patch) => setConfig((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section) })),
    patchProduct: (id, patch) => setConfig((current) => ({ ...current, commerce: { ...current.commerce, productOverrides: { ...current.commerce.productOverrides, [id]: { ...(current.commerce.productOverrides[id] || {}), ...patch } } } })),
    patchCommerce: (patch) => setConfig((current) => ({ ...current, commerce: { ...current.commerce, ...patch } })),
  }), []);

  function patchProductSection(sectionId: string, updater: (settings: ProductSettings) => ProductSettings) {
    setConfig((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === sectionId && section.type === "products" && section.productSettings
        ? { ...section, productSettings: updater(section.productSettings) }
        : section),
    }));
  }

  function addProductToSection(sectionId: string, productId: string) {
    const section = config.sections.find((item) => item.id === sectionId);
    const currentSettings = section?.type === "products" && section.productSettings ? normalizeManualSettings(section.productSettings, products) : null;
    const alreadyAdded = currentSettings?.productIds.includes(productId) ?? false;
    patchProductSection(sectionId, (raw) => {
      const settings = normalizeManualSettings(raw, products);
      return settings.productIds.includes(productId)
        ? settings
        : { ...settings, productIds: [...settings.productIds, productId].slice(0, 12) };
    });
    setPickerSectionId(null);
    actions.select({ type: "product-card", id: productId });
    setMessage(alreadyAdded ? "این محصول از قبل در این بخش قرار دارد؛ کارت آن برای ویرایش انتخاب شد." : "محصول به بخش اضافه شد. برای ثبت نهایی، ذخیره را بزنید.");
  }

  function reorderProduct(sectionId: string, fromId: string, toId: string) {
    if (fromId === toId) return;
    patchProductSection(sectionId, (raw) => {
      const settings = normalizeManualSettings(raw, products);
      const ids = [...settings.productIds];
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from < 0 || to < 0) return settings;
      ids.splice(from, 1);
      ids.splice(to, 0, fromId);
      return { ...settings, productIds: ids };
    });
  }

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

  function insertBanner(placement: "before" | "after") {
    const banner = newSection("banner");
    banner.title = placement === "before" ? "پیشنهاد ویژه امروز" : "فرصت خرید ویژه";
    banner.subtitle = "تصویر، متن و دکمه این بنر را همان‌جا ویرایش کنید.";
    setConfig((current) => {
      const productIndex = current.sections.findIndex((section) => section.type === "products");
      const target = productIndex < 0 ? current.sections.length : placement === "before" ? productIndex : productIndex + 1;
      const sections = [...current.sections];
      sections.splice(target, 0, banner);
      return { ...current, sections, selectedElement: { type: "banner", id: banner.id } };
    });
    setInspectorTab("context");
    setMediaTarget({ kind: "banner", sectionId: banner.id });
  }

  function addDiscountSection() {
    const section = newSection("products");
    section.title = "تخفیف‌های ویژه";
    section.subtitle = "محصولاتی که قیمت قبل از تخفیف دارند، خودکار در این بخش نمایش داده می‌شوند.";
    section.productSettings = { ...defaultProductSettings, source: "discounted", showPromotionBadge: true, showCompareAt: true };
    setConfig((current) => ({ ...current, sections: [...current.sections, section], selectedElement: { type: "section", id: section.id } }));
    setInspectorTab("context");
    setMessage("بخش محصولات تخفیفی اضافه شد.");
  }

  function applyMedia(url: string) {
    if (!mediaTarget) return;
    if (mediaTarget.kind === "hero") actions.patchHero({ imageUrl: url });
    if (mediaTarget.kind === "logo") actions.patchHeader({ logoUrl: url });
    if (mediaTarget.kind === "banner") actions.patchSection(mediaTarget.sectionId, { imageUrl: url });
    setMediaTarget(null);
    setMessage("تصویر روی بخش انتخاب‌شده قرار گرفت. برای ثبت نهایی، ذخیره را بزنید.");
  }

  async function uploadMedia(file: File) {
    if (!project || !mediaTarget) return;
    const mimeType = file.type || "image/jpeg";
    const assetType = mediaTarget.kind === "logo" ? "logo" : mediaTarget.kind === "hero" ? "hero" : "banner";
    setMediaBusy(true);
    setMessage("");
    try {
      const created = await read(await apiFetch(`/api/site-projects/${project.id}/media/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType, fileName: file.name, mimeType, sizeBytes: file.size }),
      }));
      const upload = created.upload;
      const uploaded = await fetch(upload.signedUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: file });
      if (!uploaded.ok) throw new Error("آپلود فایل در Media Library ناموفق بود");
      const completed = await read(await apiFetch(`/api/site-projects/${project.id}/media/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType, mimeType, sizeBytes: file.size, storageKey: upload.path, metadata: { name: file.name } }),
      }));
      const asset = { ...completed.media, name: completed.media?.name || file.name } as MediaAsset;
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      applyMedia(asset.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "آپلود تصویر ناموفق بود");
    } finally {
      setMediaBusy(false);
    }
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
  const previewConfig: StudioConfig = { ...config, activePage: "storefront" };
  const targetTitle = mediaTarget?.kind === "hero" ? "تصویر ویترین اصلی" : mediaTarget?.kind === "logo" ? "لوگوی فروشگاه" : "تصویر بنر";
  const pickerSection = pickerSectionId ? config.sections.find((section) => section.id === pickerSectionId) : null;
  const pickerSettings = pickerSection?.type === "products" && pickerSection.productSettings ? normalizeManualSettings(pickerSection.productSettings, products) : null;

  return (
    <main dir="rtl" className="h-screen overflow-hidden bg-[#070b12] text-white" data-studio-version="16">
      <header className="flex min-h-20 flex-wrap items-center gap-3 border-b border-emerald-400/15 bg-[#0a111b] px-4 py-3">
        <Link to="/dashboard" aria-label="بازگشت به داشبورد" className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 bg-white/5"><ArrowRight /></Link>
        <div className="min-w-52"><div className="text-[10px] font-black tracking-[.18em] text-emerald-300">TRUE VISUAL COMMERCE BUILDER</div><h1 className="text-base font-black sm:text-lg">Loadder Commerce Studio V16</h1><p className="mt-1 flex items-center gap-1 text-[10px] text-white/35"><CursorClick /> روی فروشگاه کلیک کنید و همان‌جا ویرایش کنید</p></div>
        <StudioToolbar device={device} page={config.activePage} busy={busy || !project} onDevice={setDevice} onPage={(activePage) => setConfig((current) => ({ ...current, activePage, selectedElement: { type: activePage === "storefront" ? "hero" : activePage, id: activePage === "storefront" ? "hero" : activePage } }))} onPreview={() => setPreviewOpen(true)} onSave={() => void save()} />
      </header>
      <div className="grid h-[calc(100vh-80px)] min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="order-2 min-h-0 overflow-auto bg-[#202936] p-4 sm:p-7 lg:order-1">
          <div className="sticky top-0 z-40 mx-auto mb-3 flex max-w-[1240px] flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#0d1622]/95 p-2 shadow-xl backdrop-blur">
            <button type="button" onClick={() => setMediaTarget({ kind: "hero" })} className="flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-bold hover:bg-white/10"><ImageSquare /> تصویر Hero</button>
            <button type="button" onClick={() => insertBanner("before")} className="flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-bold hover:bg-white/10"><Plus /> بنر بالای محصولات</button>
            <button type="button" onClick={() => insertBanner("after")} className="flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-bold hover:bg-white/10"><Plus /> بنر پایین محصولات</button>
            <button type="button" onClick={addDiscountSection} className="flex min-h-10 items-center gap-2 rounded-xl bg-rose-500/10 px-3 text-xs font-bold text-rose-200 hover:bg-rose-500/20"><Tag /> محصولات تخفیفی</button>
            <button type="button" onClick={() => setMediaTarget({ kind: "logo" })} className="mr-auto flex min-h-10 items-center gap-2 rounded-xl bg-emerald-400/10 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-400/20"><UploadSimple /> لوگو</button>
          </div>
          {busy && !project ? <div className="grid min-h-96 place-items-center text-white/45">در حال آماده‌سازی بوم V16…</div> : <StudioCanvas config={config} products={products} device={device} selected={config.selectedElement} select={actions.select} onAddProduct={setPickerSectionId} onReorderProduct={reorderProduct} />}
        </section>
        <div className="order-1 max-h-[48vh] min-h-0 lg:order-2 lg:max-h-none">
          <InspectorPanel {...inspectorProps} tab={inspectorTab} onTab={setInspectorTab} />
        </div>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-[100] overflow-auto bg-slate-950/95 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="پیش‌نمایش فروشگاه">
          <div className="mx-auto mb-3 flex max-w-[1240px] items-center justify-between rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">
            <div><b>پیش‌نمایش Draft فروشگاه</b><p className="mt-1 text-[10px] text-white/45">بدون Publish؛ دقیقاً از وضعیت فعلی Studio</p></div>
            <button type="button" onClick={() => setPreviewOpen(false)} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white/10" aria-label="بستن پیش‌نمایش"><X size={20} /></button>
          </div>
          <StudioCanvas config={previewConfig} products={products} device={device} selected={config.selectedElement} select={() => undefined} interactive={false} />
        </div>
      )}

      {pickerSectionId && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="انتخاب محصول">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1622] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div><h2 className="font-black">افزودن محصول به این بخش</h2><p className="mt-1 text-xs text-white/40">روی هر کالا کلیک کنید؛ همان لحظه به چیدمان این بخش اضافه می‌شود.</p></div>
              <button type="button" onClick={() => setPickerSectionId(null)} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white/5" aria-label="بستن"><X /></button>
            </div>
            <div className="grid max-h-[65vh] gap-3 overflow-auto p-4 sm:grid-cols-2">
              {products.map((product) => {
                const added = pickerSettings?.productIds.includes(product.id) ?? false;
                return <button key={product.id} type="button" onClick={() => addProductToSection(pickerSectionId, product.id)} className={`flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-right transition ${added ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/[.03] hover:border-emerald-400/50 hover:bg-emerald-400/5"}`}>
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/5 text-xs text-white/35">کالا</div>
                  <div className="min-w-0 flex-1"><b className="block truncate text-sm">{product.name}</b><span className="mt-1 block text-[10px] text-white/35">{product.brand || product.category || "محصول فروشگاه"}</span></div>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${added ? "bg-emerald-400 text-slate-950" : "bg-white/10 text-white/60"}`}>{added ? "اضافه شده" : "انتخاب"}</span>
                </button>;
              })}
              {!products.length && <div className="col-span-full py-12 text-center text-sm text-white/40">هنوز محصولی در Catalog فروشگاه وجود ندارد. ابتدا از بخش محصولات یک کالا بسازید.</div>}
            </div>
          </div>
        </div>
      )}

      {mediaTarget && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="انتخاب تصویر">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1622] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div><h2 className="font-black">{targetTitle}</h2><p className="mt-1 text-xs text-white/40">از Media Library انتخاب کنید یا همین‌جا تصویر جدید آپلود کنید.</p></div>
              <button type="button" onClick={() => setMediaTarget(null)} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white/5" aria-label="بستن"><X /></button>
            </div>
            <div className="border-b border-white/10 p-4">
              <label className={`flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-emerald-400/30 bg-emerald-400/5 px-4 text-sm font-black text-emerald-200 hover:bg-emerald-400/10 ${mediaBusy ? "pointer-events-none opacity-50" : ""}`}>
                <UploadSimple size={22} />{mediaBusy ? "در حال آپلود…" : "آپلود تصویر جدید"}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" disabled={mediaBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} />
              </label>
            </div>
            <div className="grid max-h-[58vh] grid-cols-2 gap-3 overflow-auto p-4 sm:grid-cols-3 md:grid-cols-4">
              {assets.map((asset) => <button key={asset.id} type="button" onClick={() => applyMedia(asset.url)} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.03] text-right hover:border-emerald-400/50"><div className="aspect-[4/3] overflow-hidden bg-white/5"><img src={asset.url} alt={asset.name || "تصویر"} className="h-full w-full object-cover transition group-hover:scale-105" /></div><div className="truncate p-3 text-xs text-white/65">{asset.name || "تصویر Media Library"}</div></button>)}
              {!assets.length && <div className="col-span-full py-10 text-center text-sm text-white/35">Media Library هنوز خالی است؛ از دکمه بالا اولین تصویر را آپلود کنید.</div>}
            </div>
          </div>
        </div>
      )}

      {message && <div role="status" className="fixed bottom-5 left-5 z-[140] max-w-sm rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-xs shadow-2xl">{message}</div>}
    </main>
  );
}
