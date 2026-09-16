import { useEffect, useState } from "react";
import { CheckCircle, Storefront } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { orderCapabilityHeaders, orderStorageKey } from "../lib/publicCart";

type Order = { id: string; currency: string; totalMinor: number; items: Array<{ productName: string; quantity: number; lineTotalMinor: number }> };
async function read(responseInput: Response | Promise<Response>) { const response = await responseInput; const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "خطا"); return data; }
function money(value: number, currency: string) { return `${new Intl.NumberFormat("fa-IR").format((value || 0) / 100)} ${currency === "IRT" ? "تومان" : currency}`; }

export default function PublicOrderSuccessPage() {
  const { siteProjectId, orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!orderId) return;
    const capability = localStorage.getItem(orderStorageKey(orderId));
    if (!capability) { setMessage("رسید سفارش در دسترس نیست."); return; }
    void read(fetch(`/api/auth/storefront/orders/${orderId}`, { headers: orderCapabilityHeaders(capability) }))
      .then((data) => setOrder(data.order)).catch((error) => setMessage(error instanceof Error ? error.message : "خطا"));
  }, [orderId]);
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950"><div className="mx-auto max-w-xl rounded-3xl border bg-white p-6 text-center shadow-sm sm:p-8"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle size={40} weight="fill" /></div><h1 className="mt-5 text-2xl font-black">سفارش با موفقیت ثبت شد</h1>{order && <><div className="mt-6 rounded-2xl bg-slate-50 p-4 text-right"><p className="flex justify-between text-sm"><span className="text-slate-400">شماره سفارش</span><b dir="ltr">{order.id}</b></p><p className="mt-3 flex justify-between text-sm"><span className="text-slate-400">مبلغ</span><b>{money(order.totalMinor, order.currency)}</b></p></div><div className="mt-5 space-y-2 text-right">{order.items.map((item, index) => <div key={index} className="flex justify-between rounded-xl border p-3 text-sm"><span>{item.productName} × {new Intl.NumberFormat("fa-IR").format(item.quantity)}</span><b>{money(item.lineTotalMinor, order.currency)}</b></div>)}</div></>}{message && <div className="mt-5 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{message}</div>}<Link to={`/store/${siteProjectId}`} className="mt-7 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-black text-white"><Storefront /> بازگشت به فروشگاه</Link></div></main>;
}
