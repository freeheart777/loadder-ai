import { AuthError } from "./auth-service.mjs";

// Provider-owned contract: https://github.com/IPeCompany/SmsPanelV2.nodejs
export function createOtpDelivery(env = process.env, fetchImpl = fetch) {
  const key = env.SMS_IR_API_KEY || "";
  const template = Number(env.SMS_IR_OTP_TEMPLATE_ID);
  const parameter = env.SMS_IR_OTP_PARAMETER || "CODE";
  const configured = /^[\x21-\x7e]{8,512}$/.test(key) &&
    /^[1-9]\d*$/.test(env.SMS_IR_OTP_TEMPLATE_ID || "") && Number.isSafeInteger(template) &&
    /^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(parameter);
  return Object.freeze({
    configured,
    async send({ mobile, code }) {
      if (!configured) throw new AuthError("ارسال کد در دسترس نیست.", 503, "OTP_DELIVERY_NOT_CONFIGURED");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetchImpl("https://api.sms.ir/v1/send/verify", {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { "Content-Type": "application/json", "X-API-KEY": key },
          body: JSON.stringify({ mobile, templateId: template, parameters: [{ name: parameter, value: code }] }),
        });
        if (!response.ok) { await response.body?.cancel(); throw new Error("rejected"); }
        // Bound response memory and never retain/log provider messages or raw payloads.
        const reader = response.body.getReader();
        let text = "", size = 0;
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 8192) { await reader.cancel(); throw new Error("oversized"); }
          text += decoder.decode(value, { stream: true });
        }
        const result = JSON.parse(text + decoder.decode());
        if (result.status !== 1 || !Number.isSafeInteger(result.data?.messageId) || result.data.messageId <= 0) throw new Error("rejected");
      } catch {
        throw new AuthError("ارسال کد ناموفق بود؛ کمی بعد دوباره تلاش کنید.", 503, "OTP_DELIVERY_FAILED");
      } finally { clearTimeout(timer); }
    },
  });
}
