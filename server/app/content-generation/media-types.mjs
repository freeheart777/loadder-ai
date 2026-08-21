export const CONTENT_MEDIA_TYPES = Object.freeze(["TEXT", "IMAGE", "VIDEO"]);

export function assertContentMediaType(value) {
  if (!CONTENT_MEDIA_TYPES.includes(value)) throw new Error("Unknown content media type.");
  return value;
}

export function assertContentMediaEnabled(value) {
  assertContentMediaType(value);
  if (value !== "TEXT") {
    const error = new Error("This content media type is not enabled.");
    error.code = "CONTENT_MEDIA_DISABLED";
    throw error;
  }
  return value;
}
