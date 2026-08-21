const REGIONS = new Set(["GLOBAL", "IRAN", "MENA"]);
const CATEGORIES = new Set(["WEB", "SOCIAL"]);

const definitions = [
  { sourceId: "manual_public_feed", version: 1, category: "WEB", regions: ["GLOBAL", "IRAN", "MENA"], capabilities: ["READ_PUBLIC_CONTENT"], ingestionMode: "supplied_records", runtimeAvailable: true },
  { sourceId: "public_rss_atom", version: 1, category: "WEB", regions: ["GLOBAL", "IRAN", "MENA"], capabilities: ["READ_PUBLIC_FEED"], ingestionMode: "official_feed", runtimeAvailable: false },
  { sourceId: "google_reviews", version: 1, category: "WEB", regions: ["GLOBAL"], capabilities: ["READ_REVIEWS"], ingestionMode: "official_api", runtimeAvailable: false },
  { sourceId: "reddit", version: 1, category: "SOCIAL", regions: ["GLOBAL"], capabilities: ["READ_PUBLIC_CONTENT"], ingestionMode: "official_api", runtimeAvailable: false },
  { sourceId: "youtube", version: 1, category: "SOCIAL", regions: ["GLOBAL", "MENA"], capabilities: ["READ_PUBLIC_CONTENT", "READ_ENGAGEMENT"], ingestionMode: "official_api", runtimeAvailable: false },
  { sourceId: "instagram", version: 1, category: "SOCIAL", regions: ["GLOBAL", "MENA"], capabilities: ["READ_PUBLIC_CONTENT", "READ_ENGAGEMENT"], ingestionMode: "official_api", runtimeAvailable: false },
  { sourceId: "linkedin", version: 1, category: "SOCIAL", regions: ["GLOBAL", "MENA"], capabilities: ["READ_PUBLIC_CONTENT"], ingestionMode: "official_api", runtimeAvailable: false },
  { sourceId: "x", version: 1, category: "SOCIAL", regions: ["GLOBAL", "MENA"], capabilities: ["READ_PUBLIC_CONTENT"], ingestionMode: "official_api", runtimeAvailable: false },
  { sourceId: "tiktok", version: 1, category: "SOCIAL", regions: ["GLOBAL", "MENA"], capabilities: ["READ_PUBLIC_CONTENT", "READ_ENGAGEMENT"], ingestionMode: "official_api", runtimeAvailable: false },
  { sourceId: "aparat", version: 1, category: "SOCIAL", regions: ["IRAN"], capabilities: ["READ_PUBLIC_CONTENT", "READ_ENGAGEMENT"], ingestionMode: "permitted_api", runtimeAvailable: false },
  { sourceId: "telegram_compatible", version: 1, category: "SOCIAL", regions: ["IRAN", "MENA"], capabilities: ["READ_PERMITTED_PUBLIC_CONTENT"], ingestionMode: "permitted_api", runtimeAvailable: false },
];

export function createListeningSourceRegistry(entries = definitions) {
  const map = new Map();
  for (const item of entries) {
    if (!item.sourceId || !Number.isInteger(item.version) || item.version < 1) throw new Error("Listening source identity is invalid.");
    if (!CATEGORIES.has(item.category)) throw new Error("Listening source category is invalid.");
    if (!Array.isArray(item.regions) || item.regions.some((x) => !REGIONS.has(x))) throw new Error("Listening source regions are invalid.");
    if (!Array.isArray(item.capabilities) || item.capabilities.some((x) => !x.startsWith("READ_"))) throw new Error("Listening sources must remain read-only.");
    const key = `${item.sourceId}@${item.version}`;
    if (map.has(key)) throw new Error("Duplicate listening source definition.");
    map.set(key, Object.freeze({ ...item, regions: Object.freeze([...item.regions]), capabilities: Object.freeze([...item.capabilities]) }));
  }
  return Object.freeze({
    get: (id, version = 1) => map.get(`${id}@${version}`) || null,
    list: ({ region } = {}) => [...map.values()].filter((x) => !region || x.regions.includes(region)),
  });
}

export const listeningSourceRegistry = createListeningSourceRegistry();
