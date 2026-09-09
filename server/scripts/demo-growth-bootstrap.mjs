import { seedGrowthLoopFixture } from "../test-helpers/growth-loop-fixture.mjs";

// Reserved for local Growth Loop demo bootstrap only. It carries no special
// server-side meaning — it is just a syntactically valid Iranian mobile
// number that goes through the same real OTP send/verify/rate-limit path as
// any other number. Override with GROWTH_DEMO_MOBILE if it collides with
// something on your machine.
export const DEFAULT_DEMO_MOBILE = "09120000900";

export class GrowthDemoBootstrapError extends Error {
  constructor(message) {
    super(message);
    this.name = "GrowthDemoBootstrapError";
  }
}

async function getJson(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new GrowthDemoBootstrapError(`Could not reach ${url}: ${error.message}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new GrowthDemoBootstrapError(`GET ${url} failed (${response.status}): ${body.message || JSON.stringify(body)}`);
  }
  return body;
}

async function postJson(fetchImpl, url, payload) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new GrowthDemoBootstrapError(`Could not reach ${url}: ${error.message}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new GrowthDemoBootstrapError(`POST ${url} failed (${response.status}): ${body.message || JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Resolve a real, canonical, OTP-authenticated workspace/user/membership
 * (never hardcoded) and seed/reuse the Growth Loop demo prerequisites in it.
 * Never mints a session itself and never touches the developer's own
 * browser cookie — the developer still logs in through the normal UI.
 */
export async function runGrowthDemoBootstrap({
  nodeEnv = process.env.NODE_ENV,
  apiBaseUrl = process.env.GROWTH_DEMO_API_BASE_URL || "http://127.0.0.1:3001",
  frontendBaseUrl = process.env.GROWTH_DEMO_FRONTEND_BASE_URL || "http://localhost:5173",
  mobile = process.env.GROWTH_DEMO_MOBILE || DEFAULT_DEMO_MOBILE,
  fetchImpl = fetch,
  db,
  seedFixture = seedGrowthLoopFixture,
} = {}) {
  if (nodeEnv === "production") {
    throw new GrowthDemoBootstrapError(
      "Refusing to run: NODE_ENV=production. This is a development-only tool and must never run against a production server."
    );
  }
  if (!db) {
    throw new GrowthDemoBootstrapError("A database handle is required.");
  }

  const status = await getJson(fetchImpl, `${apiBaseUrl}/api/auth/status`);
  if (status.developmentOtpExposed !== true) {
    throw new GrowthDemoBootstrapError(
      `Refusing to run: developmentOtpExposed is not true at ${apiBaseUrl}/api/auth/status. ` +
        "Start the backend with AUTH_EXPOSE_DEV_OTP=true (development only)."
    );
  }

  const otp = await postJson(fetchImpl, `${apiBaseUrl}/api/auth/send-otp`, { mobile, name: "Growth Demo" });
  if (!otp.developmentOtp) {
    throw new GrowthDemoBootstrapError(
      "send-otp did not return a developmentOtp even though developmentOtpExposed=true; refusing to guess a code."
    );
  }

  const verified = await postJson(fetchImpl, `${apiBaseUrl}/api/auth/verify-otp`, { mobile, code: otp.developmentOtp });
  const workspaceId = verified.activeWorkspace?.id || null;
  const userId = verified.user?.id || null;
  const membershipId = (verified.memberships || []).find((m) => m.workspace.id === workspaceId)?.id || null;
  if (!workspaceId || !userId || !membershipId) {
    throw new GrowthDemoBootstrapError(
      "Could not resolve workspaceId/userId/membershipId from the verify-otp response."
    );
  }

  const seeded = await seedFixture({ db, workspaceId, userId, membershipId, mode: "reuse-or-create" });

  // The script's own verify-otp call above already consumed the first code.
  // Request a fresh one so the code printed below is still valid for the
  // developer to type into the real login screen.
  const freshOtp = await postJson(fetchImpl, `${apiBaseUrl}/api/auth/send-otp`, { mobile, name: "Growth Demo" });

  return {
    workspaceId,
    userId,
    membershipId,
    mobile,
    developmentOtp: freshOtp.developmentOtp || null,
    dashboardUrl: `${frontendBaseUrl}/dashboard`,
    url: `${frontendBaseUrl}/dashboard/growth-loop/${seeded.experimentId}`,
    missionControlSignals: [
      "EXPERIMENT_WINDOW_CLOSED_NO_DECISION",
      "CONTENT_CANDIDATE_STUCK",
    ],
    staleContextPrepared: false,
    ...seeded,
  };
}

function printReport(result) {
  console.log("Growth Loop local demo ready.");
  console.log(`  workspaceId:  ${result.workspaceId}`);
  console.log(`  experimentId: ${result.experimentId}`);
  console.log(`  candidateId:  ${result.candidateId}`);
  console.log(`  leadId:       ${result.leadId}`);
  console.log(`  attentionId:  ${result.attentionCandidateId}`);
  console.log("");
  console.log(`  Log in at ${new URL(result.url).origin}/signup with mobile ${result.mobile}`);
  console.log(`  (the development OTP is shown inline on the login screen; current code: ${result.developmentOtp})`);
  console.log("");
  console.log(`  Dashboard: ${result.dashboardUrl}`);
  console.log(`  Experiment: ${result.url}`);
  console.log(`  Mission Control: ${result.missionControlSignals.join(", ")}`);
  console.log("  Stale context: intentionally absent; the seeded context is current.");
  console.log(`RESULT_JSON: ${JSON.stringify(result)}`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  try {
    // Checked before importing the database module at all, so a
    // misconfigured NODE_ENV never even opens a database connection.
    if (process.env.NODE_ENV === "production") {
      throw new GrowthDemoBootstrapError(
        "Refusing to run: NODE_ENV=production. This is a development-only tool and must never run against a production server."
      );
    }
    const { db } = await import("../db/workspace-database.mjs");
    const result = await runGrowthDemoBootstrap({ db });
    printReport(result);
  } catch (error) {
    console.error(`demo:growth failed — ${error.message}`);
    process.exitCode = 1;
  }
}
