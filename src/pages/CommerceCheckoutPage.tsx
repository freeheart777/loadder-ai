import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Minus, Plus, Trash } from "@phosphor-icons/react";

type Item = { id: string; productName: string; variantTitle: string | null; quantity: number; basePrice: number; priceOverride: number | null; productCurrency: string };
type Cart = { id: string; revision: number; currency: string };

const call = async (path: string, init: RequestInit = {}) => {
  const token = localStorage.getItem("loadder-commerce-cart") || "";
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", "X-Cart-Token": token, ...init.headers } });
  const result = await response.json();
  if (!response.ok) throw Error(result.code || "خطا");
  return result;
};

export default function CommerceCheckoutPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [step, setStep] = useState<"CART" | "CONTACT" | "DONE">("CART");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState("");
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paying, setPaying] = useState(false);
  const load = () => call("/api/public/commerce/cart").then((result) => { setCart(result.cart); setItems(result.items); setTotal(result.totals.subtotal); }).catch((error) => setMessage(error.message));
  useEffect(() => { void load(); void call("/api/public/commerce/payments/readiness").then((result) => setPaymentEnabled(result.paymentEnabled === true)).catch(() => setPaymentEnabled(false)); }, []);
  const qty = async (item: Item, quantity: number) => { if (!cart) return; try { await call(`/api/public/commerce/cart/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ revision: cart.revision, quantity }) }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "خطا"); } };
  const confirm = async () => { try { const checkout = await call("/api/public/commerce/checkouts", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ fulfillmentMode: "CONTACT_TO_COMPLETE" }) }); const ready = await call(`/api/public/commerce/checkouts/${checkout.checkout.id}`, { method: "PATCH", body: JSON.stringify({ revision: checkout.checkout.revision, fulfillmentMode: "CONTACT_TO_COMPLETE", shippingMethod: "CUSTOM_CONTACT", contactName: name, contactMobile: mobile, contactEmail: null, recipientName: null, recipientMobile: null, province: null, city: null, postalAddress: null, postalCode: null }) }); const result = await call(`/api/public/commerce/checkouts/${checkout.checkout.id}/confirm`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ revision: ready.checkout.revision }) }); setOrder(result.pendingOrder.publicReference); setStep("DONE"); } catch (error) { setMessage(error instanceof Error ? error.message : "خطا"); } };
  const pay = async () => { setPaying(true); setMessage(""); try { const result = await call("/api/public/commerce/payments", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ orderReference: order }) }); if (!result.attempt?.redirectUrl) throw Error("PAYMENT_AUTHORIZATION_FAILED"); window.location.assign(result.attempt.redirectUrl); } catch (error) { setMessage(error instanceof Error ? error.message : "خطا"); setPaying(false); } };

  return <main dir="rtl" className="min-h-screen bg-[#050507] p-4 text-white"><div className="mx-auto max-w-2xl"><header className="mb-6 flex items-center gap-3"><Link to="/dashboard/catalog" className="min-h-11 min-w-11 rounded-xl border border-white/10 p-3"><ArrowRight /></Link><h1 className="text-2xl font-bold">سبد خرید و ثبت سفارش</h1></header>{step === "CART" && <><div className="space-y-3">{items.map((item) => <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="min-w-0 flex-1"><h2 className="font-semibold">{item.productName}</h2><p className="text-xs text-white/45">{item.variantTitle}</p><p className="mt-2 text-sm">{(item.priceOverride ?? item.basePrice).toLocaleString("fa-IR")} {item.productCurrency}</p></div><div className="flex items-center gap-2"><button onClick={() => void qty(item, Math.max(0, item.quantity - 1))} className="min-h-11 min-w-11 rounded-xl border border-white/10"><Minus /></button><span>{item.quantity}</span><button onClick={() => void qty(item, Math.min(99, item.quantity + 1))} className="min-h-11 min-w-11 rounded-xl border border-white/10"><Plus /></button><button onClick={() => void qty(item, 0)} className="min-h-11 min-w-11 rounded-xl text-red-300"><Trash /></button></div></article>)}</div><div className="sticky bottom-3 mt-5 rounded-2xl border border-violet-400/20 bg-[#11111a]/95 p-4"><div className="flex justify-between"><span>جمع</span><strong>{total.toLocaleString("fa-IR")} {cart?.currency}</strong></div><button disabled={!items.length} onClick={() => setStep("CONTACT")} className="mt-4 min-h-12 w-full rounded-xl bg-violet-600">ادامه ثبت سفارش</button></div></>}{step === "CONTACT" && <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[.03] p-5"><p className="text-sm text-white/55">اطلاعات فقط برای هماهنگی این سفارش نگهداری می‌شود.</p><input value={name} onChange={(event) => setName(event.target.value)} className="min-h-12 w-full rounded-xl bg-black/30 p-3" placeholder="نام و نام خانوادگی" /><input inputMode="tel" dir="ltr" value={mobile} onChange={(event) => setMobile(event.target.value)} className="min-h-12 w-full rounded-xl bg-black/30 p-3 text-right" placeholder="شماره موبایل" /><button onClick={() => void confirm()} className="min-h-12 w-full rounded-xl bg-emerald-600">ثبت سفارش</button><p className="text-xs text-amber-200">این مرحله پرداخت نیست و سفارش در وضعیت «در انتظار پرداخت» ثبت می‌شود.</p></section>}{step === "DONE" && <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-center"><h2 className="text-xl font-bold">درخواست سفارش ثبت شد</h2><p dir="ltr" className="mt-4 font-mono">{order}</p>{paymentEnabled ? <><p className="mt-4 text-sm">برای تکمیل سفارش، به درگاه امن پرداخت منتقل می‌شوید.</p><button disabled={paying} onClick={() => void pay()} className="mt-4 min-h-12 w-full rounded-xl bg-emerald-600 disabled:opacity-50">{paying ? "در حال انتقال…" : "ادامه به پرداخت امن"}</button></> : <p className="mt-4 text-sm">پرداخت آنلاین هنوز فعال نیست؛ برای ادامه با شما هماهنگ می‌شود.</p>}</section>}{message && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{message}</p>}</div></main>;
}
