import { requireWorkspaceId } from "../tenant-context.mjs";

export class BusinessProfileError extends Error {
  constructor(message, status = 400, code = "INVALID_BUSINESS_PROFILE") {
    super(message);
    this.name = "BusinessProfileError";
    this.status = status;
    this.code = code;
  }
}

const fieldRules = {
  name: { max: 160, required: true },
  legalName: { max: 200 },
  website: { max: 500 },
  industry: { max: 120 },
  subindustry: { max: 120 },
  description: { max: 4000 },
  country: { max: 100 },
  city: { max: 100 },
  phone: { max: 40 },
  email: { max: 254 },
  timezone: { max: 100 },
  primaryLanguage: { max: 40 },
  status: { max: 20 },
};

function validatePayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BusinessProfileError("Invalid business profile payload.");
  }
  if (Object.hasOwn(payload, "workspace_id") || Object.hasOwn(payload, "workspaceId")) {
    throw new BusinessProfileError(
      "Workspace is resolved from the authenticated session.",
      400,
      "WORKSPACE_FIELD_FORBIDDEN"
    );
  }

  const values = {};
  for (const [field, rule] of Object.entries(fieldRules)) {
    if (!Object.hasOwn(payload, field)) continue;
    if (payload[field] === null || String(payload[field]).trim() === "") {
      if (rule.required) {
        throw new BusinessProfileError("Business name is required.");
      }
      values[field] = null;
      continue;
    }
    if (typeof payload[field] !== "string") {
      throw new BusinessProfileError(`${field} must be a string.`);
    }
    const value = payload[field].trim();
    if (value.length > rule.max) {
      throw new BusinessProfileError(`${field} is too long.`);
    }
    values[field] = value;
  }

  if (!partial && !values.name) {
    throw new BusinessProfileError("Business name is required.");
  }
  if (values.name && values.name.length < 2) {
    throw new BusinessProfileError("Business name is too short.");
  }
  if (values.website) {
    try {
      const url = new URL(values.website);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      values.website = url.toString();
    } catch {
      throw new BusinessProfileError("Website must be a valid HTTP(S) URL.");
    }
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    throw new BusinessProfileError("Email address is invalid.");
  }
  if (values.status && !["active", "inactive"].includes(values.status)) {
    throw new BusinessProfileError("Business profile status is invalid.");
  }
  return values;
}

export function createBusinessProfileService({ repository, auditRepository, now = () => new Date() }) {
  function audit(userId, action, profileId, changedFields) {
    auditRepository.createAuditLog({
      workspaceId: requireWorkspaceId(),
      userId,
      action,
      resourceType: "business_profile",
      resourceId: profileId,
      metadata: { changedFields },
      createdAt: now().toISOString(),
    });
  }

  return {
    getBusinessProfile: () => repository.getBusinessProfile(),
    createBusinessProfile(payload, userId) {
      if (repository.getBusinessProfile()) {
        throw new BusinessProfileError(
          "A business profile already exists for this workspace.",
          409,
          "BUSINESS_PROFILE_EXISTS"
        );
      }
      const validated = validatePayload(payload);
      const values = Object.fromEntries(
        Object.keys(fieldRules).map((field) => [
          field,
          validated[field] ?? (field === "status" ? "active" : null),
        ])
      );
      const profile = repository.createBusinessProfile(values, now().toISOString());
      audit(userId, "business_profile.created", profile.id, Object.keys(values));
      return profile;
    },
    updateBusinessProfile(payload, userId) {
      const values = validatePayload(payload, { partial: true });
      if (Object.keys(values).length === 0) {
        throw new BusinessProfileError("No supported fields were provided.");
      }
      const profile = repository.updateBusinessProfile(values, now().toISOString());
      if (!profile) {
        throw new BusinessProfileError(
          "Business profile not found.",
          404,
          "BUSINESS_PROFILE_NOT_FOUND"
        );
      }
      audit(userId, "business_profile.updated", profile.id, Object.keys(values));
      return profile;
    },
  };
}
