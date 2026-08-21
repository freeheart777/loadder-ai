import { requireWorkspaceId } from "../tenant-context.mjs";

export class BusinessDnaError extends Error {
  constructor(message, status = 400, code = "INVALID_BUSINESS_DNA") {
    super(message);
    this.name = "BusinessDnaError";
    this.status = status;
    this.code = code;
  }
}

const textFields = {
  valueProposition: 4000,
  positioning: 4000,
  brandVoice: 2000,
};
const listFields = new Set([
  "targetAudiences", "offerings", "differentiators",
  "goals", "constraints", "growthDrivers",
]);

function validate(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BusinessDnaError("Invalid Business DNA payload.");
  }
  if (Object.hasOwn(payload, "workspaceId") || Object.hasOwn(payload, "workspace_id")) {
    throw new BusinessDnaError(
      "Workspace is resolved from the authenticated session.",
      400,
      "WORKSPACE_FIELD_FORBIDDEN"
    );
  }
  const values = {};
  for (const [field, max] of Object.entries(textFields)) {
    if (!Object.hasOwn(payload, field)) continue;
    if (payload[field] === null || payload[field] === "") {
      values[field] = null;
    } else if (typeof payload[field] !== "string" || payload[field].trim().length > max) {
      throw new BusinessDnaError(`${field} is invalid or too long.`);
    } else {
      values[field] = payload[field].trim();
    }
  }
  for (const field of listFields) {
    if (!Object.hasOwn(payload, field)) continue;
    if (!Array.isArray(payload[field]) || payload[field].length > 50) {
      throw new BusinessDnaError(`${field} must be an array with at most 50 items.`);
    }
    values[field] = payload[field].map((item) => {
      if (typeof item !== "string" || !item.trim() || item.trim().length > 500) {
        throw new BusinessDnaError(`${field} contains an invalid item.`);
      }
      return item.trim();
    });
  }
  if (partial && !Object.keys(values).length) {
    throw new BusinessDnaError("No supported fields were provided.");
  }
  return values;
}

const emptyDna = {
  valueProposition: null,
  targetAudiences: [],
  offerings: [],
  positioning: null,
  differentiators: [],
  goals: [],
  constraints: [],
  brandVoice: null,
  growthDrivers: [],
};

export function createBusinessDnaService({ repository, auditRepository, now = () => new Date() }) {
  function audit(userId, action, version, metadata = {}) {
    auditRepository.createAuditLog({
      workspaceId: requireWorkspaceId(),
      userId,
      action,
      resourceType: "business_dna_version",
      resourceId: version.id,
      metadata: { versionNumber: version.versionNumber, ...metadata },
      createdAt: now().toISOString(),
    });
  }

  return {
    getCurrent() {
      return {
        activeVersion: repository.getActiveVersion(),
        latestDraft: repository.getLatestDraft(),
      };
    },
    listVersions: () => repository.listVersions(),
    createDraft(payload, userId) {
      const validated = validate(payload);
      const values = { ...emptyDna, ...validated };
      const version = repository.createDraft(values, userId, now().toISOString());
      if (!version) {
        throw new BusinessDnaError(
          "Create a Business Profile before creating Business DNA.",
          409,
          "BUSINESS_PROFILE_REQUIRED"
        );
      }
      audit(userId, "business_dna.version_created", version, {
        changedFields: Object.keys(validated),
      });
      return version;
    },
    updateDraft(id, payload, userId) {
      const values = validate(payload, { partial: true });
      const existing = repository.getVersion(id);
      if (!existing) throw new BusinessDnaError("Business DNA version not found.", 404, "DNA_NOT_FOUND");
      if (existing.status !== "draft") {
        throw new BusinessDnaError("Only draft versions can be edited.", 409, "DNA_VERSION_IMMUTABLE");
      }
      const version = repository.updateDraft(id, values, now().toISOString());
      audit(userId, "business_dna.draft_updated", version, { changedFields: Object.keys(values) });
      return version;
    },
    activateVersion(id, userId) {
      const existing = repository.getVersion(id);
      if (!existing) throw new BusinessDnaError("Business DNA version not found.", 404, "DNA_NOT_FOUND");
      if (existing.status !== "draft") {
        throw new BusinessDnaError("Only draft versions can be activated.", 409, "DNA_ACTIVATION_INVALID");
      }
      const result = repository.activateVersion(id, now().toISOString());
      audit(userId, "business_dna.version_activated", result.version, {
        previousActiveVersionId: result.previousActiveVersionId,
      });
      return result.version;
    },
    archiveDraft(id, userId) {
      const existing = repository.getVersion(id);
      if (!existing) throw new BusinessDnaError("Business DNA version not found.", 404, "DNA_NOT_FOUND");
      if (existing.status !== "draft") {
        throw new BusinessDnaError("Only draft versions can be archived directly.", 409, "DNA_ARCHIVE_INVALID");
      }
      const version = repository.archiveDraft(id, now().toISOString());
      audit(userId, "business_dna.version_archived", version);
      return version;
    },
  };
}
