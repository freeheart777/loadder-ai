const DEFAULT_TASK_POLICY = Object.freeze({
  business_analysis: ["primary", "secondary", "local"],
  app_architecture: ["primary", "secondary", "local"],
  code_generation: ["primary", "secondary", "local"],
  code_repair: ["secondary", "primary", "local"],
  private_execution: ["local"],
});

export class LoadderAIGatewayError extends Error {
  constructor(message, { attempts = [], cause } = {}) {
    super(message, { cause });
    this.name = "LoadderAIGatewayError";
    this.attempts = attempts;
  }
}

export class LoadderAIGateway {
  constructor({ providers = {}, taskPolicy = DEFAULT_TASK_POLICY, telemetry = () => {} } = {}) {
    this.providers = new Map(Object.entries(providers));
    this.taskPolicy = taskPolicy;
    this.telemetry = telemetry;
  }

  register(id, adapter) {
    if (!id || typeof adapter?.generate !== "function") throw new TypeError("AI provider must expose generate().");
    this.providers.set(id, adapter);
    return this;
  }

  async generate({ task = "business_analysis", input, context = {}, privacy = "standard" }) {
    const route = privacy === "private"
      ? ["local"]
      : (this.taskPolicy[task] || this.taskPolicy.business_analysis);
    const attempts = [];

    for (const providerId of route) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;
      const startedAt = Date.now();
      try {
        const result = await provider.generate({ task, input, context });
        const event = { task, providerId, ok: true, durationMs: Date.now() - startedAt };
        attempts.push(event);
        this.telemetry(event);
        return { ...result, providerId, attempts };
      } catch (error) {
        const event = { task, providerId, ok: false, durationMs: Date.now() - startedAt, error: error?.message || "provider_failed" };
        attempts.push(event);
        this.telemetry(event);
      }
    }

    throw new LoadderAIGatewayError("No Loadder AI provider could complete the task.", { attempts });
  }
}

export function createOpenAICompatibleAdapter({ client, model }) {
  if (!client) throw new TypeError("client is required");
  return {
    async generate({ task, input, context }) {
      const response = await client.responses.create({
        model,
        input: JSON.stringify({ task, input, context }),
      });
      return { text: response.output_text || "", model };
    },
  };
}

export { DEFAULT_TASK_POLICY };
