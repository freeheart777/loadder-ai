import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cartCapabilityHeaders, cartStorageKey, orderStorageKey, readPublicCartReference } from "../lib/publicCart";

type Cart = { id: string; currency: string; totalMinor: number };
type Shipping = { id: string; name: string; priceMinor: number };
async function read(responseInput: Response | Promise<Response>) { const response = await responseInput; const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "خطا"); return data; }
function money(value: number, currency: string) { return `${new Intl.NumberFormat("fa-IR").format((value || 0) / 100)} ${currency === "IRT" ? "تومان" : currency}`; }

export default function PublicCheckoutPage() {
  const { siteProjectId } = useParams();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart | null>(null);
  const [shipping, setShipping] = useState<Shipping[]>([]);
  const [selected, setSelected] = useState("");
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", province: "", city: "", address: "", postalCode: "", notes: "" });
  useEffect(() => {
    if (!siteProjectId) return;
    const reference = readPublicCartReference(siteProjectId);
    if (!reference) { navigate(`/store/${siteProjectId}/cart`); return; }
    void Promise.all([
      read(fetch(`/api/auth/storefront/carts/${reference.id}`, { headers: cartCapabilityHeaders(reference.capability) })),
      read(fetch(`/api/auth/storefront/${siteProjectId}/checkout-options`)),
    ]).then(([cartResult, options]) => { setCart(cartResult.cart); setShipping(options.shippingMethods || []); })
      .catch((error) => setMessage(error instanceof Error ? error.message : "خطا"));
  }, [navigate, siteProjectId]);
  async function chooseShipping(id: string) {
    if (!siteProjectId || !cart) return;
    const reference = readPublicCartReference(siteProjectId); if (!reference) return;
    try { setBusy(true); const data = await read(fetch(`/api/auth/storefront/carts/${cart.id}/shipping`, { method: "POST", headers: cartCapabilityHeaders(reference.capability, true), body: JSON.stringify({ shippingMethodId: id }) })); setCart(data.cart); setSelected(id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "خطا در ارسال"); } finally { setBusy(false); }
  }
  async function applyCoupon() {
    if (!siteProjectId || !cart || !coupon.trim()) return;
    const reference = readPublicCartReference(siteProjectId); if (!reference) return;
    try { setBusy(true); const data = await read(fetch(`/api/auth/storefront/carts/${cart.id}/coupon`, { method: "POST", headers: cartCapabilityHeaders(reference.capability, true), body: JSON.stringify({ code: coupon }) })); setCart(data.cart); setMessage("کد تخفیف اعمال شد."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "کد معتبر نیست"); } finally { setBusy(false); }
  }
  async function submit() {
    if (!siteProjectId || !cart) return;
    const reference = readPublicCartReference(siteProjectId); if (!reference) return;
    if (!form.fullName.trim() || !form.phone.trim() || !form.address.trim()) { setMessage("نام، موبایل و آدرس را کامل کن."); return; }
    try {
      setBusy(true);
      const method = shipping.find((item) => item.id === selected);
      const data = await read(fetch(`/api/auth/storefront/carts/${cart.id}/checkout`, { method: "POST", headers: cartCapabilityHeaders(reference.capability, true), body: JSON.stringify({ fullName: form.fullName, phone: form.phone, email: form.email, shippingMethod: method?.name || "manual", shippingAddress: { province: form.province, city: form.city, address: form.address, postalCode: form.postalCode, notes: form.notes } }) }));
      if (!data.receiptCapability) throw new Error("رسید سفارش ایجاد نشد.");
      localStorage.removeItem(cartStorageKey(siteProjectId));
      localStorage.setItem(orderStorageKey(data.order.id), data.receiptCapability);
      navigate(`/store/${siteProjectId}/order-success/${data.order.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "ثبت سفارش ناموفق بود"); } finally { setBusy(false); }
  }
  if (!siteProjectId) return null;
  return <main dir="rtl" className="min-h-screen bg-slate-50 pb-28 text-slate-950">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4"><Link to={`/store/${siteProjectId}/cart`} className="grid min-h-11 min-w-11 place-items-center rounded-xl border"><ArrowRight /></Link><b>تکمیل سفارش</b></div></header>
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-4 rounded-3xl border bg-white p-5"><h1 className="font-black">اطلاعات گیرنده</h1><div className="grid gap-3 sm:grid-cols-2">{([['fullName','نام و نام خانوادگی'],['phone','شماره موبایل'],['email','ایمیل (اختیاری)'],['province','استان'],['city','شهر'],['postalCode','کد پستی']] as const).map(([key,label]) => <label key={key} className="text-xs font-bold">{label}<input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-2 min-h-11 w-full rounded-2xl border px-3" /></label>)}</div><label className="block text-xs font-bold">آدرس کامل<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-2 min-h-24 w-full rounded-2xl border p-3" /></label><label className="block text-xs font-bold">توضیحات سفارش<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 min-h-20 w-full rounded-2xl border p-3" /></label><h2 className="font-black">روش ارسال</h2>{shipping.length ? shipping.map((item) => <button key={item.id} disabled={busy} onClick={() => void chooseShipping(item.id)} className={`flex min-h-11 w-full items-center justify-between rounded-2xl border p-3 ${selected === item.id ? "border-violet-500 bg-violet-50" : ""}`}><span>{item.name}</span><span>{item.priceMinor ? money(item.priceMinor, cart?.currency || "IRT") : "رایگان"}</span>{selected === item.id && <CheckCircle />}</button>) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">روش ارسال با فروشگاه هماهنگ می‌شود.</p>}<div className="flex gap-2"><input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="کد تخفیف" className="min-h-11 flex-1 rounded-2xl border px-3" /><button disabled={busy} onClick={() => void applyCoupon()} className="min-h-11 rounded-2xl bg-slate-900 px-5 font-bold text-white">اعمال</button></div></section>
      <aside className="h-fit rounded-3xl border bg-white p-5"><h2 className="font-black">خلاصه پرداخت</h2><p className="mt-4 flex justify-between"><span>مبلغ نهایی</span><b>{cart ? money(cart.totalMinor, cart.currency) : "-"}</b></p><button disabled={busy || !cart} onClick={() => void submit()} className="mt-6 min-h-11 w-full rounded-2xl bg-emerald-600 px-4 font-black text-white disabled:opacity-50">{busy ? "در حال ثبت..." : "ثبت سفارش"}</button></aside>
    </div>{message && <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-2xl bg-slate-900 p-3 text-center text-sm text-white">{message}</div>}
  </main>;
}
