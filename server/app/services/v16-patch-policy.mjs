// Server-side mutation policy for the V16 document.
//
// A patch never carries object references, expressions or paths of its own
// choosing: it names a semantic TARGET that already exists in the document and
// a bounded PATH inside it, and this module decides whether that is allowed.
// Commerce truth is protected structurally here, not by hiding fields in the UI.

export const LIMITS = Object.freeze({
  maxOperations: 50,
  maxPathDepth: 3,
  maxPathSegment: 40,
  maxStringValue: 4000,
  maxCollection: 100,
  maxTargetLength: 120,
});

export const PROPERTY_CLASS = Object.freeze({ PRESENTATION: "PRESENTATION", CONTENT: "CONTENT", PROTECTED: "PROTECTED" });

// Canonical Commerce truth. These names are rejected at ANY depth of ANY path,
// so the patch engine can never invent or overwrite a price, a stock level or a
// payment/order fact. The Commerce runtime stays authoritative.
const PROTECTED_PROPERTIES = new Set([
  "price", "pricing", "priceminor", "basepriceminor", "compareatpriceminor", "sellingprice",
  "unitpriceminor", "linetotalminor", "totalminor", "subtotalminor", "amountminor", "currency",
  "inventory", "inventoryquantity", "inventorypolicy", "stock", "quantity", "sku",
  "tax", "taxrate", "payment", "paymentstatus", "paymentprovider", "paymentreference",
  "order", "orderstatus", "orderid", "fulfillmentstatus", "customerid", "customer",
  "providertransactionid", "variantid", "productid", "productoverrides", "productsettings",
]);

/**
 * Canonical form of a property name: lower case with separators removed, so
 * priceMinor, price_minor, price-minor and PRICE_MINOR are one name. Bounded,
 * because the input is an arbitrary submitted key.
 */
export const canonicalProperty = (value) => String(value ?? "").slice(0, 64).toLowerCase().replace(/[^a-z0-9]/g, "");

/** True when a property name is canonical Commerce truth in any spelling. */
export const isProtectedProperty = (value) => PROTECTED_PROPERTIES.has(canonicalProperty(value));

// Prototype-pollution vectors, rejected at any depth. These are matched on the
// exact lower-cased name: only `__proto__` itself reaches Object.prototype, so
// separator stripping here would reject harmless names like "proto".
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/** Properties a patch may set, by the target kind that owns them. */
const ALLOWED = {
  hero: {
    enabled: "PRESENTATION", layout: "PRESENTATION", alignment: "PRESENTATION", height: "PRESENTATION",
    overlayOpacity: "PRESENTATION", backgroundColor: "PRESENTATION", textColor: "PRESENTATION", imageUrl: "PRESENTATION",
    eyebrow: "CONTENT", title: "CONTENT", subtitle: "CONTENT", ctaLabel: "CONTENT", ctaHref: "CONTENT",
  },
  header: {
    sticky: "PRESENTATION", height: "PRESENTATION", backgroundColor: "PRESENTATION", textColor: "PRESENTATION",
    showSearch: "PRESENTATION", showAccount: "PRESENTATION", showCart: "PRESENTATION", logoUrl: "PRESENTATION",
    storeName: "CONTENT",
  },
  footer: { enabled: "PRESENTATION", backgroundColor: "PRESENTATION", textColor: "PRESENTATION", text: "CONTENT" },
  nav: { enabled: "PRESENTATION", ctaLabel: "CONTENT", ctaHref: "CONTENT" },
  seo: { title: "CONTENT", description: "CONTENT" },
  design: {
    fontFamily: "PRESENTATION", primaryColor: "PRESENTATION", secondaryColor: "PRESENTATION",
    textColor: "PRESENTATION", mutedTextColor: "PRESENTATION", backgroundColor: "PRESENTATION",
    surfaceColor: "PRESENTATION", containerWidth: "PRESENTATION", sectionSpacing: "PRESENTATION",
    globalRadius: "PRESENTATION", cardRadius: "PRESENTATION", buttonRadius: "PRESENTATION",
    headingScale: "PRESENTATION", bodyScale: "PRESENTATION", cardShadowStrength: "PRESENTATION", borderStrength: "PRESENTATION",
  },
  page: {
    title: "CONTENT", navLabel: "CONTENT", showInNav: "PRESENTATION",
    "seo.title": "CONTENT", "seo.description": "CONTENT",
    sections: "PRESENTATION",
  },
  section: {
    enabled: "PRESENTATION", backgroundColor: "PRESENTATION", textColor: "PRESENTATION",
    spacingTop: "PRESENTATION", spacingBottom: "PRESENTATION", columns: "PRESENTATION",
    mediaPosition: "PRESENTATION", imageUrl: "PRESENTATION", showInNav: "PRESENTATION",
    title: "CONTENT", subtitle: "CONTENT", body: "CONTENT", ctaLabel: "CONTENT", ctaHref: "CONTENT", navLabel: "CONTENT",
    items: "CONTENT",
  },
};

