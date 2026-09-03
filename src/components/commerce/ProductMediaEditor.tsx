import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageSquare,
  LinkSimple,
  Star,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";

import { apiFetch } from "../../lib/api";
import { isSafeProductImageUrl } from "../../lib/productMedia";

type Asset = {
  id: string;
  kind?: string;
  assetType?: string;
  name?: string;
  url: string;
  altText?: string | null;
  metadata?: Record<string, unknown>;
};
type Variant = {
  id: string;
  title: string;
  sku: string;
  imageUrl?: string | null;
};
type ProductForm = {
  name: string;
  slug: string;
  description: string;
  status: string;
  category: string;
  brand: string;
  basePriceMinor: number | "";
  compareAtPriceMinor: number | "";
  featured: boolean;
};
export type EditableMediaProduct = {
  id: string;
  siteProjectId: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  currency: string;
  basePriceMinor: number;
  compareAtPriceMinor?: number | null;
  category?: string | null;
  brand?: string | null;
  featured?: boolean;
  metadata?: Record<string, unknown>;
  variants: Variant[];
};

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.code ? ` (${data.code})` : "";
    throw new Error(`${data.message || `HTTP ${response.status}`}${code}`);
  }
  return data;
}

function galleryOf(product: EditableMediaProduct) {
  return Array.isArray(product.metadata?.gallery)
    ? product.metadata.gallery.filter((value): value is string => typeof value === "string")
    : [];
}

function assetName(asset: Asset) {
  const metadataName = asset.metadata?.name;
  if (typeof metadataName === "string" && metadataName) return metadataName;
  return asset.name || "تصویر محصول";
}

