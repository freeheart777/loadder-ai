import { requireWorkspaceId } from "../tenant-context.mjs";

export class BrandBookError extends Error {
  constructor(message, status = 400, code = "INVALID_BRAND_BOOK") {
    super(message);
    this.name = "BrandBookError";
    this.status = status;
    this.code = code;
  }
}

const textFields = {
  toneOfVoice: 3000,
  visualDirection: 4000,
  logoUsageNotes: 4000,
  imageryDirection: 4000,
};
const listFields = new Set([
  "brandPersonality", "messagingPrinciples", "primaryColors",
  "secondaryColors", "prohibitedPatterns", "keyPhrases", "brandPromises",
]);
const brandIdentityKeys = new Set([
  "name", "industry", "description", "audience", "audienceProblem",
  "valueProposition", "differentiation", "competitors", "competitorDifference",
]);
const typographyKeys = new Set(["primary", "secondary", "notes"]);

function validateObject(value, allowedKeys, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrandBookError(`${field} must be an object.`);
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!allowedKeys.has(key) || typeof entry !== "string" || entry.trim().length > 4000) {
      throw new BrandBookError(`${field}.${key} is invalid or too long.`);
    }
    result[key] = entry.trim();
  }
  return result;
}

function validate(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BrandBookError("Invalid Brand Book payload.");
  }
  if (Object.hasOwn(payload, "workspaceId") || Object.hasOwn(payload, "workspace_id")) {
    throw new BrandBookError(
      "Workspace is resolved from the authenticated session.",
      400,
      "WORKSPACE_FIELD_FORBIDDEN"
    );
  }
  const values = {};
  if (Object.hasOwn(payload, "brandIdentity")) {
    values.brandIdentity = validateObject(payload.brandIdentity, brandIdentityKeys, "brandIdentity");
  }
  if (Object.hasOwn(payload, "typography")) {
    values.typography = validateObject(payload.typography, typographyKeys, "typography");
  }
  for (const [field, max] of Object.entries(textFields)) {
    if (!Object.hasOwn(payload, field)) continue;
    if (payload[field] === null || payload[field] === "") values[field] = null;
    else if (typeof payload[field] !== "string" || payload[field].trim().length > max) {
      throw new BrandBookError(`${field} is invalid or too long.`);
    } else values[field] = payload[field].trim();
  }
  for (const field of listFields) {
    if (!Object.hasOwn(payload, field)) continue;
    if (!Array.isArray(payload[field]) || payload[field].length > 50) {
      throw new BrandBookError(`${field} must be an array with at most 50 items.`);
    }
    values[field] = payload[field].map((item) => {
      if (typeof item !== "string" || !item.trim() || item.trim().length > 500) {
        throw new BrandBookError(`${field} contains an invalid item.`);
      }
      return item.trim();
    });
  }
  if (partial && !Object.keys(values).length) {
    throw new BrandBookError("No supported fields were provided.");
  }
  return values;
}

const emptyBrandBook = {
  brandIdentity: {},
  brandPersonality: [],
  toneOfVoice: null,
  messagingPrinciples: [],
  visualDirection: null,
  primaryColors: [],
  secondaryColors: [],
  typography: {},
  logoUsageNotes: null,
  imageryDirection: null,
  prohibitedPatterns: [],
  keyPhrases: [],
  brandPromises: [],
};

export function createBrandBookService({ repository, auditRepository, now = () => new Date() }) {
  function audit(userId, action, version, metadata = {}) {
    auditRepository.createAuditLog({
      workspaceId: requireWorkspaceId(),
      userId,
      action,
      resourceType: "brand_book_version",
      resourceId: version.id,
      metadata: { versionNumber: version.versionNumber, ...metadata },
      createdAt: now().toISOString(),
    });
  }

  return {
    getCurrent: () => ({
      activeVersion: repository.getActiveVersion(),
      latestDraft: repository.getLatestDraft(),
    }),
    listVersions: () => repository.listVersions(),
    createDraft(payload, userId) {
      const validated = validate(payload);
      const version = repository.createDraft(
        { ...emptyBrandBook, ...validated }, userId, now().toISOString()
      );
      if (!version) {
        throw new BrandBookError(
          "Create a Business Profile before creating a Brand Book.",
          409,
          "BUSINESS_PROFILE_REQUIRED"
        );
      }
      audit(userId, "brand_book.version_created", version, {
        changedFields: Object.keys(validated),
      });
      return version;
    },
    updateDraft(id, payload, userId) {
      const values = validate(payload, { partial: true });
      const existing = repository.getVersion(id);
      if (!existing) throw new BrandBookError("Brand Book version not found.", 404, "BRAND_BOOK_NOT_FOUND");
      if (existing.status !== "draft") {
        throw new BrandBookError("Only draft versions can be edited.", 409, "BRAND_BOOK_IMMUTABLE");
      }
      const version = repository.updateDraft(id, values, now().toISOString());
      audit(userId, "brand_book.draft_updated", version, { changedFields: Object.keys(values) });
      return version;
    },
    activateVersion(id, userId) {
      const existing = repository.getVersion(id);
      if (!existing) throw new BrandBookError("Brand Book version not found.", 404, "BRAND_BOOK_NOT_FOUND");
      if (existing.status !== "draft") {
        throw new BrandBookError("Only draft versions can be activated.", 409, "BRAND_BOOK_ACTIVATION_INVALID");
      }
      const result = repository.activateVersion(id, now().toISOString());
      audit(userId, "brand_book.version_activated", result.version, {
        previousActiveVersionId: result.previousActiveVersionId,
      });
      return result.version;
    },
    archiveDraft(id, userId) {
      const existing = repository.getVersion(id);
      if (!existing) throw new BrandBookError("Brand Book version not found.", 404, "BRAND_BOOK_NOT_FOUND");
      if (existing.status !== "draft") {
        throw new BrandBookError("Only draft versions can be archived directly.", 409, "BRAND_BOOK_ARCHIVE_INVALID");
      }
      const version = repository.archiveDraft(id, now().toISOString());
      audit(userId, "brand_book.version_archived", version);
      return version;
    },
  };
}
