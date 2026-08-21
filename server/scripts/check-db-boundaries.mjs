import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const serverRoot = path.resolve(import.meta.dirname, "..");
const targets = [path.join(serverRoot, "index.mjs"), path.join(serverRoot, "app")];
const violations = [];
const consumerBoundaryViolations = [];

function inspect(target) {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(target)) inspect(path.join(target, entry));
    return;
  }
  if (!target.endsWith(".mjs")) return;
  const source = readFileSync(target, "utf8");
  if (/from\s+["'][^"']*db\/database\.mjs["']/.test(source)) {
    violations.push(path.relative(serverRoot, target));
  }
  if (
    target.includes(`${path.sep}app${path.sep}context-consumers${path.sep}`) ||
    target.includes(`${path.sep}app${path.sep}signal-producers${path.sep}`) ||
    target.includes(`${path.sep}app${path.sep}feature-producers${path.sep}`) ||
    target.includes(`${path.sep}app${path.sep}model-input-builders${path.sep}`) ||
    target.includes(`${path.sep}app${path.sep}forecast-builders${path.sep}`) ||
    target.includes(`${path.sep}app${path.sep}knowledge-parsers${path.sep}`) ||
    target.includes(`${path.sep}app${path.sep}extractors${path.sep}`) ||
    target.includes(`${path.sep}app${path.sep}import-mappers${path.sep}`) ||
    target.includes(`${path.sep}app${path.sep}listening${path.sep}`) ||
    target.endsWith(`${path.sep}listening-service.mjs`) ||
    target.endsWith(`${path.sep}listening-event-mapper-service.mjs`)
    || target.endsWith(`${path.sep}listening-intelligence-service.mjs`)
  ) {
    const forbidden = [
      /from\s+["'][^"']*(business-profile|business-dna|brand-book)-(repository|service)\.mjs["']/,
      /from\s+["'][^"']*business-context-repository\.mjs["']/,
      /\b(business_profiles|business_dna_versions|brand_book_versions)\b/i,
    ];
    if (target.includes(`${path.sep}app${path.sep}feature-producers${path.sep}`)) {
      forbidden.push(
        /from\s+["'][^"']*(business-event-repository|business-event-service)\.mjs["']/,
        /\bbusiness_events\b/i
      );
    }
    if (target.includes(`${path.sep}app${path.sep}model-input-builders${path.sep}`)) {
      forbidden.push(
        /from\s+["'][^"']*(business-event|intelligence-record)-(repository|service)\.mjs["']/,
        /\b(business_events|normalized_observations|derived_signals|customers|leads|orders|carts)\b/i
      );
    }
    if (target.includes(`${path.sep}app${path.sep}forecast-builders${path.sep}`)) {
      forbidden.push(
        /from\s+["'][^"']*(business-profile|business-dna|brand-book|business-context|business-event|intelligence-record|feature-value|integration)-(repository|service)\.mjs["']/,
        /\b(business_events|normalized_observations|derived_signals|feature_values|customers|leads|orders|carts|canonical_import_records)\b/i
      );
    }
    if (target.includes(`${path.sep}app${path.sep}knowledge-parsers${path.sep}`) || target.includes(`${path.sep}app${path.sep}extractors${path.sep}`)) {
      forbidden.push(/from\s+["'][^"']*(business-profile|business-dna|brand-book|business-context|knowledge-kpi)-(repository|service)\.mjs["']/);
    }
    if (target.includes(`${path.sep}app${path.sep}import-mappers${path.sep}`)) {
      forbidden.push(/from\s+["'][^"']*(credential|provider-adapter|connector-adapter)[^"']*["']/);
    }
    if (target.includes(`${path.sep}app${path.sep}listening${path.sep}`) || target.endsWith(`${path.sep}listening-service.mjs`)) {
      forbidden.push(
        /from\s+["'][^"']*(feature-value|model-input|forecast|recommendation|automation)-(repository|service)[^"']*["']/,
        /\b(feature_values|model_input_snapshots|forecast_records|derived_signals|normalized_observations)\b/i
      );
    }
    if (target.endsWith(`${path.sep}listening-event-mapper-service.mjs`)) {
      forbidden.push(/from\s+["'][^"']*(feature-value|model-input|forecast|recommendation|automation)-(repository|service)[^"']*["']/);
    }
    if (target.includes(`${path.sep}app${path.sep}feature-producers${path.sep}`)) forbidden.push(/listening-(repository|intelligence-repository)/);
    if (/from\s+["'][^"']*(integrations\/providers|connector-adapters|provider-adapters)[^"']*["']/.test(source) &&
      !target.includes(`${path.sep}app${path.sep}integrations${path.sep}`)) {
      consumerBoundaryViolations.push(path.relative(serverRoot, target));
    }
    if (forbidden.some((pattern) => pattern.test(source))) {
      consumerBoundaryViolations.push(path.relative(serverRoot, target));
    }
  }
}

for (const target of targets) inspect(target);

if (violations.length) {
  console.error(
    `Tenant-facing code imports raw database.mjs: ${violations.join(", ")}`
  );
  process.exitCode = 1;
}
if (consumerBoundaryViolations.length) {
  console.error(
    `Business Context consumers, signal producers, feature producers, or model-input builders access forbidden persistence: ${consumerBoundaryViolations.join(", ")}`
  );
  process.exitCode = 1;
}
if (!violations.length && !consumerBoundaryViolations.length) {
  console.log("Database import boundary is valid.");
  console.log("Business Context consumer boundary is valid.");
}
