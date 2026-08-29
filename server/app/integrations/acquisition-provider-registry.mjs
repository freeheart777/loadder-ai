const PROVIDERS = [
  {
    providerId: "google_ads",
    version: 1,
    name: "Google Ads",
    category: "advertising",
    regions: ["GLOBAL"],
    auth: {
      type: "oauth2",
      requiresDeveloperCredential: true,
      accountSelection: true,
    },
    capabilities: [
      "CONNECT_ACCOUNT",
      "READ_CAMPAIGNS",
      "READ_METRICS",
      "CREATE_CAMPAIGN",
      "UPDATE_CAMPAIGN",
      "UPDATE_BUDGET",
      "PAUSE_CAMPAIGN",
    ],
    executionPolicy: "explicit_user_authorization",
  },
  {
    providerId: "sms_ir",
    version: 1,
    name: "SMS.ir",
    category: "messaging",
    regions: ["IRAN"],
    auth: {
      type: "api_key",
      requiresDeveloperCredential: false,
      accountSelection: false,
    },
    capabilities: [
      "CONNECT_ACCOUNT",
      "SEND_SMS",
      "SEND_VERIFY",
      "READ_DELIVERY_STATUS",
    ],
    executionPolicy: "explicit_user_authorization",
  },
];

function normalizeProvider(input) {
  if (!input || typeof input.providerId !== "string" || !input.providerId.trim()) {
    throw new Error("Acquisition provider id is required.");
  }
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new Error("Acquisition provider version is invalid.");
  }
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) {
    throw new Error("Acquisition provider capabilities are required.");
  }
  return Object.freeze({
    ...input,
    regions: Object.freeze([...(input.regions || [])]),
    capabilities: Object.freeze([...input.capabilities]),
    auth: Object.freeze({ ...(input.auth || {}) }),
  });
}

export function createAcquisitionProviderRegistry(entries = PROVIDERS) {
  const providers = new Map();
  for (const provider of entries.map(normalizeProvider)) {
    const key = `${provider.providerId}@${provider.version}`;
    if (providers.has(key)) throw new Error(`Duplicate acquisition provider: ${key}`);
    providers.set(key, provider);
  }

  return Object.freeze({
    get(providerId, version = 1) {
      return providers.get(`${providerId}@${version}`) || null;
    },
    list({ region, category } = {}) {
      return [...providers.values()].filter((provider) =>
        (!region || provider.regions.includes(region) || provider.regions.includes("GLOBAL")) &&
        (!category || provider.category === category)
      );
    },
  });
}

export const acquisitionProviderRegistry = createAcquisitionProviderRegistry();
