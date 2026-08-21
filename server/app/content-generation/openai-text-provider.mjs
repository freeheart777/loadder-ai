import OpenAI from "openai";

export class TextProviderError extends Error {
  constructor(code) { super("Text generation provider failed."); this.name = "TextProviderError"; this.code = code; }
}

export function createOpenAITextGenerationProvider({ apiKey = process.env.OPENAI_API_KEY, client = null } = {}) {
  return Object.freeze({
    async generateRegisteredContract({ binding, contract, template }) {
      if (!apiKey && !client) throw new TextProviderError("CONTENT_PROVIDER_UNAVAILABLE");
      const openai = client || new OpenAI({ apiKey });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), binding.providerDeadlineMs);
      try {
        const response = await openai.responses.create({
          model: binding.model,
          reasoning: { effort: binding.reasoningEffort },
          input: [
            { role: "system", content: template.system },
            { role: "user", content: template.user },
          ],
          text: { format: { type: "json_schema", name: `${contract.contractId}_v${contract.contractVersion}`, strict: true, schema: contract.outputSchema } },
          max_output_tokens: Math.min(12_000, Math.max(1_500, Math.ceil(contract.maximumOutputCharacters / 2))),
          store: false,
        }, { signal: controller.signal });
        let output;
        try { output = JSON.parse(response.output_text || ""); }
        catch { throw new TextProviderError("CONTENT_OUTPUT_INVALID"); }
        return Object.freeze({
          output,
          usage: Object.freeze({ inputTokens: response.usage?.input_tokens ?? null, outputTokens: response.usage?.output_tokens ?? null }),
        });
      } catch (error) {
        if (error instanceof TextProviderError) throw error;
        if (controller.signal.aborted || error?.name === "AbortError") throw new TextProviderError("CONTENT_PROVIDER_TIMEOUT");
        throw new TextProviderError("CONTENT_GENERATION_FAILED");
      } finally { clearTimeout(timer); }
    },
  });
}
