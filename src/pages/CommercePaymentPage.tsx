import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Attempt = { paymentAttemptId: string; status: string; failureCode?: string };
const call = async (path: string, init: RequestInit = {}) => { const token = localStorage.getItem("loadder-commerce-cart") || ""; const response = await fetch(path, { ...init, headers: { "content-type": "application/json", "X-Cart-Token": token, ...init.headers } }); const result = await response.json(); if (!response.ok) throw Error(result.code || "PAYMENT_ATTEMPT_INVALID"); return result; };

export default function CommercePaymentPage() {
  const [params] = useSearchParams();
  const attemptId = params.get("attempt") || "";
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [order, setOrder] = useState<{ publicReference: string } | null>(null);
  const [message, setMessage] = useState("پرداخت در حال بررسی");
  const load = useCallback(async () => { try { const result = await call(`/api/public/commerce/payments/${encodeURIComponent(attemptId)}/status`); setAttempt(result.attempt); setOrder(result.order || null); setMessage(result.attempt.status === "VERIFIED" ? "پرداخت موفق" : result.attempt.status === "FAILED" ? "پرداخت ناموفق" : "وضعیت پرداخت نامشخص / دوباره بررسی شود"); } catch { setMessage("وضعیت پرداخت نامشخص / دوباره بررسی شود"); } }, [attemptId]);
  const retry = async () => { setMessage("پرداخت در حال بررسی"); try { await call(`/api/public/commerce/payments/${encodeURIComponent(attemptId)}/verify`, { method: "POST" }); } catch {} await load(); };
  useEffect(() => { if (attemptId) void load(); else setMessage("وضعیت پرداخت نامشخص / دوباره بررسی شود"); }, [attemptId, load]);
  return <main dir="rtl" className="min-h-screen bg-[#050507] p-4 text-white"><section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[.03] p-6 text-center"><h1 className="text-2xl font-bold">وضعیت پرداخت</h1><p className="mt-5 text-lg">{message}</p>{order && <p dir="ltr" className="mt-3 font-mono text-sm">{order.publicReference}</p>}{attempt && attempt.status !== "VERIFIED" && <button onClick={() => void retry()} className="mt-5 min-h-12 w-full rounded-xl bg-violet-600">بررسی دوباره پرداخت</button>}<Link to="/store/cart" className="mt-4 block min-h-11 rounded-xl border border-white/10 p-3">بازگشت به سفارش</Link></section></main>;
}
