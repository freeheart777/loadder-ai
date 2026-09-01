const ARCHETYPE_BY_SITE_TYPE = Object.freeze({
  STORE: "store",
  BUSINESS: "corporate",
  MEDICAL: "doctor",
  LEGAL: "lawyer",
  NEWS: "custom",
});

const CAPABILITIES_BY_ARCHETYPE = Object.freeze({
  store: ["commerce", "catalog", "forms", "analytics", "ads", "landing"],
  corporate: ["lead", "team", "content", "forms", "analytics", "ads", "landing"],
  catalog: ["catalog", "lead", "forms", "analytics", "ads", "landing"],
  doctor: ["booking", "lead", "location", "content", "forms", "analytics", "ads", "landing"],
  lawyer: ["booking", "lead", "team", "content", "forms", "analytics", "ads", "landing"],
  custom: ["forms", "analytics", "landing"],
});

export function websiteArchetypeForSiteType(siteType) {
  return ARCHETYPE_BY_SITE_TYPE[String(siteType || "").toUpperCase()] || "custom";
}

export function createWebsitePlatformDefinition({ siteType, name, existing }) {
  if (existing && existing.schemaVersion === 1 && Array.isArray(existing.pages)) return existing;
  const archetype = websiteArchetypeForSiteType(siteType);
  return {
    schemaVersion: 1,
    archetype,
    capabilities: [...CAPABILITIES_BY_ARCHETYPE[archetype]],
    brandContext: {
      businessName: typeof name === "string" && name.trim() ? name.trim() : undefined,
      provenance: [],
    },
    pages: [
      {
        id: "home",
        slug: "",
        title: "خانه",
        kind: "standard",
        enabled: true,
      },
    ],
    integrations: { analytics: [], ads: [] },
    conversionGoals: [],
  };
}

export function ensureWebsitePlatformContent(content, { siteType, name } = {}) {
  const source = content && typeof content === "object" && !Array.isArray(content) ? content : {};
  return {
    ...source,
    websitePlatform: createWebsitePlatformDefinition({
      siteType,
      name,
      existing: source.websitePlatform,
    }),
  };
}
