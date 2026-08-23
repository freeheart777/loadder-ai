import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Attempt = { paymentAttemptId: string; status: string; failureCode?: string };
type Fulfillment = { status: string; processingStatus: string; shipmentStatus: string | null; trackingNumber: string | null };
type OrderItem = { id: string; productName: string; quantity: number };
const call = async (path: string, init: RequestInit = {}) => { const token = localStorage.getItem("loadder-commerce-cart") || ""; const response = await fetch(path, { ...init, headers: { "content-type": "application/json", "X-Cart-Token": token, ...init.headers } }); const result = await response.json(); if (!response.ok) throw Error(result.code || "PAYMENT_ATTEMPT_INVALID"); return result; };

export default function CommercePaymentPage() {
  const [params] = useSearchParams();
  const attemptId = params.get("attempt") || "";
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [order, setOrder] = useState<{ publicReference: string } | null>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [returnStatus, setReturnStatus] = useState("");
  const [message, setMessage] = useState("پرداخت در حال بررسی");
  const load = useCallback(async () => { try { const result = await call(`/api/public/commerce/payments/${encodeURIComponent(attemptId)}/status`); setAttempt(result.attempt); setOrder(result.order || null); setFulfillment(result.fulfillment || null); if (result.order?.publicReference) { const detail = await call(`/api/public/commerce/confirmed-orders/${encodeURIComponent(result.order.publicReference)}`); setOrderItems(detail.items || []); const returns = await call(`/api/public/commerce/orders/${encodeURIComponent(result.order.publicReference)}/returns`); setReturnStatus(returns.returnRequests?.[0]?.status || ""); } setMessage(result.attempt.status === "VERIFIED" ? "پرداخت موفق" : result.attempt.status === "FAILED" ? "پرداخت ناموفق" : "وضعیت پرداخت نامشخص / دوباره بررسی شود"); } catch { setMessage("وضعیت پرداخت نامشخص / دوباره بررسی شود"); } }, [attemptId]);
  const retry = async () => { setMessage("پرداخت در حال بررسی"); try { await call(`/api/public/commerce/payments/${encodeURIComponent(attemptId)}/verify`, { method: "POST" }); } catch {} await load(); };
  const requestReturn = async () => { if (!order || !orderItems[0]) return; try { const result = await call("/api/public/commerce/returns", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ orderReference: order.publicReference, reasonCode: "OTHER", reasonNote: null, items: [{ orderItemId: orderItems[0].id, quantity: 1 }] }) }); setReturnStatus(result.returnRequest.status); } catch (error) { setReturnStatus(error instanceof Error ? error.message : "RETURN_NOT_ALLOWED"); } };
  useEffect(() => { if (attemptId) void load(); else setMessage("وضعیت پرداخت نامشخص / دوباره بررسی شود"); }, [attemptId, load]);
  const fulfillmentLabel = fulfillment?.processingStatus === "INVENTORY_EXCEPTION" ? "سفارش پرداخت‌شده نیازمند بررسی موجودی است" : fulfillment?.shipmentStatus === "DELIVERED" ? "تحویل شده" : fulfillment?.shipmentStatus === "IN_TRANSIT" ? "ارسال شده" : fulfillment?.status === "READY_TO_SHIP" ? "آماده ارسال" : fulfillment ? "در حال آماده‌سازی" : null;
  return <main dir="rtl" className="min-h-screen bg-[#050507] p-4 text-white"><section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[.03] p-6 text-center"><h1 className="text-2xl font-bold">وضعیت پرداخت</h1><p className="mt-5 text-lg">{message}</p>{fulfillmentLabel && <p className="mt-3 rounded-xl bg-white/5 p-3">{fulfillmentLabel}</p>}{fulfillment?.trackingNumber && <p dir="ltr" className="mt-3 font-mono text-sm">{fulfillment.trackingNumber}</p>}{order && <p dir="ltr" className="mt-3 font-mono text-sm">{order.publicReference}</p>}{returnStatus && <p className="mt-3 rounded-xl border border-white/10 p-3">وضعیت مرجوعی: {returnStatus}</p>}{fulfillment?.shipmentStatus === "DELIVERED" && !returnStatus && orderItems.length > 0 && <button onClick={() => void requestReturn()} className="mt-5 min-h-12 w-full rounded-xl border border-violet-400">ثبت درخواست مرجوعی برای یک عدد از اولین کالا</button>}{attempt && attempt.status !== "VERIFIED" && <button onClick={() => void retry()} className="mt-5 min-h-12 w-full rounded-xl bg-violet-600">بررسی دوباره پرداخت</button>}<Link to="/store/cart" className="mt-4 block min-h-11 rounded-xl border border-white/10 p-3">بازگشت به سفارش</Link></section></main>;
}
