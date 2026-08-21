import { assertContentMediaEnabled } from "./media-types.mjs";
import { contentChannelRegistry } from "./channel-registry.mjs";

const DEFAULT_PLACEMENTS = [
  { placementId: "instagram.feed.text", placementVersion: 1, channel: "instagram", displayName: "Instagram Feed", mediaType: "TEXT", productionEnabled: true, textConstraints: { maximumCharacters: 3000, maximumHashtags: 15 } },
  { placementId: "google_ads.search.text", placementVersion: 1, channel: "google_ads", displayName: "Google Search Ad", mediaType: "TEXT", productionEnabled: true, textConstraints: { maximumHeadlineCharacters: 30, maximumDescriptionCharacters: 90, maximumHeadlines: 3, maximumDescriptions: 2 } },
  { placementId: "email.marketing.text", placementVersion: 1, channel: "email", displayName: "Marketing Email", mediaType: "TEXT", productionEnabled: true, textConstraints: { maximumCharacters: 5000 } },
  { placementId: "blog.article.text", placementVersion: 1, channel: "blog", displayName: "Blog / SEO Outline", mediaType: "TEXT", productionEnabled: true, textConstraints: { maximumCharacters: 8000, maximumSections: 10 } },
  { placementId: "website.landing.text", placementVersion: 1, channel: "website", displayName: "Landing Page", mediaType: "TEXT", productionEnabled: true, textConstraints: { maximumCharacters: 10000, maximumSections: 8, maximumFaq: 5 } },
];

function validate(entry, channels) {
  const allowed = ["placementId", "placementVersion", "channel", "displayName", "mediaType", "productionEnabled", "textConstraints"];
  if (!entry || Object.keys(entry).some((key) => !allowed.includes(key)) ||
    typeof entry.placementId !== "string" || !/^[a-z][a-z0-9_.]{0,99}$/.test(entry.placementId) ||
    !Number.isInteger(entry.placementVersion) || entry.placementVersion < 1 ||
    typeof entry.displayName !== "string" || !entry.displayName || entry.displayName.length > 100 ||
    entry.productionEnabled !== true || !entry.textConstraints || typeof entry.textConstraints !== "object") {
    throw new Error("Content placement is invalid.");
  }
  channels.require(entry.channel);
  assertContentMediaEnabled(entry.mediaType);
  return Object.freeze({ ...entry, textConstraints: Object.freeze({ ...entry.textConstraints }) });
}

export function createContentPlacementRegistry(entries = DEFAULT_PLACEMENTS, channels = contentChannelRegistry) {
  const normalized = entries.map((entry) => validate(entry, channels));
  const map = new Map(normalized.map((entry) => [`${entry.placementId}@${entry.placementVersion}`, entry]));
  if (map.size !== normalized.length) throw new Error("Duplicate content placement.");
  return Object.freeze({
    get: (id, version) => map.get(`${id}@${version}`) || null,
    list: () => [...map.values()],
  });
}

export const contentPlacementRegistry = createContentPlacementRegistry();
