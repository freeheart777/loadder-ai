import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const serverRoot = path.resolve(import.meta.dirname, "..");
const targets = [path.join(serverRoot, "index.mjs"), path.join(serverRoot, "app")];
const violations = [];
const consumerBoundaryViolations = [];
const onboardingBoundaryViolations = [];
const creativeGenerationBoundaryViolations = [];
const contentLibraryBoundaryViolations = [];
const contentAssetBoundaryViolations = [];
const creativePlacementBoundaryViolations = [];
const creativeIntentBoundaryViolations = [];
const distributionBoundaryViolations = [];
const attributionTouchBoundaryViolations = [];

function inspect(target) {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(target)) inspect(path.join(target, entry));
    return;
  }
  if (!target.endsWith(".mjs")) return;
  const source = readFileSync(target, "utf8");
  if (target.includes(`${path.sep}content-assets${path.sep}`) || target.endsWith(`${path.sep}content-asset-service.mjs`) || target.endsWith(`${path.sep}content-asset-repository.mjs`)) {
    const isMediaVerifier = target.endsWith(`${path.sep}content-assets${path.sep}media-verifier.mjs`);
    const isObjectStorageAdapter = target.endsWith(`${path.sep}content-assets${path.sep}r2-content-asset-store.mjs`);
    const forbidden = [
      /from\s+["'][^"']*(openai|cloudflare|provider-binding|execution-capabilit|action-proposal|execution-request|dispatch-job|messaging|automation|legacy-crm|campaign|worker|queue|supabase)[^"']*["']/i,
      /\b(action_proposals|execution_requests|execution_dispatch_jobs|creative_placements|performance_observations)\b/i,
      /from\s+["'][^"']*db\/database\.mjs["']/,
      /\b(fetch|setInterval|setTimeout)\s*\(/,
    ];
    if (!isMediaVerifier) forbidden.push(/from\s+["'][^"']*(ffmpeg|ffprobe|sharp)[^"']*["']/i);
    if (!isObjectStorageAdapter) forbidden.push(/from\s+["'][^"']*(aws-sdk|client-s3|s3-request-presigner)[^"']*["']/i);
    if (isObjectStorageAdapter) {
      const awsImports = [...source.matchAll(/from\s+["'](@aws-sdk\/[^"']+)["']/g)].map((match) => match[1]);
      if (awsImports.some((specifier) => !["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"].includes(specifier))) contentAssetBoundaryViolations.push(path.relative(serverRoot, target));
    }
    if (forbidden.some((pattern) => pattern.test(source))) contentAssetBoundaryViolations.push(path.relative(serverRoot, target));
  }
  if (target.includes(`${path.sep}content-items${path.sep}`) || target.endsWith(`${path.sep}content-item-service.mjs`) || target.endsWith(`${path.sep}content-item-repository.mjs`) || target.endsWith(`${path.sep}content-items.mjs`)) {
    const forbidden = [
      /from\s+["'][^"']*(openai|cloudflare|provider-binding|ai-executor|action-proposal|execution-authorization|execution-request|execution-ledger|dispatch-job|execution-capabilit|messaging|automation|legacy-crm|campaign)[^"']*["']/i,
      /\b(action_proposals|execution_authorizations|execution_requests|execution_attempts|execution_results|execution_dispatch_jobs|automations|marketing_campaigns)\b/i,
      /from\s+["'][^"']*db\/database\.mjs["']/,
    ];
    if (forbidden.some((pattern) => pattern.test(source))) contentLibraryBoundaryViolations.push(path.relative(serverRoot, target));
  }
  if (target.includes("creative-placement")) {
    const forbidden = [
      /from\s+["'][^"']*(openai|provider|execution|campaign|advertising|publishing|analytics|performance|website|worker|queue|redis|billing|content-asset)[^"']*["']/i,
      /\b(content_assets|performance_observations|campaigns|marketing_campaigns|execution_requests|website_projects|website_pages|impressions|clicks|conversions|ctr|cpa|roas)\b/i,
      /from\s+["'][^"']*db\/database\.mjs["']/,
      /\b(fetch|setInterval|setTimeout)\s*\(/,
    ];
    if (forbidden.some((pattern) => pattern.test(source))) creativePlacementBoundaryViolations.push(path.relative(serverRoot, target));
  }
  if (target.includes("creative-intent")) {
    const forbidden = [
      /from\s+["'][^"']*(openai|provider|execution|campaign|advertising|publishing|analytics|performance|website|worker|queue|redis|billing|content-asset|creative-placement)[^"']*["']/i,
      /\b(content_assets|creative_placements|performance_observations|campaigns|marketing_campaigns|execution_requests|website_projects|website_pages|impressions|clicks|conversions|ctr|cpa|roas)\b/i,
      /from\s+["'][^"']*db\/database\.mjs["']/,
      /\b(fetch|setInterval|setTimeout)\s*\(/,
    ];
    if (forbidden.some((pattern) => pattern.test(source))) creativeIntentBoundaryViolations.push(path.relative(serverRoot, target));
  }
  if (target.includes("distribution-context") || target.includes(`${path.sep}distribution${path.sep}`)) {
    const forbidden = [
      /from\s+["'][^"']*(ga4|google-analytics|instagram|sms|crm|openai|provider-adapter|connector|fraud|attribution|performance|analytics|campaign|website-builder|landing-builder|worker|queue|redis)[^"']*["']/i,
      /\b(performance_observations|distribution_touches|sessions|customers|leads|marketing_campaigns|campaign_metrics|impressions|clicks|conversions|ctr|cpa|roas|utm_source|utm_medium|utm_campaign)\b/i,
      /from\s+["'][^"']*db\/database\.mjs["']/,
      /\b(fetch|setInterval|setTimeout)\s*\(/,
    ];
    if (forbidden.some(pattern=>pattern.test(source))) distributionBoundaryViolations.push(path.relative(serverRoot,target));
  }
  if (target.includes("attribution-touch")) {
    const forbidden = [
      /from\s+["'][^"']*(ga4|google-analytics|instagram|sms|crm|openai|provider-adapter|connector|fraud|performance|analytics|campaign|website-builder|landing-builder|worker|queue|redis)[^"']*["']/i,
      /\b(performance_observations|customers|leads|marketing_campaigns|campaign_metrics|conversions|attribution_credit|fraud_score|ctr|cpa|roas)\b/i,
      /from\s+["'][^"']*db\/database\.mjs["']/,
      /\b(fetch|setInterval|setTimeout)\s*\(/,
    ];
    if (forbidden.some(pattern=>pattern.test(source))) attributionTouchBoundaryViolations.push(path.relative(serverRoot,target));
  }
  if (target.includes(`${path.sep}content-generation${path.sep}`) || target.endsWith(`${path.sep}content-generation-service.mjs`) || target.endsWith(`${path.sep}content-generation-repository.mjs`) || target.endsWith(`${path.sep}content-generation.mjs`)) {
    const forbidden = [
      /from\s+["'][^"']*(action-proposal|execution-authorization|execution-request|execution-ledger|dispatch-job|execution-capabilit|provider-account-identit|action-input|messaging|automation|legacy-crm|campaign)[^"']*["']/i,
      /\b(action_proposals|execution_authorizations|execution_requests|execution_attempts|execution_results|execution_dispatch_jobs|provider_account_identities|execution_action_inputs|automations|executions)\b/i,
      /from\s+["'][^"']*db\/database\.mjs["']/,
    ];
    if (forbidden.some((pattern) => pattern.test(source))) creativeGenerationBoundaryViolations.push(path.relative(serverRoot, target));
  }
  if (target.includes(`${path.sep}onboarding${path.sep}`) || target.endsWith(`${path.sep}onboarding-service.mjs`) || target.endsWith(`${path.sep}onboarding.mjs`)) {
    const forbidden = [
      /from\s+["'][^"']*(openai|cloudflare|agent|embedding|model|messaging|automation|execution|provider|worker|queue)[^"']*["']/i,
      /\b(action_proposals|execution_authorizations|execution_requests|execution_attempts|execution_results|execution_dispatch_jobs|provider_account_identities|automations|executions)\b/i,
      /from\s+["'][^"']*db\/database\.mjs["']/,
    ];
    if (forbidden.some((pattern) => pattern.test(source))) {
      onboardingBoundaryViolations.push(path.relative(serverRoot, target));
    }
  }
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
    target.includes(`${path.sep}app${path.sep}semantic${path.sep}`) ||
    target.includes(`${path.sep}app${path.sep}recommendations${path.sep}`) ||
    target.endsWith(`${path.sep}listening-service.mjs`) ||
    target.endsWith(`${path.sep}listening-event-mapper-service.mjs`)
    || target.endsWith(`${path.sep}listening-intelligence-service.mjs`)
    || target.endsWith(`${path.sep}semantic-intelligence-service.mjs`)
    || target.endsWith(`${path.sep}semantic-finding-repository.mjs`)
    || target.endsWith(`${path.sep}recommendation-intelligence-service.mjs`)
    || target.endsWith(`${path.sep}recommendation-intelligence.mjs`)
    || target.endsWith(`${path.sep}intelligence-recommendation-repository.mjs`)
    || target.endsWith(`${path.sep}human-governance-service.mjs`)
    || target.endsWith(`${path.sep}human-governance.mjs`)
    || target.endsWith(`${path.sep}human-governance-repository.mjs`)
    || target.endsWith(`${path.sep}recommendation-freshness-query.mjs`)
    || target.includes(`${path.sep}app${path.sep}action-proposals${path.sep}`)
    || target.endsWith(`${path.sep}action-proposal-service.mjs`)
    || target.endsWith(`${path.sep}action-proposal-repository.mjs`)
    || target.endsWith(`${path.sep}action-proposals.mjs`)
    || target.includes(`${path.sep}app${path.sep}execution-authorizations${path.sep}`)
    || target.endsWith(`${path.sep}execution-authorization-service.mjs`)
    || target.endsWith(`${path.sep}execution-authorization-repository.mjs`)
    || target.endsWith(`${path.sep}execution-authorizations.mjs`)
    || target.includes(`${path.sep}app${path.sep}execution-requests${path.sep}`)
    || target.endsWith(`${path.sep}execution-request-service.mjs`)
    || target.endsWith(`${path.sep}execution-request-repository.mjs`)
    || target.endsWith(`${path.sep}execution-requests.mjs`)
    || target.includes(`${path.sep}app${path.sep}execution-capabilities${path.sep}`)
    || target.includes(`${path.sep}app${path.sep}provider-account-identities${path.sep}`)
    || target.endsWith(`${path.sep}provider-account-identity-service.mjs`)
    || target.endsWith(`${path.sep}provider-account-identity-repository.mjs`)
    || target.endsWith(`${path.sep}provider-account-identities.mjs`)
    || target.includes(`${path.sep}app${path.sep}execution-ledger${path.sep}`)
    || target.endsWith(`${path.sep}execution-ledger-service.mjs`)
    || target.endsWith(`${path.sep}execution-ledger-repository.mjs`)
    || target.endsWith(`${path.sep}execution-ledger.mjs`)
    || target.includes(`${path.sep}app${path.sep}action-inputs${path.sep}`)
    || target.endsWith(`${path.sep}execution-action-input-service.mjs`)
    || target.endsWith(`${path.sep}execution-action-input-repository.mjs`)
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
    if (target.includes(`${path.sep}app${path.sep}semantic${path.sep}`) || target.includes("semantic-intelligence-service.mjs") || target.includes("semantic-finding-repository.mjs")) {
      forbidden.push(
        /from\s+["'][^"']*(database|business-event|forecast|listening-repository|automation|campaign|customer|lead|order|cart|attribution)[^"']*["']/i,
        /from\s+["'](?:openai|[^"']*(agent|embedding|recommendation|decision)[^"']*)["']/i,
        /\b(customers|leads|orders|carts|marketing_campaigns|campaign_metrics|attribution_touchpoints|business_events|canonical_listening_records|forecast_records|automations|executions)\b/i
      );
    }
    if (target.includes(`${path.sep}app${path.sep}recommendations${path.sep}`) || target.includes("recommendation-intelligence-service.mjs") || target.includes("recommendation-intelligence.mjs") || target.includes("intelligence-recommendation-repository.mjs")) {
      forbidden.push(
        /from\s+["'][^"']*(database|business-event|forecast|listening-repository|automation|execution|messaging|optimizer|campaign|customer|lead|order|cart|attribution|provider)[^"']*["']/i,
        /from\s+["'](?:openai|[^"']*(agent|embedding|decision)[^"']*)["']/i,
        /\b(customers|leads|orders|carts|marketing_campaigns|campaign_metrics|attribution_touchpoints|business_events|canonical_listening_records|forecast_records|automations|executions)\b/i
      );
    }
    if (target.includes("human-governance") || target.includes("recommendation-freshness-query.mjs")) {
      forbidden.push(
        /from\s+["'][^"']*(semantic|listening|customer|lead|order|cart|campaign|attribution|forecast|automation|execution|messaging|optimizer|provider|openai|model|agent|embedding|recommendation-producers)[^"']*["']/i,
        /\b(semantic_findings|canonical_listening_records|customers|leads|orders|carts|marketing_campaigns|campaign_metrics|attribution_touchpoints|forecast_records|automations|executions)\b/i
      );
    }
    if (target.includes("action-proposal")) {
      forbidden.push(
        /from\s+["'][^"']*(semantic|listening|customer|lead|order|cart|campaign|attribution|business-event|automation|execution|messaging|optimizer|provider|connector|openai|model|agent|embedding)[^"']*["']/i,
        /\b(semantic_findings|canonical_listening_records|customers|leads|orders|carts|marketing_campaigns|campaign_metrics|attribution_touchpoints|business_events|automations|executions|connector_connections)\b/i
      );
    }
    if (target.includes("execution-authorization")) {
      forbidden.push(
        /from\s+["'][^"']*(semantic|listening|recommendation-producers|provider|connector|credential|messaging|automation|legacy|campaign|customer|lead|order|cart|optimizer|openai|model|agent|embedding)[^"']*["']/i,
        /\b(semantic_findings|canonical_listening_records|connector_connections|customers|leads|orders|carts|marketing_campaigns|campaign_metrics|automations|executions)\b/i
      );
    }
    if (target.includes("execution-request")) {
      forbidden.push(
        /from\s+["'][^"']*(semantic|listening|recommendation-producers|provider-adapter|connector-adapter|credential|messaging|automation|legacy|campaign|customer|lead|order|cart|optimizer|openai|model|agent|embedding|queue|worker)[^"']*["']/i,
        /\b(semantic_findings|canonical_listening_records|customers|leads|orders|carts|marketing_campaigns|campaign_metrics|automations|executions|execution_attempts|execution_results|job_queue)\b/i
      );
    }
    if (target.includes(`${path.sep}execution-capabilities${path.sep}`)) {
      forbidden.push(
        /from\s+["'][^"']*(provider-adapter|connector-adapter|credential|secret|messaging|automation|legacy|campaign|customer|lead|order|cart|optimizer|openai|model|agent|embedding|semantic|listening|recommendation-producers|queue|worker|resend|kavenegar)[^"']*["']/i,
        /\b(semantic_findings|canonical_listening_records|customers|leads|orders|carts|marketing_campaigns|automations|executions|execution_attempts|execution_results|job_queue)\b/i,
        /process\.env\.(?:KAVENEGAR|RESEND|[^\s;]*(?:TOKEN|API_KEY|SECRET))/i
      );
    }
    if (target.includes("provider-account-identit")) {
      forbidden.push(
        /from\s+["'][^"']*(messaging|kavenegar|resend|provider-adapter|connector-adapter|automation|legacy|execution-attempt|execution-result|campaign|customer|lead|order|cart|optimizer|openai|model|agent|embedding|semantic|listening|recommendation-producers|queue|worker)[^"']*["']/i,
        /\b(semantic_findings|canonical_listening_records|customers|leads|orders|carts|marketing_campaigns|automations|executions|execution_attempts|execution_results|job_queue)\b/i,
        /process\.env/i,
        /\b(?:KAVENEGAR|RESEND|API_KEY|ACCESS_TOKEN|CLIENT_SECRET|OAUTH_TOKEN)\b/i
      );
    }
    if (target.includes("execution-ledger")) {
      forbidden.push(
        /from\s+["'][^"']*(provider-adapter|connector-adapter|provider-sdk|credential-resolver|messaging|automation|legacy|campaign|customer|lead|order|cart|optimizer|openai|model|agent|embedding|queue|worker|retry-runtime|reconciliation-runtime)[^"']*["']/i,
        /\b(customers|leads|orders|carts|marketing_campaigns|automations|job_queue)\b/i,
        /process\.env\.(?:KAVENEGAR|RESEND|[^\s;]*(?:TOKEN|API_KEY|SECRET))/i
      );
    }
    if (target.includes("dispatch-job") || target.includes(`${path.sep}dispatch-jobs${path.sep}`)) {
      forbidden.push(
        /from\s+["'][^"']*(provider-adapter|connector-adapter|provider-sdk|credential-resolver|messaging|automation|legacy|campaign|customer|lead|order|cart|optimizer|openai|model|agent|embedding|queue|worker|redis|bullmq|sqs|retry-runtime|reconciliation-runtime|resend|kavenegar)[^"']*["']/i,
        /\b(customers|leads|orders|carts|marketing_campaigns|automations|job_queue)\b/i,
        /process\.env\.(?:KAVENEGAR|RESEND|[^\s;]*(?:TOKEN|API_KEY|SECRET))/i
      );
    }
    if (target.includes("action-input")) {
      forbidden.push(
        /from\s+["'][^"']*(provider-adapter|credential-resolver|messaging|automation|optimizer|worker|queue|reconciliation)[^"']*["']/i,
        /from\s+["'](?:openai|[^"']*(agent|embedding|kms|vault|cloud)[^"']*)["']/i,
        /\b(provider_reference_records|secure_execution_artifacts|execution_result_provider_references|customers|leads|orders|carts|marketing_campaigns)\b/i
      );
    }
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
if (contentLibraryBoundaryViolations.length) {
  console.error(`Content Library boundary violations: ${contentLibraryBoundaryViolations.join(", ")}`);
  process.exitCode = 1;
}
if (contentAssetBoundaryViolations.length) {
  console.error(`Content Asset boundary violations: ${contentAssetBoundaryViolations.join(", ")}`);
  process.exitCode = 1;
}
if (creativePlacementBoundaryViolations.length) {
  console.error(`Creative Placement boundary violations: ${creativePlacementBoundaryViolations.join(", ")}`);
  process.exitCode = 1;
}
if (creativeIntentBoundaryViolations.length) {
  console.error(`Creative Intent boundary violations: ${creativeIntentBoundaryViolations.join(", ")}`);
  process.exitCode = 1;
}
if (distributionBoundaryViolations.length) {
  console.error(`Distribution boundary violations: ${distributionBoundaryViolations.join(", ")}`);
  process.exitCode = 1;
}
if (attributionTouchBoundaryViolations.length) {
  console.error(`Attribution Touch boundary violations: ${attributionTouchBoundaryViolations.join(", ")}`);
  process.exitCode = 1;
}
if (consumerBoundaryViolations.length) {
  console.error(
    `Business Context consumers, signal producers, feature producers, or model-input builders access forbidden persistence: ${consumerBoundaryViolations.join(", ")}`
  );
  process.exitCode = 1;
}
if (onboardingBoundaryViolations.length) {
  console.error(`Onboarding accesses forbidden AI, execution, provider, worker, queue, or raw database dependencies: ${onboardingBoundaryViolations.join(", ")}`);
  process.exitCode = 1;
}
if (creativeGenerationBoundaryViolations.length) {
  console.error(`Creative Generation accesses execution, messaging, automation, campaign, or raw database dependencies: ${creativeGenerationBoundaryViolations.join(", ")}`);
  process.exitCode = 1;
}
if (!violations.length && !consumerBoundaryViolations.length && !onboardingBoundaryViolations.length && !creativeGenerationBoundaryViolations.length && !contentAssetBoundaryViolations.length && !creativePlacementBoundaryViolations.length && !creativeIntentBoundaryViolations.length && !distributionBoundaryViolations.length && !attributionTouchBoundaryViolations.length) {
  console.log("Database import boundary is valid.");
  console.log("Business Context consumer boundary is valid.");
  console.log("Onboarding dependency boundary is valid.");
  console.log("Creative Generation dependency boundary is valid.");
  console.log("Content Asset dependency boundary is valid.");
  console.log("Creative Placement dependency boundary is valid.");
  console.log("Creative Intent dependency boundary is valid.");
  console.log("Distribution dependency boundary is valid.");
  console.log("Attribution Touch dependency boundary is valid.");
}
