import { requireWorkspaceId } from "../tenant-context.mjs";
import {
  assembleBusinessContext,
  BUSINESS_CONTEXT_SCHEMA_VERSION,
} from "./business-context-assembler.mjs";

export class BusinessContextError extends Error {
  constructor(message, status = 400, code = "INVALID_BUSINESS_CONTEXT") {
    super(message);
    this.name = "BusinessContextError";
    this.status = status;
    this.code = code;
  }
}

export function getStaleReasons(manifest, sources) {
  const reasons = [];
  if (
    !sources.profile ||
    manifest?.businessProfile?.id !== sources.profile.id ||
    manifest?.businessProfile?.updatedAt !== sources.profile.updatedAt
  ) reasons.push("BUSINESS_PROFILE_CHANGED");
  if (!sources.dna || manifest?.businessDna?.id !== sources.dna.id) {
    reasons.push("BUSINESS_DNA_CHANGED");
  }
  if (!sources.brandBook || manifest?.brandBook?.id !== sources.brandBook.id) {
    reasons.push("BRAND_BOOK_CHANGED");
  }
  return reasons;
}

function publicSources(sources) {
  return {
    businessProfile: sources.profile
      ? { id: sources.profile.id, updatedAt: sources.profile.updatedAt }
      : null,
    businessDna: sources.dna
      ? { id: sources.dna.id, versionNumber: sources.dna.versionNumber }
      : null,
    brandBook: sources.brandBook
      ? { id: sources.brandBook.id, versionNumber: sources.brandBook.versionNumber }
      : null,
  };
}

export function createBusinessContextService({ repository, auditRepository, now = () => new Date() }) {
  function requireSources() {
    const sources = repository.getCurrentSources();
    if (!sources.profile) {
      throw new BusinessContextError("An active Business Profile is required.", 409, "BUSINESS_PROFILE_REQUIRED");
    }
    if (!sources.dna) {
      throw new BusinessContextError("An active Business DNA version is required.", 409, "ACTIVE_BUSINESS_DNA_REQUIRED");
    }
    if (!sources.brandBook) {
      throw new BusinessContextError("An active Brand Book version is required.", 409, "ACTIVE_BRAND_BOOK_REQUIRED");
    }
    if (
      sources.dna.businessProfileId !== sources.profile.id ||
      sources.brandBook.businessProfileId !== sources.profile.id
    ) {
      throw new BusinessContextError("Business sources are inconsistent.", 409, "BUSINESS_SOURCES_INCONSISTENT");
    }
    return sources;
  }

  function audit(userId, action, version, metadata = {}) {
    auditRepository.createAuditLog({
      workspaceId: requireWorkspaceId(), userId, action,
      resourceType: "business_context_version", resourceId: version.id,
      metadata: {
        versionNumber: version.versionNumber,
        contextSchemaVersion: version.contextSchemaVersion,
        sourceVersionIds: {
          businessProfileId: version.businessProfileId,
          businessDnaVersionId: version.businessDnaVersionId,
          brandBookVersionId: version.brandBookVersionId,
        },
        ...metadata,
      },
      createdAt: now().toISOString(),
    });
  }

  return {
    getCurrent() {
      const activeContext = repository.getActiveVersion();
      const latestDraft = repository.getLatestDraft();
      const sources = repository.getCurrentSources();
      const staleReasons = activeContext
        ? getStaleReasons(activeContext.sourceManifest, sources)
        : [];
      return {
        activeContext,
        latestDraft,
        isStale: staleReasons.length > 0,
        staleReasons,
        currentSources: publicSources(sources),
      };
    },
    listVersions: () => repository.listVersions(),
    createDraft(payload, userId) {
      if (payload && (Object.hasOwn(payload, "snapshot_json") || Object.hasOwn(payload, "snapshot") ||
        Object.hasOwn(payload, "workspaceId") || Object.hasOwn(payload, "workspace_id") ||
        Object.hasOwn(payload, "businessDnaVersionId") || Object.hasOwn(payload, "brandBookVersionId"))) {
        throw new BusinessContextError("Business Context sources and snapshot are assembled by the server.", 400, "CONTEXT_FIELDS_FORBIDDEN");
      }
      const sources = requireSources();
      const assembled = assembleBusinessContext(sources);
      const version = repository.createDraft({
        ...sources,
        snapshot: assembled.snapshot,
        sourceManifest: assembled.sourceManifest,
        schemaVersion: BUSINESS_CONTEXT_SCHEMA_VERSION,
        userId,
        timestamp: now().toISOString(),
      });
      audit(userId, "business_context.version_created", version);
      return version;
    },
    activateVersion(id, userId) {
      const version = repository.getVersion(id);
      if (!version) throw new BusinessContextError("Business Context version not found.", 404, "CONTEXT_NOT_FOUND");
      if (version.status !== "draft") {
        throw new BusinessContextError("Only draft contexts can be activated.", 409, "CONTEXT_ACTIVATION_INVALID");
      }
      const sources = requireSources();
      const staleReasons = getStaleReasons(version.sourceManifest, sources);
      if (staleReasons.length) {
        throw new BusinessContextError(
          "The draft is outdated. Rebuild it from the latest business information.",
          409,
          "CONTEXT_DRAFT_STALE"
        );
      }
      const result = repository.activateVersion(id, now().toISOString());
      if (result.previousActiveVersionId) {
        const previous = repository.getVersion(result.previousActiveVersionId);
        audit(userId, "business_context.version_archived", previous, {
          reason: "REPLACED_BY_NEW_ACTIVE",
          activatedVersionId: result.version.id,
        });
      }
      audit(userId, "business_context.version_activated", result.version, {
        previousActiveVersionId: result.previousActiveVersionId,
        staleReasons: [],
      });
      return result.version;
    },
    archiveDraft(id, userId) {
      const version = repository.getVersion(id);
      if (!version) throw new BusinessContextError("Business Context version not found.", 404, "CONTEXT_NOT_FOUND");
      if (version.status !== "draft") {
        throw new BusinessContextError("Only draft contexts can be archived directly.", 409, "CONTEXT_ARCHIVE_INVALID");
      }
      const archived = repository.archiveDraft(id, now().toISOString());
      audit(userId, "business_context.version_archived", archived);
      return archived;
    },
  };
}
