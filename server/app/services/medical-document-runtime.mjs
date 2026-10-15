import { createMedicalDocumentService } from "./medical-document-service.mjs";
import { createMedicalScannerFromEnv } from "./medical-document-scanner.mjs";
import { createMedicalStorage } from "./medical-document-storage.mjs";

// The one place that decides how Medical documents are stored and scanned. The public (patient/doctor) router and
// the operator control plane both build their service from here, so they can never disagree about storage,
// scanner or production readiness.
export function createConfiguredMedicalDocuments({ db, nodeEnv, env = process.env }) {
  const storage = createMedicalStorage({ nodeEnv, env });
  const scanner = createMedicalScannerFromEnv(env);
  const service = createMedicalDocumentService({ db, storage, scanner, nodeEnv });
  return { storage, scanner, service };
}
