import { defineProviderIdentityVerifier } from "./verifier-contract.mjs";

export function createProviderIdentityVerifierRegistry(descriptors = []) {
  const entries = new Map();
  for (const input of descriptors) {
    const descriptor = defineProviderIdentityVerifier(input), key = `${descriptor.connectorId}@${descriptor.connectorVersion}`;
    if (entries.has(key)) throw new TypeError(`Duplicate provider identity verifier: ${key}`);
    entries.set(key, descriptor);
  }
  return Object.freeze({ resolve: (connectorId, connectorVersion) => entries.get(`${connectorId}@${connectorVersion}`) || null, list: () => [...entries.values()] });
}

export const providerIdentityVerifierRegistry = createProviderIdentityVerifierRegistry();
