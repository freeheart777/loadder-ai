export const PROVIDER_IDENTITY_VERIFICATION_METHODS = Object.freeze(["PROVIDER_SELF_ENDPOINT", "OAUTH_IDENTITY_CLAIM", "SIGNED_PROVIDER_METADATA", "SANDBOX_ACCOUNT_VERIFICATION"]);

export function defineProviderIdentityVerifier(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) throw new TypeError("Verifier descriptor is required.");
  if (typeof descriptor.connectorId !== "string" || !descriptor.connectorId || !Number.isInteger(descriptor.connectorVersion) || descriptor.connectorVersion < 1 || typeof descriptor.verify !== "function") throw new TypeError("Verifier descriptor is invalid.");
  return Object.freeze({ connectorId: descriptor.connectorId, connectorVersion: descriptor.connectorVersion, verify: descriptor.verify });
}

export function validateVerifierResult(value) {
  const required = ["providerKind", "externalAccountType", "normalizedExternalAccountKey", "verificationMethod", "observedAt"];
  if (!value || typeof value !== "object" || Array.isArray(value) || required.some((key) => typeof value[key] !== "string" || !value[key].trim())) throw new TypeError("Provider identity verifier result is invalid.");
  if (!PROVIDER_IDENTITY_VERIFICATION_METHODS.includes(value.verificationMethod) || !Number.isInteger(value.verificationVersion) || value.verificationVersion < 1) throw new TypeError("Provider identity verification contract is invalid.");
  return value;
}

// Opaque interface marker only. Phase 4M v1 has no implementation that resolves credentials.
export const PROVIDER_CREDENTIAL_ACCESS = Symbol("provider-credential-access");
