// Strict allow-list for patient-uploaded medical documents (ADR-005 D2).
// The declared type must match the file's own magic bytes; SVG and every other
// type is refused. PDFs that carry active content markers are refused too.
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_APPOINTMENT = 20;

export class DocumentValidationError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = "DocumentValidationError"; this.code = code; this.status = status; }
}

const SIGNATURES = [
  { mime: "application/pdf", match: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/jpeg", match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", match: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", match: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];
export const ALLOWED_DOCUMENT_TYPES = Object.freeze(SIGNATURES.map((entry) => entry.mime));
const ACTIVE_PDF_MARKERS = [/\/JavaScript\b/, /\/JS\b/, /\/Launch\b/, /\/EmbeddedFile\b/, /\/OpenAction\b/, /\/AA\b/];
const EXTENSIONS = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function sanitizeFileName(value, mime) {
  const base = String(value ?? "").split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, "").replace(/[<>:"|?*]/g, "_").trim().slice(0, 120);
  return base || `document.${EXTENSIONS[mime] || "bin"}`;
}

export function sanitizeTitle(value) {
  const title = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  if (!title) throw new DocumentValidationError("MEDICAL_DOCUMENT_TITLE_REQUIRED", "A document title is required.");
  return title;
}

// Returns the verified type. Throws a DocumentValidationError for anything else.
export function validateDocumentBody({ body, declaredMime }) {
  if (!Buffer.isBuffer(body) || body.length === 0) throw new DocumentValidationError("MEDICAL_DOCUMENT_EMPTY", "The file is empty.");
  if (body.length > MAX_DOCUMENT_BYTES) throw new DocumentValidationError("MEDICAL_DOCUMENT_TOO_LARGE", "The file is too large.", 413);
  const mime = String(declaredMime || "").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_DOCUMENT_TYPES.includes(mime)) throw new DocumentValidationError("MEDICAL_DOCUMENT_TYPE_NOT_ALLOWED", "This file type is not allowed.", 415);
  const detected = SIGNATURES.find((entry) => entry.match(body));
  if (!detected || detected.mime !== mime) throw new DocumentValidationError("MEDICAL_DOCUMENT_CONTENT_MISMATCH", "The file content does not match its declared type.", 415);
  if (mime === "application/pdf") {
    const head = body.toString("latin1");
    if (ACTIVE_PDF_MARKERS.some((marker) => marker.test(head))) throw new DocumentValidationError("MEDICAL_DOCUMENT_ACTIVE_CONTENT", "PDF files with embedded scripts or attachments are not accepted.", 415);
  }
  return mime;
}
