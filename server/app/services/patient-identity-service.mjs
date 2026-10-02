import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { LoadderAppUserAuth } from "../business-builder/app-user-auth.mjs";
import { createSensitiveAccessAudit } from "./sensitive-access-audit.mjs";

export class PatientIdentityError extends Error {
  constructor(code, status = 400, message = "Patient identity request could not be completed.", extra = {}) {
    super(message); this.name = "PatientIdentityError"; this.code = code; this.status = status; Object.assign(this, extra);
  }
}

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹", ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function normalizeMobile(raw) {
  let value = String(raw ?? "").trim().replace(/[\s\-()]/g, "");
  value = value.replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
  if (value.startsWith("+98")) value = `0${value.slice(3)}`;
  else if (value.startsWith("0098")) value = `0${value.slice(4)}`;
  else if (/^98\d{10}$/.test(value)) value = `0${value.slice(2)}`;
  return /^09\d{9}$/.test(value) ? value : null;
}
const maskMobile = (mobile) => `${mobile.slice(0, 4)}***${mobile.slice(-2)}`;
const cleanName = (value) => { const name = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80); return name || null; };

// Patients are ordinary app users (role "customer") of a system identity project
// bound to one site. Mobile + OTP is the primary identifier; there are no
// passwords. The legacy NOT NULL email column holds a reserved .invalid
// placeholder that is never shown or used for delivery.
export function createPatientIdentityService({
  db, hashSecret, deliver, deliveryConfigured = () => true, now = () => new Date(),
  exposeDevelopmentCode = false, otpTtlMs = 5 * 60_000, maxAttempts = 5, resendCooldownMs = 60_000, windowMs = 15 * 60_000, windowLimit = 5, sessionTtlMs = 8 * 3_600_000,
}) {
  if (!hashSecret) throw new Error("A hash secret is required for patient OTP.");
  if (typeof deliver !== "function") throw new Error("An OTP delivery function is required.");
  const auth = new LoadderAppUserAuth(db), audit = createSensitiveAccessAudit(db, { now: () => now().toISOString() });
  const hashCode = (projectId, mobile, code) => crypto.createHmac("sha256", hashSecret).update(`patient:${projectId}:${mobile}:${code}`).digest("hex");
  const iso = (date = now()) => date.toISOString();

  function bindingFor(siteProjectId) {
    const row = db.prepare("SELECT * FROM site_identity_bindings WHERE workspace_id=? AND site_project_id=? AND status='active'").get(requireWorkspaceId(), siteProjectId);
    return row ? { id: row.id, siteProjectId: row.site_project_id, authProjectId: row.auth_project_id } : null;
  }
  const requireBinding = (siteProjectId) => bindingFor(siteProjectId) || (() => { throw new PatientIdentityError("PATIENT_SIGNUP_NOT_ENABLED", 404, "Patient sign-in is not enabled for this site."); })();

  // Operator action: one system auth project per Medical site, created once.
  function enableForSite(siteProjectId, { actorUserId = null } = {}) {
    const workspaceId = requireWorkspaceId();
    const site = db.prepare("SELECT id,site_type AS siteType FROM site_projects WHERE id=? AND workspace_id=?").get(siteProjectId, workspaceId);
    if (!site) throw new PatientIdentityError("SITE_PROJECT_NOT_FOUND", 404, "Site project not found.");
    if (String(site.siteType).toUpperCase() !== "MEDICAL") throw new PatientIdentityError("PATIENT_IDENTITY_SITE_TYPE_UNSUPPORTED", 422, "Patient identity is only available for Medical sites.");
    const existing = db.prepare("SELECT * FROM site_identity_bindings WHERE workspace_id=? AND site_project_id=?").get(workspaceId, siteProjectId);
    if (existing) {
      if (existing.status !== "active") db.prepare("UPDATE site_identity_bindings SET status='active',updated_at=? WHERE id=?").run(iso(), existing.id);
      return { enabled: true, authProjectId: existing.auth_project_id, created: false };
    }
    return db.transaction(() => {
      const at = iso(), authProjectId = crypto.randomUUID();
      db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,kind,created_at,updated_at) VALUES(?,?,?,?,?,'ready','site_identity',?,?)").run(authProjectId, workspaceId, `site-identity:${siteProjectId}`, "Patient identity for a Medical site", "fa-IR", at, at);
      db.prepare("INSERT INTO site_identity_bindings(id,workspace_id,site_project_id,auth_project_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?, 'active',?,?,?)").run(crypto.randomUUID(), workspaceId, siteProjectId, authProjectId, actorUserId, at, at);
      audit.record({ siteProjectId, actor: actorUserId ? { kind: "operator", id: actorUserId } : { kind: "system" }, action: "patient.identity.enabled", resourceType: "site_identity_binding", resourceId: authProjectId, metadata: {} });
      return { enabled: true, authProjectId, created: true };
    })();
  }
  const status = (siteProjectId) => { const binding = bindingFor(siteProjectId); return { enabled: Boolean(binding), authProjectId: binding?.authProjectId || null }; };

  // The active doctor identity for a mobile on this site, if any (never created by sign-in).
  function doctorFor(binding, siteProjectId, mobile) {
    const workspaceId = requireWorkspaceId();
    return db.prepare(`SELECT i.id AS identifierId, u.id AS userId, u.status AS userStatus, l.provider_id AS providerId
      FROM app_user_identifiers i
      JOIN business_builder_app_users u ON u.id=i.app_user_id AND u.workspace_id=i.workspace_id AND u.role='employee'
      JOIN booking_provider_identities l ON l.app_user_id=u.id AND l.workspace_id=i.workspace_id AND l.site_project_id=? AND l.status='active'
      WHERE i.workspace_id=? AND i.project_id=? AND i.kind='mobile' AND i.value_normalized=? AND i.status='active'`).get(siteProjectId, workspaceId, binding.authProjectId, mobile) || null;
  }

  async function requestOtp({ siteProjectId, mobile: rawMobile, audience = "patient" }) {
    const binding = requireBinding(siteProjectId), workspaceId = requireWorkspaceId();
    if (!deliveryConfigured()) {
      audit.record({ siteProjectId, actor: { kind: "system" }, action: "patient.otp.delivery_unavailable", resourceType: "patient_identity", metadata: {} });
      throw new PatientIdentityError("OTP_DELIVERY_NOT_CONFIGURED", 503, "OTP delivery is not configured.");
    }
    const mobile = normalizeMobile(rawMobile);
    if (!mobile) throw new PatientIdentityError("PATIENT_MOBILE_INVALID", 400, "Enter a valid mobile number.");
    // Doctors are never self-created: for an unknown mobile nothing is sent, yet the answer
    // is identical, so neither enumeration nor SMS pumping is possible through this door.
    if (audience === "doctor" && !doctorFor(binding, siteProjectId, mobile)) {
      return { expiresAt: iso(new Date(now().getTime() + otpTtlMs)), resendAfterSeconds: Math.ceil(resendCooldownMs / 1000) };
    }
    const at = now(), since = iso(new Date(at.getTime() - windowMs));
    const recent = db.prepare("SELECT created_at FROM app_user_otp_challenges WHERE workspace_id=? AND project_id=? AND kind='mobile' AND value_normalized=? AND created_at>=? ORDER BY created_at DESC").all(workspaceId, binding.authProjectId, mobile, since);
    const last = recent[0] ? Date.parse(recent[0].created_at) : 0;
    if (recent.length >= windowLimit || (last && at.getTime() - last < resendCooldownMs)) {
      const retryAfterSeconds = Math.max(1, Math.ceil(((recent.length >= windowLimit ? Date.parse(recent.at(-1).created_at) + windowMs : last + resendCooldownMs) - at.getTime()) / 1000));
      throw new PatientIdentityError("PATIENT_OTP_RATE_LIMITED", 429, "Too many codes requested. Try again later.", { retryAfterSeconds });
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0"), id = crypto.randomUUID(), expiresAt = iso(new Date(at.getTime() + otpTtlMs));
    db.prepare("INSERT INTO app_user_otp_challenges(id,workspace_id,project_id,kind,value_normalized,code_hash,attempts,max_attempts,expires_at,created_at) VALUES(?,?,?,'mobile',?,?,0,?,?,?)").run(id, workspaceId, binding.authProjectId, mobile, hashCode(binding.authProjectId, mobile, code), maxAttempts, expiresAt, iso(at));
    try { await deliver({ mobile, code }); }
    catch {
      db.prepare("UPDATE app_user_otp_challenges SET consumed_at=? WHERE id=?").run(iso(), id);
      audit.record({ siteProjectId, actor: { kind: "system" }, action: "patient.otp.delivery_failed", resourceType: "patient_identity", resourceId: id, metadata: {} });
      throw new PatientIdentityError("OTP_DELIVERY_FAILED", 502, "The code could not be sent. Try again later.");
    }
    audit.record({ siteProjectId, actor: { kind: "system" }, action: "patient.otp.requested", resourceType: "patient_identity", resourceId: id, metadata: { mobile: maskMobile(mobile) } });
    // The same response whether or not this mobile already has an account.
    return { expiresAt, resendAfterSeconds: Math.ceil(resendCooldownMs / 1000), ...(exposeDevelopmentCode ? { developmentOtp: code } : {}) };
  }

  function verifyOtp({ siteProjectId, mobile: rawMobile, code: rawCode, name, audience = "patient" }) {
    const binding = requireBinding(siteProjectId), workspaceId = requireWorkspaceId();
    const invalid = (reason) => {
      audit.record({ siteProjectId, actor: { kind: "system" }, action: "patient.otp.verify_failed", resourceType: "patient_identity", metadata: { reason } });
      return new PatientIdentityError("PATIENT_OTP_INVALID", 400, "The code is invalid or has expired.");
    };
    const mobile = normalizeMobile(rawMobile), code = String(rawCode ?? "").trim();
    if (!mobile || !/^\d{6}$/.test(code)) throw invalid("malformed");
    const at = now();
    const challenge = db.prepare("SELECT * FROM app_user_otp_challenges WHERE workspace_id=? AND project_id=? AND kind='mobile' AND value_normalized=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1").get(workspaceId, binding.authProjectId, mobile);
    if (!challenge || Date.parse(challenge.expires_at) <= at.getTime()) throw invalid("no_active_challenge");
    if (challenge.attempts >= challenge.max_attempts) throw new PatientIdentityError("PATIENT_OTP_ATTEMPTS_EXCEEDED", 429, "Too many wrong attempts. Request a new code.");
    const expected = Buffer.from(challenge.code_hash, "hex"), actual = Buffer.from(hashCode(binding.authProjectId, mobile, code), "hex");
    if (!(expected.length === actual.length && crypto.timingSafeEqual(expected, actual))) {
      const attempts = challenge.attempts + 1;
      db.prepare("UPDATE app_user_otp_challenges SET attempts=?,consumed_at=CASE WHEN ?>=max_attempts THEN ? ELSE consumed_at END WHERE id=?").run(attempts, attempts, iso(at), challenge.id);
      throw invalid("wrong_code");
    }
    // Single use: only the request that wins this update may sign in.
    if (db.prepare("UPDATE app_user_otp_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL").run(iso(at), challenge.id).changes !== 1) throw invalid("replayed");

    return db.transaction(() => {
      const identifier = db.prepare("SELECT * FROM app_user_identifiers WHERE workspace_id=? AND project_id=? AND kind='mobile' AND value_normalized=?").get(workspaceId, binding.authProjectId, mobile);
      let userId, created = false;
      if (audience === "doctor") {
        const doctor = doctorFor(binding, siteProjectId, mobile);
        if (!doctor || doctor.userStatus !== "active") throw invalid("unavailable");
        db.prepare("UPDATE app_user_identifiers SET verified_at=COALESCE(verified_at,?),updated_at=? WHERE id=?").run(iso(at), iso(at), doctor.identifierId);
        const session = auth.createSession(doctor.userId, { ttlMs: sessionTtlMs });
        audit.record({ siteProjectId, actor: { kind: "app_user", id: doctor.userId }, action: "doctor.signed_in", resourceType: "doctor_identity", resourceId: doctor.userId, metadata: { mobile: maskMobile(mobile) } });
        return { session: { token: session.token, expiresAt: session.expiresAt }, authProjectId: binding.authProjectId, doctor: { id: doctor.userId, providerId: doctor.providerId, displayName: session.user.displayName || null } };
      }
      if (identifier) {
        const user = auth.getUser(identifier.app_user_id);
        if (!user || user.status !== "active" || user.role !== "customer" || identifier.status !== "active") throw invalid("unavailable");
        userId = user.id;
      } else {
        const user = auth.createUser({ projectId: binding.authProjectId, email: `patient-${crypto.randomUUID()}@patients.invalid`, displayName: cleanName(name), role: "customer" });
        db.prepare("INSERT INTO app_user_identifiers(id,workspace_id,project_id,app_user_id,kind,value_normalized,is_primary,verified_at,status,created_at,updated_at) VALUES(?,?,?,?,'mobile',?,1,?,'active',?,?)").run(crypto.randomUUID(), workspaceId, binding.authProjectId, user.id, mobile, iso(at), iso(at), iso(at));
        userId = user.id; created = true;
      }
      const session = auth.createSession(userId, { ttlMs: sessionTtlMs });
      audit.record({ siteProjectId, actor: { kind: "app_user", id: userId }, action: created ? "patient.signed_up" : "patient.signed_in", resourceType: "patient_identity", resourceId: userId, metadata: { mobile: maskMobile(mobile) } });
      return { session: { token: session.token, expiresAt: session.expiresAt }, authProjectId: binding.authProjectId, patient: { id: userId, displayName: session.user.displayName || null }, created };
    })();
  }

  function resolve(siteProjectId, token) {
    const binding = bindingFor(siteProjectId);
    if (!binding || !token) return null;
    const principal = auth.resolve(token, binding.authProjectId);
    return principal && principal.role === "customer" ? { ...principal, authProjectId: binding.authProjectId } : null;
  }

  function resolveDoctor(siteProjectId, token) {
    const binding = bindingFor(siteProjectId);
    if (!binding || !token) return null;
    const principal = auth.resolve(token, binding.authProjectId);
    if (!principal || principal.role !== "employee") return null;
    const link = db.prepare("SELECT provider_id FROM booking_provider_identities WHERE workspace_id=? AND site_project_id=? AND app_user_id=? AND status='active'").get(requireWorkspaceId(), siteProjectId, principal.id);
    return link ? { ...principal, authProjectId: binding.authProjectId, providerId: link.provider_id, siteProjectId } : null;
  }

  // Operator action: give a site-scoped provider (a doctor) a sign-in identity.
  function linkDoctor({ siteProjectId, providerId, mobile: rawMobile, displayName, actorUserId = null }) {
    const binding = bindingFor(siteProjectId), workspaceId = requireWorkspaceId();
    if (!binding) throw new PatientIdentityError("IDENTITY_NOT_ENABLED", 409, "Enable patient identity for this site first.");
    const provider = db.prepare("SELECT id,name FROM booking_providers WHERE id=? AND workspace_id=? AND site_project_id=?").get(providerId, workspaceId, siteProjectId);
    if (!provider) throw new PatientIdentityError("DOCTOR_PROVIDER_NOT_FOUND", 404, "Provider not found for this site.");
    const mobile = normalizeMobile(rawMobile);
    if (!mobile) throw new PatientIdentityError("PATIENT_MOBILE_INVALID", 400, "Enter a valid mobile number.");
    if (db.prepare("SELECT 1 FROM booking_provider_identities WHERE provider_id=?").get(providerId)) throw new PatientIdentityError("DOCTOR_IDENTITY_EXISTS", 409, "This provider already has an identity.");
    if (db.prepare("SELECT 1 FROM app_user_identifiers WHERE workspace_id=? AND project_id=? AND kind='mobile' AND value_normalized=?").get(workspaceId, binding.authProjectId, mobile)) throw new PatientIdentityError("IDENTIFIER_IN_USE", 409, "This mobile already belongs to an account.");
    return db.transaction(() => {
      const at = iso(), user = auth.createUser({ projectId: binding.authProjectId, email: `doctor-${crypto.randomUUID()}@staff.invalid`, displayName: cleanName(displayName) || provider.name, role: "employee" });
      db.prepare("INSERT INTO app_user_identifiers(id,workspace_id,project_id,app_user_id,kind,value_normalized,is_primary,verified_at,status,created_at,updated_at) VALUES(?,?,?,?,'mobile',?,1,NULL,'active',?,?)").run(crypto.randomUUID(), workspaceId, binding.authProjectId, user.id, mobile, at, at);
      const linkId = crypto.randomUUID();
      db.prepare("INSERT INTO booking_provider_identities(id,workspace_id,site_project_id,provider_id,auth_project_id,app_user_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,'active',?,?,?)").run(linkId, workspaceId, siteProjectId, providerId, binding.authProjectId, user.id, actorUserId, at, at);
      audit.record({ siteProjectId, actor: actorUserId ? { kind: "operator", id: actorUserId } : { kind: "system" }, action: "doctor.identity.linked", resourceType: "booking_provider", resourceId: providerId, metadata: { mobile: maskMobile(mobile) } });
      return { id: linkId, providerId, status: "active", mobile: maskMobile(mobile) };
    })();
  }

  function unlinkDoctor({ siteProjectId, providerId, actorUserId = null }) {
    const workspaceId = requireWorkspaceId();
    const link = db.prepare("SELECT * FROM booking_provider_identities WHERE workspace_id=? AND site_project_id=? AND provider_id=?").get(workspaceId, siteProjectId, providerId);
    if (!link) throw new PatientIdentityError("DOCTOR_IDENTITY_NOT_FOUND", 404, "Doctor identity not found.");
    db.transaction(() => {
      db.prepare("UPDATE booking_provider_identities SET status='disabled',updated_at=? WHERE id=?").run(iso(), link.id);
      db.prepare("UPDATE app_user_identifiers SET status='disabled',updated_at=? WHERE workspace_id=? AND app_user_id=?").run(iso(), workspaceId, link.app_user_id);
      auth.setStatus(link.app_user_id, "disabled");
      audit.record({ siteProjectId, actor: actorUserId ? { kind: "operator", id: actorUserId } : { kind: "system" }, action: "doctor.identity.unlinked", resourceType: "booking_provider", resourceId: providerId, metadata: {} });
    })();
    return { providerId, status: "disabled" };
  }

  function listDoctors(siteProjectId) {
    return db.prepare(`SELECT l.id,l.provider_id AS providerId,l.status,p.name AS providerName,i.value_normalized AS mobile
      FROM booking_provider_identities l JOIN booking_providers p ON p.id=l.provider_id AND p.workspace_id=l.workspace_id
      LEFT JOIN app_user_identifiers i ON i.app_user_id=l.app_user_id AND i.kind='mobile'
      WHERE l.workspace_id=? AND l.site_project_id=? ORDER BY l.created_at ASC`).all(requireWorkspaceId(), siteProjectId).map((row) => ({ ...row, mobile: row.mobile ? maskMobile(row.mobile) : null }));
  }

  function signOut({ siteProjectId, token }) {
    const binding = bindingFor(siteProjectId);
    if (!binding || !token) return false;
    const principal = auth.resolve(token, binding.authProjectId);
    if (!principal) return false;
    db.prepare("UPDATE business_builder_app_sessions SET revoked_at=? WHERE workspace_id=? AND project_id=? AND token_hash=? AND revoked_at IS NULL").run(iso(), requireWorkspaceId(), binding.authProjectId, sha256(token));
    audit.record({ siteProjectId, actor: { kind: "app_user", id: principal.id }, action: principal.role === "employee" ? "doctor.signed_out" : "patient.signed_out", resourceType: principal.role === "employee" ? "doctor_identity" : "patient_identity", resourceId: principal.id, metadata: {} });
    return true;
  }

  // Evidence for a sensitive read/change made by a signed-in doctor or patient.
  const recordAccess = ({ siteProjectId, principal, action, resourceType, resourceId = null, metadata = {} }) =>
    audit.record({ siteProjectId, actor: { kind: "app_user", id: principal.id }, action, resourceType, resourceId, metadata });

  return Object.freeze({ recordAccess, enableForSite, status, requestOtp, verifyOtp, resolve, resolveDoctor, linkDoctor, unlinkDoctor, listDoctors, signOut });
}
