import { buildContentTask } from "../tools/content.js";
import { buildCRMTask } from "../tools/crm.js";
import { buildAdsTask } from "../tools/ads.js";
import { buildAnalyticsTask } from "../tools/analytics.js";
import { buildAutomationTask } from "../tools/automation.js";

export function routeTask(input = {}) {
  const type = input.type || "content";

  if (type === "content") {
    return buildContentTask(input);
  }

  if (type === "crm") {
    return buildCRMTask(input);
  }

  if (type === "ads") {
    return buildAdsTask(input);
  }

  if (type === "analytics") {
    return buildAnalyticsTask(input);
  }

  if (type === "automation") {
    return buildAutomationTask(input);
  }

  throw new Error(
    `Unsupported agent task: ${type}`
  );
}
