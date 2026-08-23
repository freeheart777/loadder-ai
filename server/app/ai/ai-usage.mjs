const token = (value) => Number.isInteger(value) && value >= 0 && value <= 100_000_000 ? value : null;

export function normalizeAiUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return Object.freeze({ inputTokens: null, outputTokens: null, totalTokens: null, cachedInputTokens: null, reasoningTokens: null });
  return Object.freeze({
    inputTokens: token(usage.input_tokens),
    outputTokens: token(usage.output_tokens),
    totalTokens: token(usage.total_tokens),
    cachedInputTokens: token(usage.input_tokens_details?.cached_tokens),
    reasoningTokens: token(usage.output_tokens_details?.reasoning_tokens),
  });
}
