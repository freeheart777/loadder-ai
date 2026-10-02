// Patient session kept in sessionStorage only (cleared with the tab). The token is
// also stored under the existing app-user convention so the Booking identity
// header works unchanged.
export type PatientSession = { token: string; authProjectId: string; expiresAt: string; displayName: string | null };

const key = (siteProjectId: string) => `loadder-patient:${siteProjectId}`;

export function readPatientSession(siteProjectId: string): PatientSession | null {
  try {
    const raw = sessionStorage.getItem(key(siteProjectId));
    const session = raw ? (JSON.parse(raw) as PatientSession) : null;
    if (!session?.token || !session.authProjectId || Date.parse(session.expiresAt) <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export function savePatientSession(siteProjectId: string, session: PatientSession) {
  try {
    sessionStorage.setItem(key(siteProjectId), JSON.stringify(session));
    sessionStorage.setItem(`loadder-public-app-token:${session.authProjectId}`, session.token);
  } catch { /* storage unavailable */ }
}

export function clearPatientSession(siteProjectId: string) {
  try {
    const session = readPatientSession(siteProjectId);
    sessionStorage.removeItem(key(siteProjectId));
    if (session) sessionStorage.removeItem(`loadder-public-app-token:${session.authProjectId}`);
  } catch { /* ignore */ }
}

export const patientHeaders = (session: PatientSession | null): Record<string, string> =>
  session ? { "X-Loadder-App-Token": session.token, "X-Loadder-App-Project": session.authProjectId } : {};
