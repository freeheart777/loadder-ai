import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  MagnifyingGlass,
  ShoppingCartSimple,
  Storefront,
  SlidersHorizontal,
  Star,
} from "@phosphor-icons/react";
import { productMainImage } from "../lib/productMedia";
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
type StoreMeta = { id: string; name: string };
async function read(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || "خطا در دریافت فروشگاه");
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
function availableVariant(p: Product) {
  return (
    p.variants.find(
      (v) => v.inventoryPolicy !== "DENY" || v.inventoryQuantity > 0,
    ) || null
  );
}
export default function PublicStorefrontPage() {
  const { siteProjectId } = useParams();
  const [store, setStore] = useState<StoreMeta | null>(null),
    [products, setProducts] = useState<Product[]>([]),
    [categories, setCategories] = useState<string[]>([]),
    [brands, setBrands] = useState<string[]>([]),
    [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [brand, setBrand] = useState(""),
    [sort, setSort] = useState("newest"),
    [inStock, setInStock] = useState(false),
    [cartCount, setCartCount] = useState(0),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const cartKey = siteProjectId ? `loadder-public-cart:${siteProjectId}` : "";
  useEffect(() => {
    if (!siteProjectId) return;
    void (async () => {
      try {
        const meta = await read(
          await fetch(`/api/auth/storefront/${siteProjectId}`),
        );
        setStore(meta.store);
        setCategories(meta.categories || []);
        setBrands(meta.brands || []);
        const saved = localStorage.getItem(cartKey);
        if (saved) {
          const c = await read(
            await fetch(`/api/auth/storefront/carts/${saved}`),
          );
          setCartCount(
            (c.cart?.items || []).reduce(
              (s: number, i: any) => s + Number(i.quantity || 0),
              0,
            ),
          );
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "خطا");
      }
    })();
  }, [siteProjectId, cartKey]);
  useEffect(() => {
    if (!siteProjectId) return;
    const t = setTimeout(
      () =>
        void (async () => {
          try {
            const p = new URLSearchParams();
            if (q.trim()) p.set("q", q.trim());
            if (category) p.set("category", category);
            if (brand) p.set("brand", brand);
            if (inStock) p.set("inStock", "1");
            p.set("sort", sort);
            const d = await read(
              await fetch(
                `/api/auth/storefront/${siteProjectId}/products?${p}`,
              ),
            );
            setProducts(d.products || []);
            setMessage("");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "خطا");
          }
        })(),
      180,
    );
    return () => clearTimeout(t);
  }, [siteProjectId, q, category, brand, inStock, sort]);
  const featured = useMemo(
    () => products.filter((p) => p.featured).slice(0, 4),
    [products],
  );
  async function add(p: Product) {
    if (!siteProjectId) return;
    const v = availableVariant(p);
    if (!v) {
      setMessage("این محصول فعلاً موجود نیست.");
      return;
    }
    setBusy(p.id);
    try {
      let cartId = localStorage.getItem(cartKey);
      if (!cartId) {
        const c = await read(
          await fetch(`/api/auth/storefront/${siteProjectId}/carts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currency: p.currency }),
          }),
        );
        cartId = c.cart.id;
        localStorage.setItem(cartKey, cartId || "");
      }
      const d = await read(
        await fetch(`/api/auth/storefront/carts/${cartId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: v.id, quantity: 1 }),
        }),
      );
      setCartCount(
        (d.cart?.items || []).reduce(
          (s: number, i: any) => s + Number(i.quantity || 0),
          0,
        ),
      );
      setMessage("به سبد خرید اضافه شد.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "خطا در سبد خرید");
    } finally {
      setBusy("");
    }
  }
  if (!siteProjectId) return null;
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
              <Storefront size={22} />
            </div>
            <b className="truncate text-sm sm:text-lg">
              {store?.name || "فروشگاه"}
            </b>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <Link
              to={`/store/${siteProjectId}/cart`}
              aria-label="سبد خرید"
              className="relative grid h-10 w-10 place-items-center rounded-xl border bg-white"
            >
              <ShoppingCartSimple size={22} />
              {cartCount > 0 && (
                <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <section className="border-b bg-gradient-to-b from-violet-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
            فروشگاه آنلاین
          </span>
          <h1 className="mt-4 text-3xl font-black sm:text-5xl">
            خرید ساده، سریع و مطمئن
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            محصول مورد نظرت را جستجو کن، تنوع‌ها را ببین و مستقیم به سبد خرید
            اضافه کن.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-3 rounded-3xl border bg-white p-3 shadow-sm md:grid-cols-[1fr_auto_auto_auto]">
          <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4">
            <MagnifyingGlass />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو در محصولات، برند یا SKU..."
              className="w-full bg-transparent py-3 outline-none"
            />
          </label>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="rounded-2xl border px-4 py-3"
          >
            <option value="">همه برندها</option>
            {brands.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-2xl border px-4 py-3"
          >
            <option value="newest">جدیدترین</option>
            <option value="price-asc">ارزان‌ترین</option>
            <option value="price-desc">گران‌ترین</option>
          </select>
          <button
            onClick={() => setInStock((v) => !v)}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${inStock ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "bg-white"}`}
          >
            <SlidersHorizontal /> فقط موجود
          </button>
        </div>
        {categories.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setCategory("")}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm ${!category ? "bg-slate-900 text-white" : "bg-white"}`}
            >
              همه
            </button>
            {categories.map((x) => (
              <button
                key={x}
                onClick={() => setCategory(x)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm ${category === x ? "bg-slate-900 text-white" : "bg-white"}`}
              >
                {x}
              </button>
            ))}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
            {message}
          </div>
        )}
        {!q && !category && !brand && featured.length > 0 && (
          <section className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <Star weight="fill" className="text-amber-500" />
              <h2 className="text-xl font-black">پیشنهاد ویژه</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((p) => (
                <ProductCard
                  key={`f-${p.id}`}
                  p={p}
                  siteProjectId={siteProjectId}
                  busy={busy === p.id}
                  onAdd={() => add(p)}
                />
              ))}
            </div>
          </section>
        )}
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black">محصولات</h2>
              <p className="mt-1 text-xs text-slate-400">
                {new Intl.NumberFormat("fa-IR").format(products.length)} محصول
              </p>
            </div>
          </div>
          {products.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  siteProjectId={siteProjectId}
                  busy={busy === p.id}
                  onAdd={() => add(p)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed bg-white p-14 text-center text-slate-400">
              محصولی با این فیلتر پیدا نشد.
            </div>
          )}
        </section>
      </div>
      <footer className="mt-14 border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-slate-400">
          فروشگاه ساخته‌شده با Loadder Commerce
        </div>
      </footer>
    </main>
  );
}
function ProductCard({
  p,
  siteProjectId,
  busy,
  onAdd,
}: {
  p: Product;
  siteProjectId: string;
  busy: boolean;
  onAdd: () => void;
}) {
  const img = productMainImage(p),
    v = availableVariant(p),
    price = v?.priceMinor ?? p.basePriceMinor,
    discount =
      p.compareAtPriceMinor && p.compareAtPriceMinor > price
        ? Math.round((1 - price / p.compareAtPriceMinor) * 100)
        : 0;
  return (
    <article className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition sm:rounded-3xl sm:hover:-translate-y-1 sm:hover:shadow-lg">
      <Link
        to={`/store/${siteProjectId}/product/${encodeURIComponent(p.slug)}`}
        className="block"
      >
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          {img ? (
            <img
              src={img}
              alt={p.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center text-slate-300">
              <Storefront size={54} />
            </div>
          )}
          {discount > 0 && (
            <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black text-white sm:right-3 sm:top-3 sm:text-xs">
              ٪{new Intl.NumberFormat("fa-IR").format(discount)}
            </span>
          )}
        </div>
        <div className="p-3 sm:p-4">
          <div className="truncate text-[10px] text-slate-400 sm:text-[11px]">
            {[p.category, p.brand].filter(Boolean).join(" · ") || "محصول"}
          </div>
          <h3 className="mt-2 line-clamp-2 min-h-11 text-sm font-black leading-5 sm:min-h-12 sm:text-base sm:leading-6">
            {p.name}
          </h3>
          <div className="mt-3">
            <b className="text-xs text-violet-700 sm:text-base">
              {fmt(price, p.currency)}
            </b>
            {discount > 0 && (
              <span className="mr-2 hidden text-[11px] text-slate-400 line-through sm:inline">
                {fmt(p.compareAtPriceMinor!, p.currency)}
              </span>
            )}
          </div>
        </div>
      </Link>
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
        <button
          onClick={onAdd}
          disabled={!v || busy}
          className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white disabled:opacity-40 sm:rounded-2xl sm:py-3 sm:text-sm"
        >
          {busy ? "..." : v ? "افزودن" : "ناموجود"}
        </button>
      </div>
    </article>
  );
}
