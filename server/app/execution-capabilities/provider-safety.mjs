export const PROVIDER_SAFETY_CLASSES=Object.freeze({
 A:"A_NATIVE_IDEMPOTENCY_AND_RECONCILIATION",
 B:"B_NATIVE_IDEMPOTENCY_ONLY",
 C:"C_RECONCILIATION_ONLY",
 D:"D_NEITHER",
});
const values=new Set(Object.values(PROVIDER_SAFETY_CLASSES));
export function classifyProviderSafety(value){if(!values.has(value))throw new Error("Provider safety class is invalid.");return Object.freeze({providerSafetyClass:value,preferred:value===PROVIDER_SAFETY_CLASSES.A,restricted:value===PROVIDER_SAFETY_CLASSES.B,manualSpecialCaseOnly:value===PROVIDER_SAFETY_CLASSES.C,externalMutationAllowed:value!==PROVIDER_SAFETY_CLASSES.D});}
export function assertExternalMutationSafety(value){const classification=classifyProviderSafety(value);if(!classification.externalMutationAllowed)throw new Error("Provider safety class D is prohibited for external mutation.");return classification;}
