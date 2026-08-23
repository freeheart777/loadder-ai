export const AI_ERROR_CODES = Object.freeze([
  "AI_PROVIDER_NOT_CONFIGURED",
  "AI_PROVIDER_AUTH_FAILED",
  "AI_PROVIDER_RATE_LIMITED",
  "AI_PROVIDER_TIMEOUT",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_PROVIDER_BAD_RESPONSE",
  "AI_OUTPUT_INVALID",
  "AI_REQUEST_REJECTED",
  "AI_OPERATION_DISABLED",
  "AI_INPUT_INVALID",
]);

const STATUS = Object.freeze({
  AI_PROVIDER_NOT_CONFIGURED: 503,
  AI_PROVIDER_AUTH_FAILED: 503,
  AI_PROVIDER_RATE_LIMITED: 429,
  AI_PROVIDER_TIMEOUT: 504,
  AI_PROVIDER_UNAVAILABLE: 503,
  AI_PROVIDER_BAD_RESPONSE: 502,
  AI_OUTPUT_INVALID: 502,
  AI_REQUEST_REJECTED: 400,
  AI_OPERATION_DISABLED: 403,
  AI_INPUT_INVALID: 400,
});

export class AiProviderError extends Error {
  constructor(code, { providerStatus = null, providerRequestId = null } = {}) {
    super("AI operation could not be completed.");
    this.name = "AiProviderError";
    this.code = AI_ERROR_CODES.includes(code) ? code : "AI_PROVIDER_UNAVAILABLE";
    this.status = STATUS[this.code];
    this.providerStatus = Number.isInteger(providerStatus) ? providerStatus : null;
    this.providerRequestId = typeof providerRequestId === "string" && providerRequestId.length <= 120 ? providerRequestId : null;
  }
}

export function normalizeProviderError(error, signal = null) {
  if (error instanceof AiProviderError) return error;
  if (signal?.aborted || error?.name === "AbortError" || error?.code === "ABORT_ERR" || error?.code === "ETIMEDOUT") return new AiProviderError("AI_PROVIDER_TIMEOUT");
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || "").toLowerCase();
  if (status === 401 || status === 403 || code.includes("invalid_api_key")) return new AiProviderError("AI_PROVIDER_AUTH_FAILED", { providerStatus: status });
  if (status === 429) return new AiProviderError("AI_PROVIDER_RATE_LIMITED", { providerStatus: status });
  if (status >= 400 && status < 500) return new AiProviderError("AI_REQUEST_REJECTED", { providerStatus: status });
  if (status >= 500 || ["econnreset", "econnrefused", "enotfound", "eai_again"].includes(code)) return new AiProviderError("AI_PROVIDER_UNAVAILABLE", { providerStatus: status || null });
  return new AiProviderError("AI_PROVIDER_UNAVAILABLE");
}
