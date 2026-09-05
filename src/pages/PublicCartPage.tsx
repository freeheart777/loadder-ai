import { useEffect, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingBagOpen, Trash } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { isRecoverableStaleCartError, readPublicCartResponse } from "../lib/publicCart";

type Item = {
  variantId: string;
  productName: string;
  variantTitle: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};
type Cart = {
  id: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  items: Item[];
};

function money(value: number, currency: string) {
  const amount = (value || 0) / 100;
  return currency === "IRT"
    ? `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`
    : `${new Intl.NumberFormat("fa-IR").format(amount)} ${currency}`;
}

export default function PublicCartPage() {
  const { siteProjectId } = useParams();
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const key = siteProjectId ? `loadder-public-cart:${siteProjectId}` : "";

  useEffect(() => {
    void load();
  }, [siteProjectId]);

  async function load() {
    const id = localStorage.getItem(key);
    if (!id) return;
    try {
      const data = await readPublicCartResponse<{ cart: Cart }>(
        await fetch(`/api/auth/storefront/carts/${id}`),
      );
      setCart(data.cart);
    } catch (error) {
      if (isRecoverableStaleCartError(error)) localStorage.removeItem(key);
      setMessage(error instanceof Error ? error.message : "خطا");
    }
  }

  async function setQuantity(variantId: string, quantity: number) {
    if (!cart) return;
    setBusy(variantId);
    try {
      const data = await readPublicCartResponse<{ cart: Cart }>(
        await fetch(`/api/auth/storefront/carts/${cart.id}/items/${variantId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
        }),
      );
      setCart(data.cart);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "خطا");
    } finally {
      setBusy("");
    }
  }

  if (!siteProjectId) return null;
  const empty = !cart || cart.items.length === 0;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 pb-28 text-slate-950 lg:pb-8">
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <Link to={`/store/${siteProjectId}`} className="grid h-10 w-10 place-items-center rounded-xl border">
            <ArrowRight />
          </Link>
          <b className="text-lg">سبد خرید</b>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {message && <div className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{message}</div>}
        {empty ? (
          <div className="rounded-3xl border border-dashed bg-white p-12 text-center">
            <ShoppingBagOpen size={42} className="mx-auto text-slate-300" />
            <h1 className="mt-4 text-xl font-black">سبد خرید خالی است</h1>
            <Link to={`/store/${siteProjectId}`} className="mt-5 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white">
              بازگشت به فروشگاه
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="space-y-3">
              {cart.items.map((item) => (
                <article key={item.variantId} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl">📦</div>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate">{item.productName}</b>
                      <div className="mt-1 text-xs text-slate-400">{item.variantTitle}</div>
                      <div className="mt-3 font-black">{money(item.lineTotalMinor, cart.currency)}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center rounded-xl border bg-white">
                      <button disabled={busy === item.variantId} onClick={() => void setQuantity(item.variantId, Math.max(0, item.quantity - 1))} className="p-3">
                        <Minus />
                      </button>
                      <b className="min-w-9 text-center">{new Intl.NumberFormat("fa-IR").format(item.quantity)}</b>
                      <button disabled={busy === item.variantId} onClick={() => void setQuantity(item.variantId, item.quantity + 1)} className="p-3">
                        <Plus />
                      </button>
                    </div>
                    <button onClick={() => void setQuantity(item.variantId, 0)} className="flex items-center gap-1 text-xs font-bold text-rose-600">
                      <Trash /> حذف
                    </button>
                  </div>
                </article>
              ))}
            </section>
            <aside className="h-fit rounded-3xl border bg-white p-5 lg:sticky lg:top-24">
              <h2 className="font-black">خلاصه سفارش</h2>
              <Row label="جمع کالاها" value={money(cart.subtotalMinor, cart.currency)} />
              {cart.discountMinor > 0 && <Row label="تخفیف" value={`− ${money(cart.discountMinor, cart.currency)}`} />}
              <Row label="ارسال" value={cart.shippingMinor ? money(cart.shippingMinor, cart.currency) : "در مرحله بعد"} />
              <div className="my-4 border-t" />
              <Row label="قابل پرداخت" value={money(cart.totalMinor, cart.currency)} bold />
              <Link to={`/store/${siteProjectId}/checkout`} className="mt-5 hidden w-full rounded-2xl bg-violet-600 py-4 text-center text-sm font-black text-white lg:block">
                ادامه و ثبت سفارش
              </Link>
            </aside>
          </div>
        )}
      </div>
      {!empty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-3 lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="flex-1">
              <div className="text-[10px] text-slate-400">قابل پرداخت</div>
              <b>{money(cart.totalMinor, cart.currency)}</b>
            </div>
            <Link to={`/store/${siteProjectId}/checkout`} className="rounded-2xl bg-violet-600 px-6 py-4 text-sm font-black text-white">
              ادامه
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`mt-4 flex items-center justify-between text-sm ${bold ? "font-black" : "text-slate-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
