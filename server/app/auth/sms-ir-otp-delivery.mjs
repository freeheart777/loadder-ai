export class OtpDeliveryError extends Error {
  constructor(code) {
    super(code);
    this.name = "OtpDeliveryError";
    this.code = code;
  }
}

const ENDPOINT = "https://api.sms.ir/v1/send/verify";

function deliveryErrorForStatus(status) {
  if (status === 400) return "OTP_DELIVERY_REJECTED";
  if (status === 401 || status === 403) return "OTP_DELIVERY_UNAUTHORIZED";
  if (status === 429) return "OTP_DELIVERY_RATE_LIMITED";
  if (status >= 500) return "OTP_DELIVERY_UNAVAILABLE";
  return "OTP_DELIVERY_PROVIDER_ERROR";
}

export function createSmsIrOtpDelivery({
  apiKey = "",
  templateId = null,
  parameterName = "CODE",
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000,
} = {}) {
  const normalizedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const validTemplateId = Number.isSafeInteger(templateId) && templateId > 0;
  const validParameter =
    typeof parameterName === "string" &&
    /^[A-Z][A-Z0-9_]{0,31}$/.test(parameterName);
  const configured =
    normalizedApiKey.length > 0 &&
    validTemplateId &&
    validParameter &&
    typeof fetchImpl === "function";
  let liveValidated = false;

  return Object.freeze({
    provider: "SMS_IR",
    get configured() {
      return configured;
    },
    readiness() {
      return Object.freeze({
        provider: "SMS_IR",
        configured,
        state: configured
          ? liveValidated
            ? "LIVE_VALIDATED"
            : "CODE_READY_LIVE_VALIDATION_PENDING"
          : "NOT_CONFIGURED",
        productionReady: configured && liveValidated,
      });
    },
    markLiveValidated() {
      if (configured) liveValidated = true;
    },
    async sendOtp({ mobile, code }) {
      if (!configured) throw new OtpDeliveryError("OTP_DELIVERY_UNAVAILABLE");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(
          ENDPOINT,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": normalizedApiKey,
            },
            body: JSON.stringify({
              mobile,
              templateId,
              parameters: [{ name: parameterName, value: code }],
            }),
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new OtpDeliveryError(deliveryErrorForStatus(response.status));
        }
        let payload;
        try {
          payload = await response.json();
        } catch {
          throw new OtpDeliveryError("OTP_DELIVERY_PROVIDER_ERROR");
        }
        if (!payload || typeof payload !== "object" || payload.status !== 1) {
          throw new OtpDeliveryError("OTP_DELIVERY_REJECTED");
        }
        return Object.freeze({ provider: "SMS_IR", delivered: true });
      } catch (error) {
        if (error instanceof OtpDeliveryError) throw error;
        if (controller.signal.aborted || error?.name === "AbortError") {
          throw new OtpDeliveryError("OTP_DELIVERY_TIMEOUT");
        }
        throw new OtpDeliveryError("OTP_DELIVERY_PROVIDER_ERROR");
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

export function createDevelopmentOtpDelivery() {
  return Object.freeze({
    provider: "DEVELOPMENT",
    configured: true,
    readiness: () =>
      Object.freeze({
        provider: "DEVELOPMENT",
        configured: true,
        state: "LIVE_VALIDATED",
        productionReady: false,
      }),
    markLiveValidated() {},
    async sendOtp() {
      return Object.freeze({ provider: "DEVELOPMENT", delivered: true });
    },
  });
}
