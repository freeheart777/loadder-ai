import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleNotch,
  Desktop,
  MagicWand,
  Package,
  Phone,
  Plus,
  Sparkle,
} from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { productMainImage } from "../lib/productMedia";
type P = {
  id: string;
  name: string;
  siteType: string;
  content: Record<string, any>;
};
type Product = {
  id: string;
  name: string;
  basePriceMinor: number;
  currency: string;
  metadata?: { gallery?: string[] };
  variants?: Array<{ imageUrl?: string | null }>;
};
async function read(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || "خطا");
  return d;
}
const money = (n: number, c: string) =>
  new Intl.NumberFormat("fa-IR").format((n || 0) / 100) +
  " " +
  (c === "IRT" ? "تومان" : c);
export default function StoreQuickStartPage() {
  const nav = useNavigate(),
    [p, setP] = useState<P | null>(null),
    [products, setProducts] = useState<Product[]>([]),
    [brand, setBrand] = useState<any>(null),
    [busy, setBusy] = useState(true),
    [mode, setMode] = useState<"desktop" | "mobile">("desktop"),
    [msg, setMsg] = useState("");
  useEffect(() => {
    void boot();
  }, []);
  async function boot() {
    try {
      const ps = await read(await apiFetch("/api/site-projects"));
      const x =
        (ps.projects || []).find(
          (a: P) => String(a.siteType).toUpperCase() === "STORE",
        ) || ps.projects?.[0];
      if (!x) throw new Error("پروژه فروشگاهی پیدا نشد");
      const [detail, bb, pd] = await Promise.all([
        read(await apiFetch(`/api/site-projects/${x.id}`)),
        read(await apiFetch("/api/brand-book/current")).catch(() => ({})),
        read(await apiFetch(`/api/stores/${x.id}/products`)).catch(() => ({
          products: [],
        })),
      ]);
      setP(detail.project);
      setBrand(bb.activeVersion || bb.brandBook || bb);
      setProducts(pd.products || []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }
  const identity = brand?.brandIdentity || brand?.brand_identity || {};
  const name = identity.brandName || identity.name || p?.name || "فروشگاه من";
  const industry =
    identity.industry ||
    p?.content?.storeSetupV10?.industry ||
    "فروشگاه آنلاین";
  const primary =
    p?.content?.storeBuilderV11?.design?.primary ||
    p?.content?.storeSetupV10?.brandColor ||
    "#6d5dfc";
  const ready = products.length > 0;
  const preview = useMemo(() => products.slice(0, 6), [products]);
  if (busy)
    return (
      <main className="grid min-h-screen place-items-center">
        <CircleNotch className="animate-spin" size={30} />
      </main>
    );
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/dashboard/websites" className="font-black">
            Loadder Commerce
          </Link>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
            AI Quick Start
          </span>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 lg:grid-cols-[340px_1fr]">
        <aside className="h-fit rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-violet-700">
            <MagicWand />
            <b>فروشگاهت را از اطلاعات قبلی ساختیم</b>
          </div>
          <h1 className="mt-5 text-2xl font-black">{name}</h1>
          <p className="mt-2 text-sm text-slate-500">{industry}</p>
          <div className="mt-5 space-y-3 text-sm">
            <Row ok={!!brand}>Brand Book و هویت برند</Row>
            <Row ok={!!p}>Business Context فروشگاه</Row>
            <Row ok={ready}>{products.length} محصول دریافت شده</Row>
          </div>
          {!ready ? (
            <div className="mt-6 rounded-2xl bg-amber-50 p-4">
              <b className="text-sm">فقط محصولاتت را بده</b>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                نام برند، رنگ و ساختار اولیه را دوباره سؤال نمی‌کنیم.
              </p>
              <Link
                to="/dashboard/websites/commerce"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-900 p-3 text-xs font-black text-white"
              >
                <Plus /> افزودن محصولات
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              <button
                onClick={() => nav(`/store/${p?.id}`)}
                className="flex w-full items-center justify-center gap-2 rounded-xl p-3 text-sm font-black text-white"
                style={{ background: primary }}
              >
                <Check /> تأیید و مشاهده فروشگاه
              </button>
              <Link
                to="/dashboard/websites"
                className="flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold"
              >
                ویرایش در Visual Studio <ArrowLeft />
              </Link>
            </div>
          )}
          {msg && <p className="mt-4 text-xs text-red-600">{msg}</p>}
        </aside>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <b>پیش‌نمایش قبل از ورود به Studio</b>
              <p className="mt-1 text-xs text-slate-500">
                همان فروشگاهی که مشتری خواهد دید.
              </p>
            </div>
            <div className="flex rounded-xl border bg-white p-1">
              <button
                onClick={() => setMode("desktop")}
                className={`rounded-lg p-2 ${mode === "desktop" ? "bg-slate-900 text-white" : ""}`}
              >
                <Desktop />
              </button>
              <button
                onClick={() => setMode("mobile")}
                className={`rounded-lg p-2 ${mode === "mobile" ? "bg-slate-900 text-white" : ""}`}
              >
                <Phone />
              </button>
            </div>
          </div>
          <div
            className={`mx-auto overflow-hidden border bg-white shadow-xl transition-all ${mode === "mobile" ? "max-w-[390px] rounded-[32px]" : "w-full rounded-3xl"}`}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <b>{name}</b>
              <span className="text-xs">سبد خرید</span>
            </div>
            <div
              className="p-6 text-white"
              style={{
                background: `linear-gradient(135deg,${primary},#111827)`,
              }}
            >
              <span className="text-xs opacity-70">{industry}</span>
              <h2 className="mt-2 text-3xl font-black">
                انتخاب بهتر، خرید ساده‌تر.
              </h2>
              <p className="mt-3 text-sm opacity-80">
                فروشگاه اولیه بر اساس هویت برند شما آماده شده است.
              </p>
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <b>محصولات پیشنهادی</b>
                <Sparkle style={{ color: primary }} />
              </div>
              <div
                className={`grid gap-3 ${mode === "mobile" ? "grid-cols-2" : "grid-cols-3"}`}
              >
                {preview.length ? (
                  preview.map((x) => (
                    <article
                      key={x.id}
                      className="overflow-hidden rounded-2xl border bg-white"
                    >
                      <div className="aspect-square bg-slate-100">
                        {productMainImage(x) && (
                          <img
                            src={productMainImage(x)}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-3">
                        <b className="block truncate text-sm">{x.name}</b>
                        <span
                          className="mt-2 block text-xs font-black"
                          style={{ color: primary }}
                        >
                          {money(x.basePriceMinor, x.currency)}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-slate-400">
                    <Package className="mx-auto mb-3" size={30} />
                    محصول اضافه کن تا فروشگاه واقعی همین‌جا ساخته شود.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
function Row({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
      <span
        className={`grid h-6 w-6 place-items-center rounded-full ${ok ? "bg-emerald-500 text-white" : "bg-slate-200"}`}
      >
        {ok && <Check size={13} />}
      </span>
      <span>{children}</span>
    </div>
  );
}
