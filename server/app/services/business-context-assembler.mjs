export const BUSINESS_CONTEXT_SCHEMA_VERSION = "1.0";

function latestTimestamp(values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

export function createSourceManifest(profile, dna, brandBook) {
  return {
    businessProfile: { id: profile.id, updatedAt: profile.updatedAt },
    businessDna: { id: dna.id, versionNumber: dna.versionNumber },
    brandBook: { id: brandBook.id, versionNumber: brandBook.versionNumber },
  };
}

export function assembleBusinessContext({ profile, dna, brandBook }) {
  const sourceManifest = createSourceManifest(profile, dna, brandBook);
  const brandIdentity = brandBook.brandIdentity || {};
  const assembledAt = latestTimestamp([
    profile.updatedAt,
    dna.activatedAt || dna.updatedAt,
    brandBook.activatedAt || brandBook.updatedAt,
  ]);

  return {
    snapshot: {
      identity: {
        businessName: profile.name || null,
        legalName: profile.legalName || null,
        industry: profile.industry || null,
        subindustry: profile.subindustry || null,
        location: {
          country: profile.country || null,
          city: profile.city || null,
        },
        website: profile.website || null,
        description: profile.description || null,
        primaryLanguage: profile.primaryLanguage || null,
        timezone: profile.timezone || null,
      },
      strategy: {
        valueProposition: dna.valueProposition || null,
        positioning: dna.positioning || null,
        differentiators: dna.differentiators || [],
        goals: dna.goals || [],
        constraints: dna.constraints || [],
        growthDrivers: dna.growthDrivers || [],
      },
      audiences: {
        targetAudiences:
          dna.targetAudiences?.length
            ? dna.targetAudiences
            : brandIdentity.audience
              ? [brandIdentity.audience]
              : [],
        audienceProblems: brandIdentity.audienceProblem
          ? [brandIdentity.audienceProblem]
          : [],
      },
      offerings: dna.offerings || [],
      brand: {
        personality: brandBook.brandPersonality || [],
        voice: dna.brandVoice || null,
        tone: brandBook.toneOfVoice || null,
        messagingPrinciples: brandBook.messagingPrinciples || [],
        keyPhrases: brandBook.keyPhrases || [],
        promises: brandBook.brandPromises || [],
        prohibitedPatterns: brandBook.prohibitedPatterns || [],
      },
      visual: {
        direction: brandBook.visualDirection || null,
        colors: {
          primary: brandBook.primaryColors || [],
          secondary: brandBook.secondaryColors || [],
        },
        typography: brandBook.typography || {},
        logoRules: brandBook.logoUsageNotes || null,
        imageryDirection: brandBook.imageryDirection || null,
      },
      metadata: {
        contextSchemaVersion: BUSINESS_CONTEXT_SCHEMA_VERSION,
        sourceVersions: sourceManifest,
        assembledAt,
      },
    },
    sourceManifest,
  };
}
