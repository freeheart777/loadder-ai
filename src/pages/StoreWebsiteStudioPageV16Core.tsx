import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CaretLeft, CaretRight, CursorClick, Plus, Tag, X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import InspectorPanel from "../components/store-studio-v16/InspectorPanel";
import StudioCanvas from "../components/store-studio-v16/StudioCanvas";
import type { InlineMediaTarget } from "../components/store-studio-v16/StudioCanvas";
import StudioToolbar from "../components/store-studio-v16/StudioToolbar";
import { defaultProductSettings, designDefaults, productsForSection, restoreConfig } from "../components/store-studio-v16/config";
import type { DeviceMode, MediaAsset, Product, ProductSettings, SectionConfig, Selection, StudioActions, StudioConfig } from "../components/store-studio-v16/types";
import { apiFetch } from "../lib/api";
import { uploadSiteMedia } from "../lib/siteMediaUpload";

type Project = { id: string; name?: string; content: Record<string, any> };
type ProductDraft = {
  name: string;
  basePriceMinor: string;
  compareAtPriceMinor: string;
  inventoryQuantity: string;
  category: string;
  brand: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  geoDescription: string;
  imageUrl: string;
};

const emptyProductDraft: ProductDraft = {
  name: "",
  basePriceMinor: "",
  compareAtPriceMinor: "",
  inventoryQuantity: "0",
  category: "",
  brand: "",
  description: "",
  seoTitle: "",
  seoDescription: "",
  geoDescription: "",
  imageUrl: "",
};

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.code ? ` (${data.code})` : "";
    throw new Error(`${data.message || "عملیات Studio ناموفق بود"}${code}`);
  }
  return data;
}

