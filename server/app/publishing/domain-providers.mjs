import { resolveTxt } from "node:dns/promises";

export function createSystemDnsVerifier({ timeoutMs = 3000 } = {}) {
  return Object.freeze({ configured: true, kind: "SYSTEM_DNS", async lookupTxt(recordName) {
    let timer; const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(), { code: "DOMAIN_DNS_TIMEOUT" })), timeoutMs); });
    try { const rows = await Promise.race([resolveTxt(recordName), timeout]); return rows.map((parts) => parts.join("")); } finally { clearTimeout(timer); }
  } });
}

export function createDeterministicDnsVerifier(records = new Map()) {
  return Object.freeze({ configured: true, kind: "TEST", async lookupTxt(recordName) { return [...(records.get(recordName) || [])]; } });
}

export function createUnavailableTlsProvider() {
  return Object.freeze({ configured: false, kind: "UNAVAILABLE", async requestCertificate() { return { status: "PENDING", failureCode: "TLS_PROVISIONING_NOT_CONFIGURED" }; }, async getCertificateStatus() { return { status: "PENDING" }; }, async disableDomain() {} });
}

export function createDeterministicTlsProvider({ status = "READY" } = {}) {
  return Object.freeze({ configured: true, kind: "TEST", async requestCertificate() { return { status }; }, async getCertificateStatus() { return { status }; }, async disableDomain() {} });
}
