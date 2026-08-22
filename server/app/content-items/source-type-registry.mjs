export const CONTENT_SOURCE_TYPES = Object.freeze([
  "AI_GENERATED",
  "CLIENT_UPLOADED",
  "MANUAL_TEXT",
  "EXTERNAL_IMPORTED",
]);

const enabled = new Set(["AI_GENERATED", "MANUAL_TEXT"]);

export function assertContentSourceType(value) {
  if (!CONTENT_SOURCE_TYPES.includes(value)) {
    const error = new Error("Content source type is invalid.");
    error.code = "CONTENT_SOURCE_INVALID";
    throw error;
  }
  return value;
}

export function assertContentSourceCreationEnabled(value) {
  assertContentSourceType(value);
  if (!enabled.has(value)) {
    const error = new Error("Content source type is not enabled.");
    error.code = "CONTENT_SOURCE_INVALID";
    throw error;
  }
  return value;
}
