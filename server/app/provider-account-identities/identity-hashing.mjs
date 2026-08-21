import crypto from "node:crypto";

const bounded = (value, name) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 500) throw new TypeError(`${name} is invalid.`);
  return value.trim();
};

export function createProviderIdentityHasher({ key, domain = "loadder-provider-identity", version = 1 } = {}) {
  if (!(typeof key === "string" || Buffer.isBuffer(key)) || !key.length) throw new TypeError("A provider identity hashing key is required.");
  const prefix = `${bounded(domain, "domain")}:v${Number(version)}`;
  if (!Number.isInteger(Number(version)) || Number(version) < 1) throw new TypeError("Hashing version is invalid.");
  const hash = ({ providerKind, accountType, normalizedKey }) => crypto.createHmac("sha256", key).update(`${prefix}\0${bounded(providerKind, "providerKind")}\0${bounded(accountType, "accountType")}\0${bounded(normalizedKey, "normalizedKey")}`, "utf8").digest("hex");
  return Object.freeze({ hash, domain, version: Number(version) });
}
