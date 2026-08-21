const DEFAULT_BINDINGS = [{
  bindingId: "openai_text_primary",
  bindingVersion: 1,
  providerKind: "openai",
  model: process.env.OPENAI_CONTENT_MODEL || "gpt-5.6-terra",
  providerDeadlineMs: 25_000,
  reasoningEffort: "low",
}];

export function createTextProviderBindingRegistry(entries = DEFAULT_BINDINGS) {
  const normalized = entries.map((entry) => {
    const fields = ["bindingId", "bindingVersion", "providerKind", "model", "providerDeadlineMs", "reasoningEffort"];
    if (!entry || Object.keys(entry).some((key) => !fields.includes(key)) || fields.some((key) => !Object.hasOwn(entry, key)) ||
      !/^[a-z][a-z0-9_]{0,99}$/.test(entry.bindingId) || !Number.isInteger(entry.bindingVersion) || entry.bindingVersion < 1 ||
      entry.providerKind !== "openai" || typeof entry.model !== "string" || !entry.model || entry.model.length > 120 ||
      !Number.isInteger(entry.providerDeadlineMs) || entry.providerDeadlineMs < 1000 || entry.providerDeadlineMs > 25_000 || entry.reasoningEffort !== "low") throw new Error("Text provider binding is invalid.");
    return Object.freeze({ ...entry });
  });
  const map = new Map(normalized.map((entry) => [entry.bindingVersion, entry]));
  if (map.size !== normalized.length) throw new Error("Duplicate text provider binding.");
  return Object.freeze({ get: (version) => map.get(version) || null, list: () => [...map.values()] });
}

export const textProviderBindingRegistry = createTextProviderBindingRegistry();
