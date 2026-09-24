import { useEffect, useState } from "react";
import { CheckCircle, Clock, Storefront, WarningCircle } from "@phosphor-icons/react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getPublicOrder, retryPublicPayment, type PublicOrder } from "../lib/publicCart";

function money(value: number, currency: string) { return `${new Intl.NumberFormat("fa-IR").format((value || 0) / 100)} ${currency === "IRT" ? "تومان" : currency}`; }

type View = { tone: "ok" | "wait" | "bad"; title: string; note: string };
// The server's paymentStatus is the only truth. ?payment= (set by the gateway callback) only
// picks the wording for an unpaid order; it can never make an order look paid.
function paymentView(order: PublicOrder, gatewayResult: string | null): View {
  if (order.paymentStatus === "PAID") return { tone: "ok", title: "پرداخت با موفقیت انجام شد", note: "سفارش شما ثبت و پرداخت شد." };
  if (order.paymentStatus !== "UNPAID") return { tone: "wait", title: "سفارش ثبت شد", note: "وضعیت پرداخت این سفارش تغییر کرده است. برای جزئیات با فروشگاه تماس بگیرید." };
  if (gatewayResult === "failed") return { tone: "bad", title: "پرداخت انجام نشد", note: "سفارش ثبت شده ولی پرداخت نشده است. مبلغی از حساب شما کسر نشده یا به‌زودی بازگردانده می‌شود." };
  if (gatewayResult) return { tone: "wait", title: "پرداخت در حال بررسی است", note: "نتیجه پرداخت هنوز تأیید نشده است. چند دقیقه دیگر این صفحه را دوباره باز کنید." };
  return { tone: "wait", title: "سفارش ثبت شد", note: "این سفارش هنوز پرداخت نشده است؛ فروشگاه برای هماهنگی پرداخت با شما تماس می‌گیرد." };
}
const TONE = {
  ok: { box: "bg-emerald-50 text-emerald-600", icon: <CheckCircle size={40} weight="fill" /> },
  wait: { box: "bg-amber-50 text-amber-600", icon: <Clock size={40} weight="fill" /> },
  bad: { box: "bg-rose-50 text-rose-600", icon: <WarningCircle size={40} weight="fill" /> },
};

export default function PublicOrderSuccessPage() {
  const { siteProjectId, orderId } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [message, setMessage] = useState("");
  const [paying, setPaying] = useState(false);
  useEffect(() => {
    if (!orderId) return;
    void getPublicOrder(orderId)
      .then((found) => (found ? setOrder(found) : setMessage("رسید سفارش در دسترس نیست.")))
      .catch((error) => setMessage(error instanceof Error ? error.message : "خطا"));
  }, [orderId]);
  const gatewayResult = searchParams.get("payment");
  const view = order ? paymentView(order, gatewayResult) : null;
  // Only orders that went through a gateway can be paid online again; manual orders have none.
  const canRetry = order?.paymentStatus === "UNPAID" && Boolean(gatewayResult);
  async function payAgain() {
    if (!orderId) return;
    setPaying(true); setMessage("");
    try { await retryPublicPayment(orderId); setOrder(await getPublicOrder(orderId)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "پرداخت دوباره ممکن نشد."); }
    finally { setPaying(false); }
  }
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950"><div className="mx-auto max-w-xl rounded-3xl border bg-white p-6 text-center shadow-sm sm:p-8">
    {view ? <><div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${TONE[view.tone].box}`}>{TONE[view.tone].icon}</div><h1 className="mt-5 text-2xl font-black">{view.title}</h1><p className="mt-2 text-sm leading-7 text-slate-500">{view.note}</p></>
      : !message && <p className="text-sm text-slate-400">در حال دریافت وضعیت سفارش…</p>}
    {order && <><div className="mt-6 rounded-2xl bg-slate-50 p-4 text-right"><p className="flex justify-between text-sm"><span className="text-slate-400">شماره سفارش</span><b dir="ltr">{order.id}</b></p><p className="mt-3 flex justify-between text-sm"><span className="text-slate-400">مبلغ</span><b>{money(order.totalMinor, order.currency)}</b></p></div><div className="mt-5 space-y-2 text-right">{order.items.map((item, index) => <div key={index} className="flex justify-between rounded-xl border p-3 text-sm"><span>{item.productName} × {new Intl.NumberFormat("fa-IR").format(item.quantity)}</span><b>{money(item.lineTotalMinor, order.currency)}</b></div>)}</div></>}
    {canRetry && <button type="button" disabled={paying} onClick={() => void payAgain()} className="mt-6 flex min-h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white disabled:opacity-60">{paying ? "در حال انتقال به درگاه…" : "پرداخت دوباره"}</button>}
    {message && <div className="mt-5 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{message}</div>}
    <Link to={`/store/${siteProjectId}`} className="mt-7 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-black text-white"><Storefront /> بازگشت به فروشگاه</Link>
  </div></main>;
}