function localizedInteger(value: string, label: string) {
  const normalized = value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s,_٬،]/g, "");
  const parsed = Number(normalized);
  if (!normalized || !Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} باید یک عدد صحیح و نامنفی باشد.`);
  return parsed;
}

function toMinorUnits(amount: number, label: string) {
  const minor = amount * 100;
  if (!Number.isSafeInteger(minor)) throw new Error(`${label} از محدوده مجاز بزرگ‌تر است.`);
  return minor;
}

function withProductInSection(current: StudioConfig, sectionId: string, productId: string, availableProducts: Product[]) {
  return {
    ...current,
    sections: current.sections.map((section) => {
      if (section.id !== sectionId || section.type !== "products" || !section.productSettings) return section;
      const settings = normalizeManual(section.productSettings, availableProducts);
      return {
        ...section,
        productSettings: settings.productIds.includes(productId)
          ? settings
          : { ...settings, productIds: [productId, ...settings.productIds].slice(0, 12) },
      };
    }),
  };
}

function newSection(type: SectionConfig["type"]): SectionConfig {
  const labels = { products: "محصولات جدید", banner: "بنر جدید", trust: "مزیت‌های خرید", text: "متن جدید", spacer: "فاصله" };
  return {
    id: `${type}-${crypto.randomUUID()}`,
    type,
    enabled: true,
    title: labels[type],
    subtitle: type === "spacer" ? "" : "برای ویرایش این بخش روی آن کلیک کنید.",
    backgroundColor: type === "banner" ? designDefaults.primaryColor : designDefaults.surfaceColor,
    textColor: type === "banner" ? "#fff" : designDefaults.textColor,
    spacingTop: type === "spacer" ? 32 : designDefaults.sectionSpacing,
    spacingBottom: type === "spacer" ? 32 : designDefaults.sectionSpacing,
    ...(type === "products" ? { productSettings: { ...defaultProductSettings } } : {}),
  };
}

function normalizeManual(settings: ProductSettings, products: Product[]) {
  if (settings.source === "manual") return { ...settings, productIds: [...settings.productIds] };
  return { ...settings, source: "manual" as const, productIds: productsForSection(products, settings).slice(0, 12).map((p) => p.id) };
}

function applyMediaToConfig(current: StudioConfig, target: InlineMediaTarget, url: string): StudioConfig {
  if (target.kind === "hero") return { ...current, hero: { ...current.hero, imageUrl: url } };
  if (target.kind === "logo") return { ...current, header: { ...current.header, logoUrl: url } };
  if (target.kind === "banner" && target.id) return { ...current, sections: current.sections.map((section) => section.id === target.id ? { ...section, imageUrl: url } : section) };
  if (target.kind === "product" && target.id) return {
    ...current,
    commerce: {
      ...current.commerce,
      productOverrides: {
        ...current.commerce.productOverrides,
        [target.id]: { ...(current.commerce.productOverrides[target.id] || {}), imageUrl: url },
      },
    },
  };
  return current;
}

export default function StoreWebsiteStudioPageV16() {
  const [project, setProject] = useState<Project | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [config, setConfig] = useState<StudioConfig>(() => restoreConfig({}));
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [tab, setTab] = useState<"context" | "sections" | "design">("context");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [productBusy, setProductBusy] = useState(false);
  const [productImageBusy, setProductImageBusy] = useState(false);
  const [productError, setProductError] = useState("");
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft);
  const productSubmitLock = useRef(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const listing = await read(await apiFetch("/api/site-projects", { signal: c.signal }));
        const selected = (listing.projects || []).find((i: any) => String(i.siteType).toUpperCase() === "STORE") || listing.projects?.[0];
        if (!selected) throw new Error("پروژه فروشگاهی پیدا نشد");
        const detail = await read(await apiFetch(`/api/site-projects/${selected.id}`, { signal: c.signal }));
        const loaded = detail.project as Project;
        setProject(loaded);
        setConfig(restoreConfig(loaded.content || {}));
        setAssets((detail.assets || []).filter((a: MediaAsset) => typeof a.url === "string"));
        const catalog = await read(await apiFetch(`/api/stores/${selected.id}/products`, { signal: c.signal }));
        setProducts(catalog.products || []);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setMessage(e instanceof Error ? e.message : "بارگذاری Studio ناموفق بود");
      } finally {
        if (!c.signal.aborted) setBusy(false);
      }
    })();
    return () => c.abort();
  }, []);

  const actions = useMemo<StudioActions>(() => ({
    select: (selectedElement) => {
      setConfig((cur) => ({ ...cur, selectedElement }));
      setTab("context");
      setInspectorOpen(true);
    },
    patchDesign: (p) => setConfig((c) => ({ ...c, design: { ...c.design, ...p } })),
    patchHeader: (p) => setConfig((c) => ({ ...c, header: { ...c.header, ...p } })),
    patchHero: (p) => setConfig((c) => ({ ...c, hero: { ...c.hero, ...p } })),
    patchSection: (id, p) => setConfig((c) => ({ ...c, sections: c.sections.map((s) => s.id === id ? { ...s, ...p } : s) })),
    patchProduct: (id, p) => setConfig((c) => ({ ...c, commerce: { ...c.commerce, productOverrides: { ...c.commerce.productOverrides, [id]: { ...(c.commerce.productOverrides[id] || {}), ...p } } } })),
    patchCommerce: (p) => setConfig((c) => ({ ...c, commerce: { ...c.commerce, ...p } })),
  }), []);

  function selectCanvasElement(selectedElement: Selection) {
    setConfig((cur) => ({ ...cur, selectedElement }));
  }

  function patchProductSection(sectionId: string, updater: (s: ProductSettings) => ProductSettings) {
    setConfig((c) => ({ ...c, sections: c.sections.map((s) => s.id === sectionId && s.type === "products" && s.productSettings ? { ...s, productSettings: updater(s.productSettings) } : s) }));
  }

  function addProduct(sectionId: string, productId: string) {
    patchProductSection(sectionId, (raw) => {
      const s = normalizeManual(raw, products);
      return s.productIds.includes(productId) ? s : { ...s, productIds: [...s.productIds, productId].slice(0, 12) };
    });
    setPickerSectionId(null);
    setCreateProductOpen(false);
    selectCanvasElement({ type: "product-card", id: productId });
    setMessage("محصول به بخش اضافه شد.");
  }

  async function createProductInCatalog() {
    if (!project || !pickerSectionId || productBusy || productSubmitLock.current) return;
    setProductError("");
    const name = productDraft.name.trim();
    if (!name) {
      setProductError("نام محصول را وارد کنید.");
      return;
    }
    let basePriceMinor: number;
    let inventoryQuantity: number;
    let compareAtPriceMinor: number | null;
    try {
      basePriceMinor = toMinorUnits(localizedInteger(productDraft.basePriceMinor, "قیمت محصول"), "قیمت محصول");
      inventoryQuantity = localizedInteger(productDraft.inventoryQuantity || "0", "موجودی محصول");
      compareAtPriceMinor = productDraft.compareAtPriceMinor.trim() === "" ? null : toMinorUnits(localizedInteger(productDraft.compareAtPriceMinor, "قیمت قبل از تخفیف"), "قیمت قبل از تخفیف");
    } catch (error) {
      setProductError(error instanceof Error ? error.message : "اطلاعات عددی محصول معتبر نیست.");
      return;
    }

    productSubmitLock.current = true;
    setProductBusy(true);
    const sectionId = pickerSectionId;
    try {
      const payload = {
        name,
        basePriceMinor,
        compareAtPriceMinor,
        inventoryQuantity,
        currency: config.commerce.currency,
        status: "ACTIVE",
        category: productDraft.category.trim() || null,
        brand: productDraft.brand.trim() || null,
        description: productDraft.description.trim(),
        seoTitle: productDraft.seoTitle.trim() || null,
        seoDescription: productDraft.seoDescription.trim() || null,
        imageUrl: productDraft.imageUrl.trim() || null,
        metadata: {
          geoDescription: productDraft.geoDescription.trim(),
          contentMode: productDraft.geoDescription.trim() && (productDraft.seoTitle.trim() || productDraft.seoDescription.trim()) ? "HYBRID" : productDraft.geoDescription.trim() ? "GEO" : "SEO",
        },
      };
      const out = await read(await apiFetch(`/api/stores/${project.id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      const product = out.product as Product;
      let nextProducts = [product, ...products.filter((p) => p.id !== product.id)];
      let refreshWarning = "";
      try {
        const refreshed = await read(await apiFetch(`/api/stores/${project.id}/products`));
        const authoritativeProducts = (refreshed.products || []) as Product[];
        if (!authoritativeProducts.some((item) => item.id === product.id)) throw new Error("محصول تازه در بازخوانی کاتالوگ پیدا نشد.");
        nextProducts = authoritativeProducts;
      } catch (error) {
        refreshWarning = error instanceof Error ? error.message : "بازخوانی کاتالوگ ناموفق بود.";
      }
      const nextConfig = withProductInSection(config, sectionId, product.id, nextProducts);
      setProducts(nextProducts);
      setConfig(nextConfig);
      let configWarning = "";
      try {
        await persistConfig(nextConfig);
      } catch (error) {
        configWarning = error instanceof Error ? error.message : "ذخیره چیدمان فروشگاه ناموفق بود.";
      }
      selectCanvasElement({ type: "product-card", id: product.id });
      setProductDraft(emptyProductDraft);
      setProductError("");
      setCreateProductOpen(false);
      setPickerSectionId(null);
      const warning = [refreshWarning, configWarning].filter(Boolean).join(" ");
      setMessage(warning ? `محصول ذخیره شد؛ اما همگام‌سازی کامل نشد: ${warning}` : "محصول ساخته، ذخیره و روی فروشگاه قرار گرفت.");
    } catch (e) {
      const error = e instanceof Error ? e.message : "ساخت محصول ناموفق بود.";
      setProductError(error);
      setMessage(error);
    } finally {
      productSubmitLock.current = false;
      setProductBusy(false);
    }
  }

  async function uploadProductDraftImage(file: File) {
    if (!project || productImageBusy || productBusy) return;
    setProductImageBusy(true);
    setProductError("");
    try {
      const uploaded = await uploadSiteMedia({
        siteProjectId: project.id,
        file,
        assetType: "product",
        metadata: { target: { kind: "product-draft" } },
      });
      if (!uploaded.url) throw new Error("فایل ذخیره شد اما URL نهایی تصویر دریافت نشد.");
      setAssets((current) => [{ ...uploaded, name: file.name } as MediaAsset, ...current.filter((item) => item.id !== uploaded.id)]);
      setProductDraft((current) => ({ ...current, imageUrl: uploaded.url }));
      setMessage("تصویر محصول در Media Library ذخیره و به فرم متصل شد.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "آپلود تصویر محصول ناموفق بود.";
      setProductError(message);
      setMessage(message);
    } finally {
      setProductImageBusy(false);
    }
  }

  function reorderProduct(sectionId: string, fromId: string, toId: string) {
    if (fromId === toId) return;
    patchProductSection(sectionId, (raw) => {
      const s = normalizeManual(raw, products), ids = [...s.productIds], from = ids.indexOf(fromId), to = ids.indexOf(toId);
      if (from < 0 || to < 0) return s;
      ids.splice(from, 1);
      ids.splice(to, 0, fromId);
      return { ...s, productIds: ids };
    });
  }

  function moveSection(id: string, delta: number) {
    setConfig((c) => {
      const i = c.sections.findIndex((s) => s.id === id), t = i + delta;
      if (i < 0 || t < 0 || t >= c.sections.length) return c;
      const sections = [...c.sections];
      [sections[i], sections[t]] = [sections[t], sections[i]];
      return { ...c, sections };
    });
  }

  function reorderSection(fromId: string, toId: string) {
    if (fromId === toId) return;
    setConfig((c) => {
      const sections = [...c.sections], from = sections.findIndex((s) => s.id === fromId), to = sections.findIndex((s) => s.id === toId);
      if (from < 0 || to < 0) return c;
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...c, sections, selectedElement: { type: moved.type === "banner" ? "banner" : moved.type === "trust" ? "trust" : "section", id: moved.id } };
    });
  }

  function insertSection(index: number, type: SectionConfig["type"]) {
    const section = newSection(type);
    setConfig((c) => {
      const sections = [...c.sections];
      sections.splice(Math.min(index, sections.length), 0, section);
      return { ...c, sections, selectedElement: { type: type === "banner" ? "banner" : type === "trust" ? "trust" : "section", id: section.id } };
    });
    setTab("context");
    if (type === "products") setMessage("بخش محصولات اضافه شد؛ از + داخل آن محصول انتخاب کنید.");
    if (type === "banner") setMessage("بنر اضافه شد؛ روی خود تصویر بنر کلیک کنید و عکس را انتخاب کنید.");
  }

  function addSection(type: SectionConfig["type"]) { insertSection(config.sections.length, type); }

  function duplicateSection(id: string) {
    setConfig((c) => {
      const i = c.sections.findIndex((s) => s.id === id);
      if (i < 0) return c;
      const src = c.sections[i];
      const copy = { ...src, id: `${src.type}-${crypto.randomUUID()}`, title: `${src.title} (کپی)`, productSettings: src.productSettings ? { ...src.productSettings, productIds: [...src.productSettings.productIds] } : undefined };
      const sections = [...c.sections];
      sections.splice(i + 1, 0, copy);
      const type = copy.type === "banner" ? "banner" : copy.type === "trust" ? "trust" : "section";
      return { ...c, sections, selectedElement: { type, id: copy.id } };
    });
    setMessage("بخش کپی شد.");
  }

  function deleteSection(id: string) {
    setConfig((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== id), selectedElement: { type: "hero", id: "hero" } }));
    setInspectorOpen(false);
    setMessage("بخش حذف شد.");
  }

  function addDiscountSection() {
    const section = newSection("products");
    section.title = "تخفیف‌های ویژه";
    section.productSettings = { ...defaultProductSettings, source: "discounted", showPromotionBadge: true, showCompareAt: true };
    setConfig((c) => ({ ...c, sections: [...c.sections, section], selectedElement: { type: "section", id: section.id } }));
  }

  async function persistConfig(nextConfig: StudioConfig) {
    if (!project) throw new Error("پروژه فروشگاه آماده نیست.");
    const storeBuilderV16: StudioConfig = { ...nextConfig, version: 16 };
    const content = { ...project.content, storeBuilderV16 };
    const out = await read(await apiFetch(`/api/site-projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }));
    setProject(out.project);
  }

  async function uploadMedia(target: InlineMediaTarget, file: File) {
    if (!project || mediaBusy) {
      if (!project) setMessage("پروژه فروشگاه آماده نیست؛ آپلود متوقف شد.");
      return;
    }
    if ((target.kind === "banner" || target.kind === "product") && !target.id) {
      setMessage("هدف تصویر مشخص نیست؛ آپلود متوقف شد.");
      return;
    }
    setMediaBusy(true);
    setMessage("در حال آپلود و اعمال تصویر…");
    try {
      const uploaded = await uploadSiteMedia({
        siteProjectId: project.id,
        file,
        assetType: target.kind,
        metadata: { target },
      });
      const asset = { ...uploaded, name: file.name } as MediaAsset;
      if (!asset.url) throw new Error("فایل ذخیره شد اما URL تصویر دریافت نشد.");
      const nextConfig = applyMediaToConfig(config, target, asset.url);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setConfig(nextConfig);
      await persistConfig(nextConfig);
      setMessage("تصویر آپلود، اعمال و ذخیره شد.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "آپلود ناموفق بود");
    } finally {
      setMediaBusy(false);
    }
  }

  async function save() {
    if (!project) return;
    setBusy(true);
    try {
      await persistConfig(config);
      setMessage("طراحی ذخیره شد.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  const inspectorProps = { config, products, assets, actions, moveSection, duplicateSection, deleteSection, addSection };
  const pickerSection = pickerSectionId ? config.sections.find((s) => s.id === pickerSectionId) : null;
  const pickerSettings = pickerSection?.type === "products" && pickerSection.productSettings ? normalizeManual(pickerSection.productSettings, products) : null;

  return <main dir="rtl" className="h-screen overflow-hidden bg-[#070b12] text-white" data-studio-version="16">
    <header className="flex min-h-20 items-center gap-3 border-b border-white/10 bg-[#0a111b] px-4 py-3">
      <Link to="/dashboard" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10"><ArrowRight /></Link>
      <div className="min-w-56"><div className="text-[10px] font-black tracking-[.18em] text-emerald-300">LOADDER VISUAL STUDIO</div><h1 className="font-black">فروشگاه شما</h1><p className="mt-1 flex items-center gap-1 text-[10px] text-white/35"><CursorClick /> روی خود تصویر کلیک کنید تا همان‌جا تعویض شود</p></div>
      <StudioToolbar device={device} page={config.activePage} busy={busy || !project || mediaBusy} onDevice={setDevice} onPage={(activePage) => setConfig((c) => ({ ...c, activePage, selectedElement: { type: activePage === "storefront" ? "hero" : activePage, id: activePage === "storefront" ? "hero" : activePage } }))} onPreview={() => setPreviewOpen(true)} onSave={() => void save()} />
    </header>

    <div className={`relative grid h-[calc(100vh-80px)] grid-cols-1 transition-[grid-template-columns] duration-200 ${inspectorOpen ? "lg:grid-cols-[minmax(0,1fr)_300px]" : "lg:grid-cols-[minmax(0,1fr)_0px]"}`}>
      <section className="order-2 min-h-0 overflow-auto bg-[#dfe5ec] p-3 lg:order-1 lg:p-5">
        <div className="sticky top-2 z-40 mx-auto mb-3 flex w-fit max-w-full items-center gap-1 rounded-2xl border border-white/15 bg-[#111827]/92 p-1.5 shadow-xl backdrop-blur">
          <span className="px-3 py-2 text-[10px] font-bold text-emerald-200">عکس‌ها: مستقیم روی خود تصویر</span>
          <button onClick={() => insertSection(0, "banner")} className="rounded-xl px-3 py-2 text-[11px] font-bold hover:bg-white/10"><Plus size={16} /> بنر</button>
          <button onClick={addDiscountSection} className="rounded-xl px-3 py-2 text-[11px] font-bold text-rose-200 hover:bg-rose-500/10"><Tag size={16} /> تخفیف‌ها</button>
        </div>
        {busy && !project ? <div className="grid min-h-96 place-items-center text-slate-500">در حال آماده‌سازی…</div> : <StudioCanvas config={config} products={products} device={device} selected={config.selectedElement} select={selectCanvasElement} onEditElement={actions.select} onAddProduct={setPickerSectionId} onReorderProduct={reorderProduct} onInsertSection={insertSection} onReorderSection={reorderSection} onMoveSection={moveSection} onDuplicateSection={duplicateSection} onDeleteSection={deleteSection} onImageUpload={uploadMedia} imageBusy={mediaBusy} />}
      </section>

      <aside className={`order-1 min-h-0 overflow-hidden border-r border-white/10 bg-[#0a111b] transition-all lg:order-2 ${inspectorOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div className="border-b border-white/10 px-4 py-3"><b className="text-xs">تنظیمات دقیق</b><p className="mt-1 text-[10px] text-white/35">برای کارهای معمول از ابزار روی خود سایت استفاده کنید.</p></div>
        <InspectorPanel {...inspectorProps} tab={tab} onTab={setTab} />
      </aside>

      <button type="button" onClick={() => setInspectorOpen((v) => !v)} aria-label={inspectorOpen ? "بستن پنل ویرایش" : "باز کردن پنل ویرایش"} className="absolute left-3 top-3 z-50 hidden h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-700 shadow-lg lg:flex">
        {inspectorOpen ? <CaretLeft size={15} /> : <CaretRight size={15} />}{inspectorOpen ? "بستن تنظیمات" : "تنظیمات دقیق"}
      </button>
    </div>

    {previewOpen && <div className="fixed inset-0 z-[100] overflow-auto bg-slate-950/95 p-5"><div className="mx-auto mb-3 flex max-w-[1240px] items-center justify-between"><b>پیش‌نمایش Draft</b><button onClick={() => setPreviewOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><X /></button></div><StudioCanvas config={{ ...config, activePage: "storefront" }} products={products} device={device} selected={config.selectedElement} select={() => undefined} interactive={false} /></div>}

    {pickerSectionId && <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/75 p-4">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-[#0d1622] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div><h2 className="font-black">{createProductOpen ? "ساخت محصول جدید" : "افزودن محصول"}</h2><p className="text-xs text-white/40">{createProductOpen ? "اطلاعات پایه را وارد کنید؛ محصول همان لحظه روی فروشگاه می‌آید." : "از کاتالوگ انتخاب کنید یا همین‌جا محصول جدید بسازید."}</p></div>
          <button onClick={() => { setPickerSectionId(null); setCreateProductOpen(false); }}><X /></button>
        </div>

        {!createProductOpen ? <>
          <div className="border-b border-white/10 p-4">
            <button type="button" onClick={() => setCreateProductOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-400/15"><Plus size={18} /> ساخت محصول جدید</button>
          </div>
          <div className="grid max-h-[60vh] gap-3 overflow-auto p-4 sm:grid-cols-2">
            {products.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">هنوز محصولی ندارید. «ساخت محصول جدید» را بزنید.</div>}
            {products.map((p) => {
              const added = pickerSettings?.productIds.includes(p.id) ?? false;
              return <button key={p.id} onClick={() => addProduct(pickerSectionId, p.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-right ${added ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/[.03]"}`}>
                <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/5">{p.variants?.[0]?.imageUrl ? <img src={p.variants[0].imageUrl} alt="" className="h-full w-full object-cover" /> : null}</div>
                <div className="flex-1"><b>{p.name}</b><span className="block text-[10px] text-white/35">{p.brand || p.category || "محصول"}</span></div>
                <span className="text-[10px]">{added ? "اضافه شده" : "انتخاب"}</span>
              </button>;
            })}
          </div>
        </> : <form data-product-create-form="true" className="grid max-h-[72vh] gap-4 overflow-auto p-4 sm:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); void createProductInCatalog(); }}>
          {productError && <div role="alert" aria-live="assertive" data-product-form-error="true" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm leading-6 text-rose-100 sm:col-span-2">{productError}</div>}
          <label className="grid gap-1 text-xs font-bold">نام محصول<input value={productDraft.name} onChange={(e) => setProductDraft((d) => ({ ...d, name: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" placeholder="مثلاً سرم آبرسان" /></label>
          <label className="grid gap-1 text-xs font-bold">قیمت ({config.commerce.currency === "IRT" ? "تومان" : config.commerce.currency})<input inputMode="numeric" value={productDraft.basePriceMinor} onChange={(e) => setProductDraft((d) => ({ ...d, basePriceMinor: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" placeholder="مثلاً 450000" /></label>
          <label className="grid gap-1 text-xs font-bold">قیمت قبل از تخفیف<input inputMode="numeric" value={productDraft.compareAtPriceMinor} onChange={(e) => setProductDraft((d) => ({ ...d, compareAtPriceMinor: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" placeholder="اختیاری" /></label>
          <label className="grid gap-1 text-xs font-bold">موجودی<input inputMode="numeric" value={productDraft.inventoryQuantity} onChange={(e) => setProductDraft((d) => ({ ...d, inventoryQuantity: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" /></label>
          <label className="grid gap-1 text-xs font-bold">دسته‌بندی<input value={productDraft.category} onChange={(e) => setProductDraft((d) => ({ ...d, category: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" /></label>
          <label className="grid gap-1 text-xs font-bold">برند<input value={productDraft.brand} onChange={(e) => setProductDraft((d) => ({ ...d, brand: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" /></label>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 sm:col-span-2" data-product-image-input="true">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-white/10 px-4 py-2.5 text-xs font-black hover:bg-white/15 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={productImageBusy || productBusy}>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" disabled={productImageBusy || productBusy} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadProductDraftImage(file); }} />
                {productImageBusy ? "در حال آپلود تصویر…" : "آپلود تصویر از دستگاه"}
              </label>
              <span className="text-[10px] leading-5 text-white/40">فایل با یک درخواست مستقیم ذخیره می‌شود و فقط URL نهایی آن در محصول ثبت خواهد شد.</span>
            </div>
            <label className="grid gap-1 text-xs font-bold">یا آدرس تصویر
              <input value={productDraft.imageUrl} onChange={(e) => setProductDraft((d) => ({ ...d, imageUrl: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" placeholder="https://..." />
            </label>
            {productDraft.imageUrl && <div className="flex items-center gap-3 rounded-xl border border-white/10 p-2"><img src={productDraft.imageUrl} alt="پیش‌نمایش تصویر محصول" className="h-16 w-16 rounded-lg object-cover" /><span className="min-w-0 break-all text-[10px] text-emerald-200">URL نهایی آمادهٔ ذخیره است</span></div>}
          </div>
          <label className="grid gap-1 text-xs font-bold sm:col-span-2">توضیحات محصول<textarea value={productDraft.description} onChange={(e) => setProductDraft((d) => ({ ...d, description: e.target.value }))} className="min-h-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" /></label>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3 sm:col-span-2">
            <div className="mb-3"><b className="text-sm">SEO + GEO</b><p className="mt-1 text-[10px] text-white/40">می‌توانید فقط SEO، فقط GEO یا هر دو را با هم وارد کنید.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold">عنوان SEO<input value={productDraft.seoTitle} onChange={(e) => setProductDraft((d) => ({ ...d, seoTitle: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" /></label>
              <label className="grid gap-1 text-xs font-bold">توضیح SEO<input value={productDraft.seoDescription} onChange={(e) => setProductDraft((d) => ({ ...d, seoDescription: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" /></label>
              <label className="grid gap-1 text-xs font-bold sm:col-span-2">توضیح GEO برای موتورهای AI<textarea value={productDraft.geoDescription} onChange={(e) => setProductDraft((d) => ({ ...d, geoDescription: e.target.value }))} className="min-h-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-emerald-400/50" placeholder="محصول برای چه کسی مناسب است، چه مسئله‌ای را حل می‌کند و مزیت اصلی آن چیست؟" /></label>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row" data-product-form-actions="mobile-safe">
            <button type="button" disabled={productBusy || productImageBusy} onClick={() => { setProductError(""); setCreateProductOpen(false); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold disabled:opacity-50">بازگشت به کاتالوگ</button>
            <button type="submit" data-product-submit="true" disabled={productBusy || productImageBusy} aria-busy={productBusy} className="flex-1 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{productBusy ? "در حال ساخت…" : "ساخت و افزودن به فروشگاه"}</button>
          </div>
        </form>}
      </div>
    </div>}

    {message && <div className="fixed bottom-5 left-5 z-[140] rounded-xl bg-slate-950 px-4 py-3 text-xs shadow-2xl">{message}</div>}
  </main>;
}