export default function ProductMediaEditor({ product, onProduct }: {
  product: EditableMediaProduct;
  onProduct: (product: EditableMediaProduct) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<ProductForm>(() => ({
    name: product.name,
    slug: product.slug,
    description: product.description || "",
    status: product.status,
    category: product.category || "",
    brand: product.brand || "",
    basePriceMinor: product.basePriceMinor,
    compareAtPriceMinor: product.compareAtPriceMinor ?? "",
    featured: Boolean(product.featured),
  }));
  const gallery = galleryOf(product);

  useEffect(() => {
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      status: product.status,
      category: product.category || "",
      brand: product.brand || "",
      basePriceMinor: product.basePriceMinor,
      compareAtPriceMinor: product.compareAtPriceMinor ?? "",
      featured: Boolean(product.featured),
    });
  }, [product.id]);

  async function refreshMedia(signal?: AbortSignal) {
    const data = await read(await apiFetch(`/api/site-projects/${product.siteProjectId}/media`, { signal }));
    setAssets((data.media || []).filter((asset: Asset) =>
      ["product", "gallery"].includes(asset.assetType || asset.kind || ""),
    ));
  }

  useEffect(() => {
    const controller = new AbortController();
    void refreshMedia(controller.signal).catch((error) => {
      if (error.name !== "AbortError") setMessage(error instanceof Error ? error.message : "کتابخانه رسانه باز نشد");
    });
    return () => controller.abort();
  }, [product.siteProjectId]);

  async function patchProduct(patch: Record<string, unknown>) {
    const data = await read(await apiFetch(`/api/commerce/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }));
    onProduct(data.product);
    return data.product as EditableMediaProduct;
  }

  async function saveGallery(nextGallery: string[], success: string) {
    const unique = [...new Set(nextGallery)].slice(0, 12);
    await patchProduct({ metadata: { ...(product.metadata || {}), gallery: unique } });
    setMessage(success);
  }

  async function uploadOne(file: File) {
    if (!file.type.startsWith("image/")) throw new Error("فقط فایل تصویری قابل انتخاب است.");
    if (file.size > 25 * 1024 * 1024) throw new Error("حجم هر تصویر باید حداکثر ۲۵ مگابایت باشد.");

    setMessage(`در حال آپلود ${file.name}…`);
    const created = await read(await apiFetch(`/api/site-projects/${product.siteProjectId}/media/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType: "gallery",
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
      }),
    }));

    const upload = created.upload;
    const put = await fetch(upload.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
    });
    if (!put.ok) {
      const detail = await put.text().catch(() => "");
      throw new Error(`آپلود فایل شکست خورد: HTTP ${put.status}${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
    }

    const completed = await read(await apiFetch(`/api/site-projects/${product.siteProjectId}/media/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType: "gallery",
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
        storageKey: upload.path,
        metadata: { name: file.name, productId: product.id, role: "product-gallery" },
      }),
    }));
    return completed.media as Asset;
  }

  async function uploadFiles(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const room = Math.max(0, 12 - gallery.length);
      const selected = files.slice(0, room);
      if (!selected.length) throw new Error("حداکثر ۱۲ تصویر برای هر محصول مجاز است.");
      const uploaded: Asset[] = [];
      for (const file of selected) uploaded.push(await uploadOne(file));
      await saveGallery([...gallery, ...uploaded.map((asset) => asset.url)], `${uploaded.length} تصویر با موفقیت آپلود و به محصول متصل شد.`);
      await refreshMedia();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "آپلود تصویر ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  async function addUrl() {
    const clean = url.trim();
    if (!isSafeProductImageUrl(clean)) return setMessage("آدرس تصویر باید HTTPS معتبر باشد.");
    setBusy(true);
    try {
      await saveGallery([...gallery, clean], "تصویر URL به گالری اضافه شد.");
      setUrl("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "افزودن URL ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  async function addFromLibrary(asset: Asset) {
    if (gallery.includes(asset.url)) return setMessage("این تصویر از قبل در گالری است.");
    setBusy(true);
    try { await saveGallery([...gallery, asset.url], "تصویر Media Library به گالری اضافه شد."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "افزودن تصویر ناموفق بود"); }
    finally { setBusy(false); }
  }

  async function updateVariantImage(variantId: string, imageUrl: string | null) {
    setBusy(true);
    try {
      const data = await read(await apiFetch(`/api/commerce/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      }));
      onProduct({ ...product, variants: product.variants.map((variant) => variant.id === variantId ? data.variant : variant) });
      setMessage("تصویر اختصاصی تنوع ذخیره شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تصویر تنوع ذخیره نشد");
    } finally { setBusy(false); }
  }

  async function saveDetails() {
    setBusy(true);
    try {
      await patchProduct({
        ...form,
        compareAtPriceMinor: form.compareAtPriceMinor === "" ? null : Number(form.compareAtPriceMinor),
      });
      setMessage("اطلاعات محصول ذخیره شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ویرایش محصول ذخیره نشد");
    } finally { setBusy(false); }
  }

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= gallery.length) return;
    const next = [...gallery];
    [next[index], next[target]] = [next[target], next[index]];
    void saveGallery(next, "ترتیب گالری ذخیره شد.");
  };
  const setMain = (index: number) => {
    if (index === 0) return;
    void saveGallery([gallery[index], ...gallery.filter((_, itemIndex) => itemIndex !== index)], "تصویر اصلی تغییر کرد.");
  };
  const remove = (index: number) => void saveGallery(
    gallery.filter((_, itemIndex) => itemIndex !== index),
    "تصویر از این محصول حذف شد؛ فایل در Media Library باقی ماند.",
  );

  return <div className="space-y-6">
    <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black">تصاویر محصول</h2><p className="mt-1 text-xs leading-6 text-slate-500">تصویر اول، تصویر اصلی کارت محصول است. حذف از گالری فایل Media Library را پاک نمی‌کند.</p></div>
        <button type="button" disabled={busy || gallery.length >= 12} onClick={() => fileInput.current?.click()} className="flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-40"><UploadSimple />{busy ? "در حال آپلود…" : "آپلود از دستگاه"}</button>
        <input ref={fileInput} hidden multiple type="file" accept="image/*" onChange={(event) => { void uploadFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border px-3"><LinkSimple className="shrink-0 text-slate-400" /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://… گزینه ثانویه افزودن تصویر" className="min-w-0 flex-1 outline-none" dir="ltr" /></label>
        <button type="button" disabled={busy || !url.trim()} onClick={() => void addUrl()} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-40">افزودن از URL</button>
      </div>
      {gallery.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{gallery.map((image, index) => <article key={`${image}-${index}`} className={`overflow-hidden rounded-2xl border bg-white ${index === 0 ? "ring-2 ring-violet-500" : ""}`}><div className="relative aspect-square bg-slate-100"><img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <span className="absolute right-2 top-2 rounded-full bg-violet-600 px-2 py-1 text-[10px] font-black text-white">تصویر اصلی</span>}</div><div className="grid grid-cols-4 gap-1 p-2"><button type="button" disabled={index === 0 || busy} onClick={() => setMain(index)} aria-label="تنظیم به‌عنوان تصویر اصلی" className="grid min-h-10 place-items-center rounded-lg border disabled:opacity-30"><Star /></button><button type="button" disabled={index === 0 || busy} onClick={() => move(index, -1)} aria-label="انتقال تصویر به قبل" className="grid min-h-10 place-items-center rounded-lg border disabled:opacity-30"><ArrowRight /></button><button type="button" disabled={index === gallery.length - 1 || busy} onClick={() => move(index, 1)} aria-label="انتقال تصویر به بعد" className="grid min-h-10 place-items-center rounded-lg border disabled:opacity-30"><ArrowLeft /></button><button type="button" disabled={busy} onClick={() => remove(index)} aria-label="حذف تصویر از محصول" className="grid min-h-10 place-items-center rounded-lg border text-rose-600"><Trash /></button></div></article>)}</div> : <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="mt-5 grid min-h-40 w-full place-items-center rounded-2xl border-2 border-dashed text-sm text-slate-400"><span><ImageSquare className="mx-auto mb-2" size={32} />اولین تصویر محصول را اضافه کن</span></button>}
    </section>

    <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-black">Media Library موجود</h2><p className="mt-1 text-xs text-slate-500">بدون آپلود دوباره، یکی از تصاویر همین پروژه را استفاده کن.</p>
      {assets.length ? <div className="mt-4 flex gap-3 overflow-x-auto pb-2">{assets.map((asset) => <button type="button" key={asset.id} disabled={busy || gallery.includes(asset.url)} onClick={() => void addFromLibrary(asset)} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border bg-slate-100 disabled:opacity-40"><img src={asset.url} alt={asset.altText || assetName(asset)} className="h-full w-full object-cover" />{gallery.includes(asset.url) && <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-lg bg-black/65 py-1 text-[9px] text-white"><Check /> استفاده شده</span>}</button>)}</div> : <div className="mt-4 rounded-2xl border border-dashed p-7 text-center text-xs text-slate-400">هنوز تصویر قابل استفاده‌ای در Media Library این پروژه نیست.</div>}
    </section>

    <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-black">تصویر اختصاصی تنوع‌ها</h2><div className="mt-4 space-y-3">{product.variants.map((variant) => <label key={variant.id} className="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_240px] sm:items-center"><span><b className="block text-sm">{variant.title}</b><small className="text-slate-400">SKU: {variant.sku}</small></span><select disabled={busy} value={variant.imageUrl || ""} onChange={(event) => void updateVariantImage(variant.id, event.target.value || null)} className="min-h-11 rounded-xl border bg-white px-3 text-sm"><option value="">استفاده از تصویر اصلی</option>{[...new Set([...gallery, ...assets.map((asset) => asset.url)])].map((image, index) => <option key={image} value={image}>تصویر {index + 1}</option>)}</select></label>)}</div>
    </section>

    <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-black">ویرایش اطلاعات محصول</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="نام محصول" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
        <Field label="Slug" value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} dir="ltr" />
        <Field label="دسته‌بندی" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
        <Field label="برند" value={form.brand} onChange={(value) => setForm({ ...form, brand: value })} />
        <NumberField label="قیمت پایه (minor unit)" value={form.basePriceMinor} onChange={(value) => setForm({ ...form, basePriceMinor: value })} />
        <NumberField label="قیمت مقایسه‌ای" value={form.compareAtPriceMinor} onChange={(value) => setForm({ ...form, compareAtPriceMinor: value })} />
        <label className="text-sm text-slate-600">وضعیت<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border px-3"><option value="DRAFT">پیش‌نویس</option><option value="ACTIVE">فعال</option><option value="ARCHIVED">آرشیو</option></select></label>
        <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border px-3 text-sm"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} />محصول ویژه</label>
      </div>
      <label className="mt-4 block text-sm text-slate-600">توضیحات<textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-2 w-full rounded-xl border p-3 leading-7" /></label>
      <button type="button" disabled={busy || !form.name.trim() || !form.slug.trim()} onClick={() => void saveDetails()} className="mt-4 min-h-11 w-full rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40 sm:w-auto">ذخیره تغییرات محصول</button>
    </section>
    {message && <div role="status" className="sticky bottom-3 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm text-white shadow-xl">{message}</div>}
  </div>;
}

function Field({ label, value, onChange, dir }: { label: string; value: string; onChange: (value: string) => void; dir?: "ltr" }) {
  return <label className="text-sm text-slate-600">{label}<input dir={dir} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label>;
}
function NumberField({ label, value, onChange }: { label: string; value: number | ""; onChange: (value: number | "") => void }) {
  return <label className="text-sm text-slate-600">{label}<input type="number" min="0" step="1" value={value} onChange={(event) => onChange(event.target.value === "" ? "" : Math.max(0, Number(event.target.value) || 0))} className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label>;
}
