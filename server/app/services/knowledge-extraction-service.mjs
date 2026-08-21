import crypto from "node:crypto";
import { extractCanonicalFields } from "../extractors/canonical-field-extractor.mjs";
import { requireWorkspaceId } from "../tenant-context.mjs";
export class ExtractionError extends Error { constructor(message, status = 400, code = "EXTRACTION_ERROR") { super(message); this.status = status; this.code = code; } }
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
export function createKnowledgeExtractionService({ parserRegistry, parse, repository, auditRepository, now = () => new Date() }) {
  return Object.freeze({
    parsers: () => parserRegistry.list(), runs: () => repository.listRuns(),
    run(id) { const item = repository.getRun(id); if (!item) throw new ExtractionError("Extraction run not found.", 404); return { run: item, parsedDocument: repository.getParsed(item.parsedDocumentId), candidates: repository.listCandidates(item.id).map((candidate) => ({ ...candidate, reviewStatus: repository.status(candidate.id), conflicts: repository.conflicts(candidate.id) })) }; },
    extract(payload, userId) {
      if (payload.workspaceId || payload.workspace_id) throw new ExtractionError("Workspace ownership is server controlled.");
      const artifact = repository.artifactVersion(payload.artifactVersionId); if (!artifact) throw new ExtractionError("Artifact version not found.", 404);
      if (typeof payload.content !== "string") throw new ExtractionError("Document content is required for isolated parsing.");
      if (sha(payload.content) !== artifact.contentHash) throw new ExtractionError("Document content hash does not match the immutable artifact version.", 409, "CONTENT_HASH_MISMATCH");
      if (artifact.filename && (/[/\\]/.test(artifact.filename) || artifact.filename.includes(".."))) throw new ExtractionError("Artifact filename is unsafe.");
      const definition = parserRegistry.resolve(artifact.mimeType, artifact.filename || ""); if (!definition) throw new ExtractionError("No parser matches the declared MIME type and extension.", 415, "PARSER_NOT_FOUND");
      if (!definition.runtimeAvailable) throw new ExtractionError(definition.unavailableReason, 422, "PARSER_RUNTIME_UNAVAILABLE");
      let document; try { document = parse(definition, payload.content, { artifactVersionId: artifact.id, documentType: artifact.artifactType, language: payload.language || artifact.language, locale: payload.locale || null, scriptDirection: payload.scriptDirection || "auto" }); } catch (error) { throw new ExtractionError(error.message, 400, error.code || "PARSE_FAILED"); }
      const inputHash = sha(`${artifact.contentHash}|${definition.parserId}@${definition.parserVersion}|canonical_fields@1.0`), timestamp = now().toISOString();
      const result = repository.createExtraction({ artifactVersionId: artifact.id, inputHash, parser: document, candidates: extractCanonicalFields(document), extractorId: "canonical_field_extractor", extractorVersion: "1.0", at: timestamp, provenance: { artifactVersionId: artifact.id, contentHash: artifact.contentHash, parser: `${definition.parserId}@${definition.parserVersion}`, extractor: "canonical_field_extractor@1.0", translationApplied: false, ocrApplied: false, externalLinksFetched: false } });
      auditRepository.createAuditLog({ workspaceId: requireWorkspaceId(), userId, action: "knowledge.extraction_completed", resourceType: "extraction_run", resourceId: result.run.id, metadata: { artifactVersionId: artifact.id, parserId: definition.parserId, parserVersion: definition.parserVersion, candidateCount: result.candidates.length, duplicate: result.duplicate }, createdAt: timestamp }); return result;
    },
    review(id, payload, userId) {
      if (!["APPROVED", "REJECTED"].includes(payload.status)) throw new ExtractionError("Review status must be APPROVED or REJECTED.");
      let result; try { result = repository.review(id, payload.status, userId, typeof payload.note === "string" ? payload.note.slice(0, 1000) : null, now().toISOString()); } catch (error) { throw new ExtractionError(error.message, 409, "REVIEW_FINAL"); }
      if (!result) throw new ExtractionError("Candidate not found.", 404);
      auditRepository.createAuditLog({ workspaceId: requireWorkspaceId(), userId, action: "knowledge.candidate_reviewed", resourceType: "knowledge_field_candidate", resourceId: id, metadata: { status: payload.status, proposalId: result.proposal?.id || null }, createdAt: result.review.reviewedAt }); return result;
    },
  });
}
