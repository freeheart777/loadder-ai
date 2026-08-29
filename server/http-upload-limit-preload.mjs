import express from "express";

// Legacy Builder currently transports images as base64 JSON. A 3 MiB image
// expands to roughly 4 MiB in transit, so the transitional JSON envelope must
// allow extra headroom until all Builder uploads move to Media Library storage.
const originalJson = express.json;

express.json = function loadderJson(options = {}) {
  const nextOptions = { ...options };

  if (!nextOptions.limit || String(nextOptions.limit).toLowerCase() === "2mb") {
    nextOptions.limit = "5mb";
  }

  return originalJson(nextOptions);
};
