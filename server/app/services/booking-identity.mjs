import { LoadderAppUserAuth } from "../business-builder/app-user-auth.mjs";
import { BookingError } from "../repositories/booking-repository.mjs";

// Anonymous booking stays possible (no credentials -> null). Credentials that
// are supplied must resolve to an active customer session in the current
// workspace; they are never silently downgraded to anonymous.
export function resolveBookingIdentity(db, { token = "", projectId = "" } = {}) {
  const appToken = String(token || "").trim(), appProject = String(projectId || "").trim();
  if (!appToken && !appProject) return null;
  const principal = appToken && appProject ? new LoadderAppUserAuth(db).resolve(appToken, appProject) : null;
  if (!principal || String(principal.role).toLowerCase() !== "customer") throw new BookingError("BOOKING_IDENTITY_INVALID", 401, "نشست کاربر معتبر نیست.");
  return { appUserId: principal.id, authProjectId: principal.projectId };
}
