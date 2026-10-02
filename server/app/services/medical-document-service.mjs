import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { createSensitiveAccessAudit } from "./sensitive-access-audit.mjs";
import { DocumentValidationError, MAX_DOCUMENTS_PER_APPOINTMENT, sanitizeFileName, sanitizeTitle, validateDocumentBody } from "./medical-document-policy.mjs";

export class MedicalDocumentError extends Error {
  constructor(code, status = 400, message = "Medical document request could not be completed.") { super(message); this.name = "MedicalDocumentError"; this.code = code; this.status = status; }
}
const notFound = () => new MedicalDocumentError("MEDICAL_DOCUMENT_NOT_FOUND", 404, "Document not found.");

// Scanner contract: scan({ body, mimeType }) -> { verdict: "clean" | "infected" | "error" }.
// No scanner ships with the repo; none is faked. Without one, development stores
// documents as "not_scanned" and production refuses to run at all.
export function createMedicalDocumentService({ db, storage, scanner = null, nodeEnv = "development", audit = createSensitiveAccessAudit(db), now = () => new Date() }) {
  const iso = () => now().toISOString();
  const productionReady = () => nodeEnv !== "production" || (Boolean(scanner) && storage.kind !== "unconfigured");
  const readableStates = () => (nodeEnv === "production" ? ["clean"] : ["clean", "not_scanned"]);
  const present = (row) => ({ id: row.id, appointmentId: row.appointment_id, title: row.title, fileName: row.original_name, mimeType: row.mime_type, sizeBytes: row.size_bytes, scanState: row.scan_state, createdAt: row.created_at });
  const wsId = () => requireWorkspaceId();

  const patientAppointment = (siteProjectId, patient, appointmentId) =>
    db.prepare("SELECT * FROM booking_appointments WHERE id=? AND workspace_id=? AND site_project_id=? AND app_user_id=? AND auth_project_id=?").get(appointmentId, wsId(), siteProjectId, patient.id, patient.authProjectId) || null;
  const doctorAppointment = (siteProjectId, doctor, appointmentId) =>
    db.prepare("SELECT * FROM booking_appointments WHERE id=? AND workspace_id=? AND site_project_id=? AND provider_id=?").get(appointmentId, wsId(), siteProjectId, doctor.providerId) || null;
  const activeDocs = (appointmentId) => db.prepare("SELECT * FROM medical_documents WHERE workspace_id=? AND appointment_id=? AND lifecycle_state='active' ORDER BY created_at ASC, rowid ASC").all(wsId(), appointmentId);

  async function upload({ siteProjectId, patient, appointmentId, title, fileName, mimeType, body }) {
    if (!productionReady()) throw new MedicalDocumentError("MEDICAL_DOCUMENTS_NOT_PRODUCTION_READY", 503, "Medical documents need a configured scanner and private storage in production.");
    const appointment = patientAppointment(siteProjectId, patient, appointmentId);
    if (!appointment || appointment.status === "CANCELLED") throw new MedicalDocumentError("MEDICAL_DOCUMENT_APPOINTMENT_NOT_FOUND", 404, "Appointment not found.");
    const cleanTitle = sanitizeTitle(title), mime = validateDocumentBody({ body, declaredMime: mimeType });
    if (activeDocs(appointmentId).length >= MAX_DOCUMENTS_PER_APPOINTMENT) throw new MedicalDocumentError("MEDICAL_DOCUMENT_LIMIT_REACHED", 409, "This appointment has reached its document limit.");
    let scanState = "not_scanned";
    if (scanner) {
      let verdict;
      try { verdict = (await scanner.scan({ body, mimeType: mime }))?.verdict; } catch { verdict = "error"; }
      if (verdict === "infected") {
        audit.record({ siteProjectId, actor: { kind: "app_user", id: patient.id }, action: "medical_document.rejected", resourceType: "booking_appointment", resourceId: appointmentId, metadata: { reason: "infected", mime } });
        throw new MedicalDocumentError("MEDICAL_DOCUMENT_REJECTED", 422, "The file was rejected by the security scan.");
      }
      if (verdict !== "clean") throw new MedicalDocumentError("MEDICAL_DOCUMENT_SCAN_UNAVAILABLE", 503, "The security scan is unavailable. Try again later.");
      scanState = "clean";
    }
    const storageRef = await storage.put({ workspaceId: wsId(), siteProjectId, body, mimeType: mime }), id = crypto.randomUUID(), at = iso();
    try {
      db.prepare("INSERT INTO medical_documents(id,workspace_id,site_project_id,auth_project_id,owner_app_user_id,appointment_id,title,original_name,mime_type,size_bytes,sha256,storage_ref,scan_state,lifecycle_state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?, 'active',?,?)")
        .run(id, wsId(), siteProjectId, patient.authProjectId, patient.id, appointmentId, cleanTitle, sanitizeFileName(fileName, mime), mime, body.length, crypto.createHash("sha256").update(body).digest("hex"), storageRef, scanState, at, at);
    } catch (error) { await storage.remove(storageRef).catch(() => undefined); throw error; }
    audit.record({ siteProjectId, actor: { kind: "app_user", id: patient.id }, action: "medical_document.uploaded", resourceType: "medical_document", resourceId: id, metadata: { mime, size: body.length, scanState } });
    return present(db.prepare("SELECT * FROM medical_documents WHERE id=? AND workspace_id=?").get(id, wsId()));
  }

  function listForPatient({ siteProjectId, patient, appointmentId }) {
    if (!patientAppointment(siteProjectId, patient, appointmentId)) throw new MedicalDocumentError("MEDICAL_DOCUMENT_APPOINTMENT_NOT_FOUND", 404, "Appointment not found.");
    return activeDocs(appointmentId).map(present);
  }

  function listForDoctor({ siteProjectId, doctor, appointmentId }) {
    if (!doctorAppointment(siteProjectId, doctor, appointmentId)) throw new MedicalDocumentError("MEDICAL_DOCUMENT_APPOINTMENT_NOT_FOUND", 404, "Appointment not found.");
    const docs = activeDocs(appointmentId);
    audit.record({ siteProjectId, actor: { kind: "app_user", id: doctor.id }, action: "medical_document.listed", resourceType: "booking_appointment", resourceId: appointmentId, metadata: { count: docs.length } });
    return docs.map(present);
  }

  async function readRow(row, siteProjectId, actor, reason = null) {
    if (!row || row.lifecycle_state !== "active" || !readableStates().includes(row.scan_state)) throw notFound();
    // The evidence is written before any byte is released.
    audit.record({ siteProjectId, actor, action: "medical_document.read", resourceType: "medical_document", resourceId: row.id, metadata: { mime: row.mime_type, ...(reason ? { reason } : {}) } });
    const body = await storage.get(row.storage_ref);
    return { body, mimeType: row.mime_type, fileName: row.original_name || "document" };
  }

  const readForPatient = ({ siteProjectId, patient, documentId }) => readRow(
    db.prepare("SELECT * FROM medical_documents WHERE id=? AND workspace_id=? AND site_project_id=? AND owner_app_user_id=?").get(documentId, wsId(), siteProjectId, patient.id), siteProjectId, { kind: "app_user", id: patient.id });
  const readForDoctor = ({ siteProjectId, doctor, documentId }) => readRow(
    db.prepare("SELECT d.* FROM medical_documents d JOIN booking_appointments a ON a.id=d.appointment_id AND a.workspace_id=d.workspace_id WHERE d.id=? AND d.workspace_id=? AND d.site_project_id=? AND a.provider_id=?").get(documentId, wsId(), siteProjectId, doctor.providerId), siteProjectId, { kind: "app_user", id: doctor.id });

  // Operator access is explicit: a stated reason is mandatory and recorded.
  function readForOperator({ siteProjectId, documentId, operatorId, reason }) {
    const why = typeof reason === "string" ? reason.trim() : "";
    if (why.length < 10 || why.length > 200) throw new MedicalDocumentError("MEDICAL_DOCUMENT_REASON_REQUIRED", 400, "A reason of 10-200 characters is required.");
    return readRow(db.prepare("SELECT * FROM medical_documents WHERE id=? AND workspace_id=? AND site_project_id=?").get(documentId, wsId(), siteProjectId), siteProjectId, { kind: "operator", id: operatorId }, why);
  }

  // Operators list metadata only: no titles or file names, which can themselves be sensitive.
  function listForOperator({ siteProjectId, operatorId }) {
    const rows = db.prepare("SELECT id,appointment_id,mime_type,size_bytes,scan_state,lifecycle_state,created_at FROM medical_documents WHERE workspace_id=? AND site_project_id=? ORDER BY created_at DESC, rowid DESC").all(wsId(), siteProjectId);
    audit.record({ siteProjectId, actor: { kind: "operator", id: operatorId }, action: "medical_document.listed_operator", resourceType: "site_project", resourceId: siteProjectId, metadata: { count: rows.length } });
    return rows.map((row) => ({ id: row.id, appointmentId: row.appointment_id, mimeType: row.mime_type, sizeBytes: row.size_bytes, scanState: row.scan_state, lifecycleState: row.lifecycle_state, createdAt: row.created_at }));
  }

  async function deleteForPatient({ siteProjectId, patient, documentId }) {
    const row = db.prepare("SELECT * FROM medical_documents WHERE id=? AND workspace_id=? AND site_project_id=? AND owner_app_user_id=? AND lifecycle_state='active'").get(documentId, wsId(), siteProjectId, patient.id);
    if (!row) throw notFound();
    db.prepare("UPDATE medical_documents SET lifecycle_state='deleted',deleted_at=?,updated_at=? WHERE id=? AND workspace_id=?").run(iso(), iso(), documentId, wsId());
    await storage.remove(row.storage_ref).catch(() => undefined);
    audit.record({ siteProjectId, actor: { kind: "app_user", id: patient.id }, action: "medical_document.deleted", resourceType: "medical_document", resourceId: documentId, metadata: {} });
    return { id: documentId, lifecycleState: "deleted" };
  }

  return Object.freeze({ productionReady, upload, listForPatient, listForDoctor, readForPatient, readForDoctor, readForOperator, listForOperator, deleteForPatient });
}
export { DocumentValidationError };
