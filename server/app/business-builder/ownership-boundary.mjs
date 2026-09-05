export const LOADDER_CORE_POLICY = Object.freeze({
  contract: "loadder.ownership-policy.v1",
  sourceOfTruth: "loadder-app-definition",
  forbiddenCoreVendors: [
    "singulary",
    "dyad",
    "bolt.diy",
    "webcontainer",
    "webcontainers",
    "totalum",
    "supabase",
  ],
  rules: [
    "Business definitions must remain provider-independent.",
    "External tools may only appear behind replaceable adapters.",
    "Production availability must not require an upstream open-source service.",
    "Generated source bundles must be exportable from Loadder-owned contracts.",
  ],
});

export function assertLoadderCoreOwnership({ moduleSource, moduleName = "unknown" }) {
  const normalized = String(moduleSource || "").toLowerCase();
  const violations = LOADDER_CORE_POLICY.forbiddenCoreVendors.filter((vendor) => normalized.includes(vendor));
  if (violations.length) {
    const error = new Error(`Loadder core ownership boundary violated in ${moduleName}: ${violations.join(", ")}`);
    error.code = "LOADDER_CORE_OWNERSHIP_VIOLATION";
    error.violations = violations;
    throw error;
  }
  return true;
}
