import express from "express";
import rateLimit from "express-rate-limit";
import { PaymentOrderError } from "../services/payment-order-service.mjs";

export function createPaymentOrderRouter({ service, customerReturnBaseUrl = "" }) {
  const router = express.Router();
  const limiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
  const token = (request) => request.headers["x-cart-token"];
  const key = (request) => request.headers["idempotency-key"];
  const run = (response, operation, status = 200) => {
    try {
      const result = operation();
      return response.status(result.reusedResult ? 200 : status).json({ success: true, ...result });
    } catch (error) {
      return response.status(error instanceof PaymentOrderError ? error.status : 500).json({ success: false, code: error instanceof PaymentOrderError ? error.code : "PAYMENT_ATTEMPT_INVALID", message: "Payment operation could not be completed." });
    }
  };
  const bounded = (request, response, next) => JSON.stringify(request.body || {}).length > 8192 || JSON.stringify(request.query || {}).length > 2048 ? response.status(413).json({ success: false, code: "PAYMENT_INPUT_TOO_LARGE", message: "Payment operation could not be completed." }) : next();

  router.use((_request, response, next) => { response.set("Cache-Control", "no-store"); response.set("Pragma", "no-cache"); next(); });
  router.use("/api/public/commerce/payments", limiter);
  router.use("/api/public/commerce/confirmed-orders", limiter);
  router.get("/api/public/commerce/payments/readiness", (_request, response) => run(response, () => service.readiness()));
  router.post("/api/public/commerce/payments", (request, response) => bounded(request, response, () => run(response, () => service.initiate(token(request), request.body, key(request)), 201)));
  router.get("/api/public/commerce/payments/:id/status", (request, response) => bounded(request, response, () => run(response, () => service.status(token(request), request.params.id))));
  router.post("/api/public/commerce/payments/:id/verify", (request, response) => bounded(request, response, () => run(response, () => service.retry(token(request), request.params.id))));
  router.get("/api/public/commerce/payments/return", (request, response) => bounded(request, response, () => {
    const attempt = typeof request.query.attempt === "string" ? request.query.attempt : "";
    try { service.returnSignal({ attempt, status: request.query.status }); } catch {}
    return response.redirect(303, `${customerReturnBaseUrl}/store/payment?attempt=${encodeURIComponent(attempt)}`);
  }));
  router.get("/api/public/commerce/confirmed-orders/:ref", (request, response) => run(response, () => service.order(token(request), request.params.ref)));
  return router;
}
