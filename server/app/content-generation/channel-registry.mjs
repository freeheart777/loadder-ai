const CHANNEL_ID = /^[a-z][a-z0-9_]{0,49}$/;
const DEFAULT_CHANNELS = ["instagram", "google_ads", "email", "blog", "website"];

export function createContentChannelRegistry(channels = DEFAULT_CHANNELS) {
  if (!Array.isArray(channels) || channels.some((item) => typeof item !== "string" || !CHANNEL_ID.test(item))) {
    throw new Error("Content channel registry is invalid.");
  }
  const map = new Map(channels.map((channel) => [channel, Object.freeze({ channel, productionEnabled: true })]));
  if (map.size !== channels.length) throw new Error("Duplicate content channel.");
  return Object.freeze({
    get: (channel) => map.get(channel) || null,
    require(channel) {
      const entry = map.get(channel);
      if (!entry) throw new Error("Unknown content channel.");
      return entry;
    },
    list: () => [...map.values()],
  });
}

export const contentChannelRegistry = createContentChannelRegistry();