export const targetKind = (target) => {
  const value = String(target ?? "").trim();
  if (!value || value.length > LIMITS.maxTargetLength) return null;
  if (value.startsWith("page:")) return "page";
  if (value.startsWith("section:")) return "section";
  return Object.hasOwn(ALLOWED, value) && !["page", "section"].includes(value) ? value : null;
};

export const targetSelector = (target) => String(target).slice(String(target).indexOf(":") + 1);

/** Split a path, rejecting prototype vectors, depth and segment-length abuse. */
export function parsePath(path) {
  const raw = String(path ?? "").trim();
  if (!raw) return null;
  const segments = raw.split(".");
  if (segments.length > LIMITS.maxPathDepth) return null;
  for (const segment of segments) {
    if (!segment || segment.length > LIMITS.maxPathSegment) return null;
    if (FORBIDDEN_SEGMENTS.has(segment.toLowerCase())) return null;
    if (!/^[A-Za-z0-9_]+$/.test(segment)) return null;
  }
  return segments;
}

/** True when any path segment names canonical Commerce truth. */
export const touchesProtected = (segments) => segments.some(isProtectedProperty);

/**
 * Classify a target+path. Returns { klass } or { reason } naming why it is not
 * allowed, so the caller can report a precise per-operation outcome.
 */
export function classify(target, path) {
  const kind = targetKind(target);
  if (!kind) return { reason: "REJECTED_INVALID_TARGET" };
  const segments = parsePath(path);
  if (!segments) return { reason: "REJECTED_INVALID_PATH" };
  // Protection wins over the allow-list: a protected name is never writable,
  // even if it would otherwise look like an ordinary property.
  if (touchesProtected(segments)) return { reason: "REJECTED_PROTECTED_PROPERTY" };
  const table = ALLOWED[kind];
  const klass = table[segments.join(".")] || (segments.length === 1 ? table[segments[0]] : undefined);
  if (!klass) return { reason: "REJECTED_INVALID_PATH" };
  return { klass, kind, segments };
}

/** Values a patch may carry: bounded primitives and bounded plain structures. */
export function validateValue(value, depth = 0) {
  if (value === null) return true;
  if (depth > LIMITS.maxPathDepth) return false;
  const type = typeof value;
  if (type === "string") return value.length <= LIMITS.maxStringValue;
  if (type === "boolean") return true;
  if (type === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= LIMITS.maxCollection && value.every((entry) => validateValue(entry, depth + 1));
  if (type === "object") {
    const keys = Object.keys(value);
    if (keys.length > LIMITS.maxCollection) return false;
    return keys.every((key) => !FORBIDDEN_SEGMENTS.has(key.toLowerCase())
      && !isProtectedProperty(key)
      && validateValue(value[key], depth + 1));
  }
  return false; // functions, symbols, undefined
}
