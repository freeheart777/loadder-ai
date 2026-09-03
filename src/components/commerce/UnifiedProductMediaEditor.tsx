import { useEffect, useRef, useState } from "react";
import { Check, ImageSquare, Star, Trash, UploadSimple } from "@phosphor-icons/react";
import { apiFetch } from "../../lib/api";
import { productGallery } from "../../lib/productMedia";
import type { EditableMediaProduct } from "./ProductMediaEditor";

type MediaAsset = {
  id: string;
  assetType?: string;
  kind?: string;
  url: string;
  metadata?: Record<string, unknown>;
  name?: string;
};

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.code ? ` (${data.code})` : "";
    throw new Error(`${data.message || `HTTP ${response.status}`}${code}`);
  }
  return data;
}

function assetName(asset: MediaAsset) {
  const metadataName = asset.metadata?.name;
  return typeof metadataName === "string" && metadataName ? metadataName : asset.name || "تصویر محصول";
}

export default function UnifiedProductMediaEditor({
  product,
  onProduct,
}: {
  product: EditableMediaProduct;
  onProduct: (product: EditableMediaProduct) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const gallery = productGallery(product);

  async function refreshMedia() {
    const data = await read(await apiFetch(`/api/site-projects/${product.siteProjectId}/media`));
    setAssets((data.media || []).filter((asset: MediaAsset) => ["product", "gallery"].includes(asset.assetType || asset.kind || "")));
  }

  useEffect(() => {
    void refreshMedia().catch((error) => setMessage(error instanceof Error ? error.message : "Media Library باز نشد"));
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
    if (!file.type.startsWith("image/")) throw new Error("فقط فایل تصویری قابل آپلود است.");
    if (file.size > 25 * 1024 * 1024) throw new Error("حجم تصویر بیشتر از ۲۵ مگابایت است.");

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
        metadata: {
          name: file.name,
          productId: product.id,
          role: "product-gallery",
        },
      }),
    }));
    return completed.media as MediaAsset;
  }

  async function uploadFiles(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const room = Math.max(0, 12 - gallery.length);
      const selected = files.slice(0, room);
      if (!selected.length) throw new Error("حداکثر ۱۲ تصویر برای هر محصول مجاز است.");
      const uploaded: MediaAsset[] = [];
      for (const file of selected) uploaded.push(await uploadOne(file));
      const urls = uploaded.map((asset) => asset.url).filter(Boolean);
      await saveGallery([...gallery, ...urls], `${uploaded.length} تصویر با موفقیت آپلود و به محصول متصل شد.`);
      await refreshMedia();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "آپلود تصویر ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  async function addFromLibrary(asset: MediaAsset) {
    if (gallery.includes(asset.url)) return setMessage("این تصویر از قبل در گالری محصول است.");
    setBusy(true);
    try {
      await saveGallery([...gallery, asset.url], "تصویر از Media Library به محصول اضافه شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "افزودن تصویر ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  async function remove(index: number) {
    setBusy(true);
    try {
      await saveGallery(gallery.filter((_, itemIndex) => itemIndex !== index), "تصویر از محصول حذف شد؛ فایل در Media Library باقی ماند.");
    } finally {
      setBusy(false);
    }
  }

  async function setMain(index: number) {
    if (index === 0) return;
    const next = [gallery[index], ...gallery.filter((_, itemIndex) => itemIndex !== index)];
    setBusy(true);
    try { await saveGallery(next, "تصویر اصلی محصول تغییر کرد."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">تصاویر محصول</h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">Hero، Banner و تصاویر محصول اکنون از یک Media Storage مشترک استفاده می‌کنند.</p>
          </div>
          <button type="button" disabled={busy || gallery.length >= 12} onClick={() => fileInput.current?.click()} className="flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-40">
            <UploadSimple />{busy ? "در حال آپلود…" : "آپلود از دستگاه"}
          </button>
          <input ref={fileInput} hidden multiple type="file" accept="image/*" onChange={(event) => { void uploadFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
        </div>

        {gallery.length ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((image, index) => (
              <article key={`${image}-${index}`} className={`overflow-hidden rounded-2xl border bg-white ${index === 0 ? "ring-2 ring-violet-500" : ""}`}>
                <div className="relative aspect-square bg-slate-100">
                  <img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" />
                  {index === 0 && <span className="absolute right-2 top-2 rounded-full bg-violet-600 px-2 py-1 text-[10px] font-black text-white">تصویر اصلی</span>}
                </div>
                <div className="grid grid-cols-2 gap-1 p-2">
                  <button type="button" disabled={busy || index === 0} onClick={() => void setMain(index)} className="flex min-h-10 items-center justify-center gap-1 rounded-lg border disabled:opacity-30"><Star /> اصلی</button>
                  <button type="button" disabled={busy} onClick={() => void remove(index)} className="flex min-h-10 items-center justify-center gap-1 rounded-lg border text-rose-600"><Trash /> حذف</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="mt-5 grid min-h-40 w-full place-items-center rounded-2xl border-2 border-dashed text-sm text-slate-400">
            <span><ImageSquare className="mx-auto mb-2" size={32} />اولین تصویر محصول را آپلود کن</span>
          </button>
        )}
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-black">Media Library</h2>
        <p className="mt-1 text-xs text-slate-500">تصاویر ذخیره‌شده همین پروژه را بدون آپلود مجدد استفاده کن.</p>
        {assets.length ? (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {assets.map((asset) => (
              <button type="button" key={asset.id} disabled={busy || gallery.includes(asset.url)} onClick={() => void addFromLibrary(asset)} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border bg-slate-100 disabled:opacity-40">
                <img src={asset.url} alt={assetName(asset)} className="h-full w-full object-cover" />
                {gallery.includes(asset.url) && <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-lg bg-black/65 py-1 text-[9px] text-white"><Check /> استفاده شده</span>}
              </button>
            ))}
          </div>
        ) : <div className="mt-4 rounded-2xl border border-dashed p-7 text-center text-xs text-slate-400">هنوز تصویری در Media Library نیست.</div>}
      </section>

      {message && <div role="status" className="sticky bottom-3 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm text-white shadow-xl">{message}</div>}
    </div>
  );
}
