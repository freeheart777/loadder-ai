import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCartSimple,
  Storefront,
  Truck,
} from "@phosphor-icons/react";
import { productGallery } from "../lib/productMedia";

type Variant = {
  id: string;
  sku: string;
  title: string;
  priceMinor: number | null;
  inventoryQuantity: number;
  inventoryPolicy: string;
  options: Record<string, string>;
  imageUrl?: string | null;
};
type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category?: string | null;
  brand?: string | null;
  currency: string;
  basePriceMinor: number;
  compareAtPriceMinor?: number | null;
  featured: boolean;
  gallery: string[];
  variants: Variant[];
};
async function read(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || "خطا در دریافت محصول");
  return d;
}
function fmt(minor: number, currency: string) {
  const v = (minor || 0) / 100;
  if (currency === "IRT")
    return `${new Intl.NumberFormat("fa-IR").format(v)} تومان`;
  if (currency === "IRR")
    return `${new Intl.NumberFormat("fa-IR").format(v)} ریال`;
  try {
    return new Intl.NumberFormat("fa-IR", {
      style: "currency",
      currency: currency || "USD",
    }).format(v);
  } catch {
    return `${new Intl.NumberFormat("fa-IR").format(v)} ${currency}`;
  }
}
export default function PublicProductPage() {
  const { siteProjectId, slug } = useParams(),
    [storeName, setStoreName] = useState("فروشگاه"),
    [product, setProduct] = useState<Product | null>(null),
    [variant, setVariant] = useState<Variant | null>(null),
    [activeImage, setActiveImage] = useState(""),
    [qty, setQty] = useState(1),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const cartKey = siteProjectId ? `loadder-public-cart:${siteProjectId}` : "";
  useEffect(() => {
    if (!siteProjectId || !slug) return;
    void (async () => {
      try {
        const d = await read(
          await fetch(
            `/api/auth/storefront/${siteProjectId}/products/${encodeURIComponent(slug)}`,
          ),
        );
        setStoreName(d.store?.name || "فروشگاه");
        setProduct(d.product);
        const first =
          (d.product?.variants || []).find(
            (v: Variant) =>
              v.inventoryPolicy !== "DENY" || v.inventoryQuantity > 0,
          ) ||
          (d.product?.variants || [])[0] ||
          null;
        setVariant(first);
        const imgs = productGallery(d.product);
        setActiveImage(imgs[0] || "");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "خطا");
      }
    })();
  }, [siteProjectId, slug]);
  const images = useMemo(() => productGallery(product), [product]);
  async function add() {
    if (!product || !variant || !siteProjectId) return;
    setBusy(true);
    try {
      let cartId = localStorage.getItem(cartKey);
      if (!cartId) {
        const c = await read(
          await fetch(`/api/auth/storefront/${siteProjectId}/carts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currency: product.currency }),
          }),
        );
        cartId = c.cart.id;
        localStorage.setItem(cartKey, cartId || "");
      }
      await read(
        await fetch(`/api/auth/storefront/carts/${cartId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: variant.id, quantity: qty }),
        }),
      );
      setMessage(
        `${new Intl.NumberFormat("fa-IR").format(qty)} عدد به سبد خرید اضافه شد.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "خطا در سبد خرید");
    } finally {
      setBusy(false);
    }
  }
  if (message && !product)
    return (
      <main
        dir="rtl"
        className="grid min-h-screen place-items-center bg-slate-50 p-6"
      >
        <div className="rounded-3xl border bg-white p-8 text-center">
          <p>{message}</p>
          <Link
            to={siteProjectId ? `/store/${siteProjectId}` : "/"}
            className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-3 text-white"
          >
            بازگشت
          </Link>
        </div>
      </main>
    );
  if (!product) return <main className="min-h-screen bg-slate-50" />;
  const price = variant?.priceMinor ?? product.basePriceMinor;
  const available =
    variant &&
    (variant.inventoryPolicy !== "DENY" || variant.inventoryQuantity > 0);
  const discount =
    product.compareAtPriceMinor && product.compareAtPriceMinor > price
      ? Math.round((1 - price / product.compareAtPriceMinor) * 100)
      : 0;
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link
            to={`/store/${siteProjectId}`}
            className="flex items-center gap-2 font-black"
          >
            <ArrowRight />
            <span>{storeName}</span>
          </Link>
          <ShoppingCartSimple size={24} />
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-2 lg:py-12">
        <section>
          <div className="grid aspect-square place-items-center overflow-hidden rounded-[2rem] border bg-white shadow-sm">
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <Storefront size={80} className="text-slate-200" />
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => setActiveImage(img)}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border bg-white ${activeImage === img ? "ring-2 ring-violet-500" : ""}`}
                >
                  <img src={img} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-[2rem] border bg-white p-6 shadow-sm sm:p-8">
          <div className="text-xs text-slate-400">
            {[product.category, product.brand].filter(Boolean).join(" · ")}
          </div>
          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-5 whitespace-pre-line leading-8 text-slate-500">
            {product.description || "برای این محصول هنوز توضیحی ثبت نشده است."}
          </p>
          <div className="mt-6 flex items-end gap-3">
            <b className="text-2xl text-violet-700 sm:text-3xl">
              {fmt(price, product.currency)}
            </b>
            {discount > 0 && (
              <>
                <span className="text-sm text-slate-400 line-through">
                  {fmt(product.compareAtPriceMinor!, product.currency)}
                </span>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-600">
                  ٪{new Intl.NumberFormat("fa-IR").format(discount)} تخفیف
                </span>
              </>
            )}
          </div>
          {product.variants.length > 0 && (
            <div className="mt-8">
              <b className="text-sm">انتخاب تنوع</b>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const ok =
                    v.inventoryPolicy !== "DENY" || v.inventoryQuantity > 0;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        setVariant(v);
                        if (v.imageUrl) setActiveImage(v.imageUrl);
                      }}
                      disabled={!ok}
                      className={`rounded-2xl border px-4 py-3 text-sm transition disabled:opacity-35 ${variant?.id === v.id ? "border-violet-500 bg-violet-50 text-violet-800" : "bg-white"}`}
                    >
                      <span className="font-bold">{v.title}</span>
                      {Object.keys(v.options || {}).length > 0 && (
                        <span className="mr-1 text-xs text-slate-400">
                          {Object.values(v.options).join(" / ")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-7 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
            <div>
              <b className="text-sm">تعداد</b>
              <div className="mt-1 text-xs text-slate-400">
                {available
                  ? variant?.inventoryPolicy === "DENY"
                    ? `${new Intl.NumberFormat("fa-IR").format(variant.inventoryQuantity)} عدد موجود`
                    : "موجود"
                  : "ناموجود"}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-white p-1">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"
              >
                <Minus />
              </button>
              <b className="min-w-6 text-center">
                {new Intl.NumberFormat("fa-IR").format(qty)}
              </b>
              <button
                onClick={() =>
                  setQty((q) =>
                    variant?.inventoryPolicy === "DENY"
                      ? Math.min(variant.inventoryQuantity, q + 1)
                      : q + 1,
                  )
                }
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"
              >
                <Plus />
              </button>
            </div>
          </div>
          <button
            onClick={add}
            disabled={!available || busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 p-4 font-black text-white disabled:opacity-40"
          >
            <ShoppingCartSimple size={22} />
            {busy
              ? "در حال افزودن..."
              : available
                ? "افزودن به سبد خرید"
                : "ناموجود"}
          </button>
          {message && (
            <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">
              {message}
            </div>
          )}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Trust icon={<ShieldCheck />} title="خرید امن" />
            <Trust icon={<Truck />} title="ارسال مطمئن" />
            <Trust icon={<CheckCircle />} title="ضمانت اصالت" />
          </div>
        </section>
      </div>
    </main>
  );
}
function Trust({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border bg-slate-50 p-3 text-sm font-bold text-slate-600">
      <span className="text-violet-600">{icon}</span>
      {title}
    </div>
  );
}
