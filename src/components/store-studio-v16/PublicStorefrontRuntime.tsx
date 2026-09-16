import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { restoreConfig } from "./config";
import StudioCanvas from "./StudioCanvas";
import type { DeviceMode, Product, Selection } from "./types";
import { addPublicCartItem, cartCapabilityHeaders, readPublicCartReference } from "../../lib/publicCart";
import { apiFetch } from "../../lib/api";

type StorefrontMeta = { store: { id: string; name: string }; presentation: Record<string, unknown>; publishedVersion: { id: string; version: number; publishedAt: string } };
const read = async (response: Response) => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "فروشگاه در دسترس نیست."); return data; };
const deviceForWidth = (width: number): DeviceMode => width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";

export default function PublicStorefrontRuntime({ page }: { page: "storefront" | "product" }) {
  const { siteProjectId, slug } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<StorefrontMeta | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Selection>({ type: page === "product" ? "product" : "hero", id: page === "product" ? null : "hero" });
  const [device, setDevice] = useState<DeviceMode>(() => deviceForWidth(window.innerWidth));
  const [cartCount, setCartCount] = useState(0);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { const onResize = () => setDevice(deviceForWidth(window.innerWidth)); window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize); }, []);
  useEffect(() => { if (!siteProjectId) return; const controller = new AbortController(); void (async () => { try {
    const [storeData, productData] = await Promise.all([read(await apiFetch(`/api/auth/storefront/${siteProjectId}`, { signal: controller.signal })), read(await apiFetch(`/api/auth/storefront/${siteProjectId}/products`, { signal: controller.signal }))]);
    setMeta(storeData); setProducts(productData.products || []);
    const chosen = page === "product" ? (productData.products || []).find((item: Product) => item.slug === slug) : null;
    if (page === "product" && !chosen) throw new Error("محصول پیدا نشد.");
    setSelected({ type: page === "product" ? "product" : "hero", id: chosen?.id || (page === "storefront" ? "hero" : null) });
    const reference = readPublicCartReference(siteProjectId);
    if (reference) { const cart = await read(await apiFetch(`/api/auth/storefront/carts/${reference.id}`, { headers: cartCapabilityHeaders(reference.capability), signal: controller.signal })); setCartCount((cart.cart?.items || []).reduce((sum: number, item: { quantity?: number }) => sum + Number(item.quantity || 0), 0)); }
  } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(error instanceof Error ? error.message : "فروشگاه در دسترس نیست."); } })(); return () => controller.abort(); }, [page, siteProjectId, slug]);
  const config = useMemo(() => restoreConfig(meta?.presentation || {}), [meta]);
  if (message) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="rounded-3xl border bg-white p-8 text-center"><p>{message}</p><Link to="/" className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-3 text-white">بازگشت</Link></div></main>;
  if (!meta) return <main className="min-h-screen bg-slate-50" aria-label="در حال بارگذاری فروشگاه" />;
  const storeId = siteProjectId as string, base = `/store/${storeId}`;
  const adapter = { openStorefront: () => navigate(base), openCollection: () => navigate(`${base}#store-products`), openProduct: (product: Product) => navigate(`${base}/product/${encodeURIComponent(product.slug || product.id)}`), openCart: () => navigate(`${base}/cart`), addProduct: async (product: Product) => { try { setNotice(""); const variant = (product.variants || []).find((item) => item.id && (item.inventoryPolicy !== "DENY" || item.inventoryQuantity > 0)); if (!variant?.id) throw new Error("این محصول اکنون قابل سفارش نیست."); const cart = await addPublicCartItem(storeId, product.currency, variant.id, 1); setCartCount((cart.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)); setNotice("به سبد خرید اضافه شد."); } catch (error) { setNotice(error instanceof Error ? error.message : "افزودن به سبد خرید ناموفق بود."); } }, cartCount };
  return <main data-published-version-id={meta.publishedVersion.id} data-published-version={meta.publishedVersion.version}><StudioCanvas config={{ ...config, activePage: page }} products={products} device={device} selected={selected} select={setSelected} interactive={false} runtimePage={page} runtimeAdapter={adapter} />{notice && <div role="status" className="fixed bottom-5 left-5 z-50 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl">{notice}</div>}</main>;
}
