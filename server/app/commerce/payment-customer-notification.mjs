import { sendMessage } from "../../services/messaging.mjs";

// Customer SMS after a real settlement (wired as verifyAndSettle's onSettled). Best effort:
// callers never await it for the payment outcome. Uses the phone the customer gave at checkout.
export async function notifyCustomerPaid({ db, workspaceId, orderId, refId }) {
  const row = db.prepare("SELECT shipping_address_json FROM ecommerce_orders WHERE id=? AND workspace_id=?").get(orderId, workspaceId);
  let phone = null;
  try { phone = JSON.parse(row?.shipping_address_json || "{}").phone || null; } catch { /* no phone */ }
  if (!phone) { console.info(`Customer payment SMS skipped for order ${orderId}: no phone.`); return; }
  const result = await sendMessage({
    channel: "sms",
    recipient: String(phone),
    message: `پرداخت سفارش شما با موفقیت انجام شد.\nشماره سفارش: ${orderId}\nکد پیگیری: ${refId}`,
    metadata: { orderId, kind: "customer-payment-confirmation" },
  });
  console.info(`Customer payment SMS ${result?.status || "sent"} for order ${orderId}.`);
}
