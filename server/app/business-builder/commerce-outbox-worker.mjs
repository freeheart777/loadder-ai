import { runWithWorkspace } from "../tenant-context.mjs";
import { createCommerceRuntimeBridge } from "./commerce-runtime-bridge.mjs";

const now = () => new Date().toISOString();

function normalizePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function createCommerceOutboxWorker({
  db,
  projects = null,
  runtimeBridge = null,
  runInWorkspace = runWithWorkspace,
  intervalMs = 1000,
  batchSize = 50,
  workspaceLimit = 500,
  logger = console,
} = {}) {
  if (!db) throw new TypeError("db is required");
  if (!runtimeBridge && !projects) throw new TypeError("projects are required");
  if (typeof runInWorkspace !== "function") throw new TypeError("runInWorkspace is required");

  const bridge = runtimeBridge || createCommerceRuntimeBridge({ db, projects });
  const pollIntervalMs = normalizePositiveInteger(intervalMs, 1000, 60_000);
  const drainBatchSize = normalizePositiveInteger(batchSize, 50, 200);
  const maxWorkspaces = normalizePositiveInteger(workspaceLimit, 500, 5000);
  let timer = null;
  let inFlight = null;
  let shuttingDown = false;

  function schemaReady() {
    const columns = db.prepare("PRAGMA table_info(business_builder_commerce_outbox)").all();
    if (!columns.length) return false;
    const names = new Set(columns.map((column) => column.name));
    return ["workspace_id", "status", "available_at", "dead_lettered_at", "claim_expires_at"].every((name) => names.has(name));
  }

  function discoverWorkspaceIds() {
    if (!schemaReady()) return [];
    const ts = now();
    return db.prepare(`
      SELECT DISTINCT workspace_id
      FROM business_builder_commerce_outbox
      WHERE status = 'pending'
        AND dead_lettered_at IS NULL
        AND available_at <= ?
        AND (claim_expires_at IS NULL OR claim_expires_at <= ?)
      ORDER BY workspace_id
      LIMIT ?
    `).all(ts, ts, maxWorkspaces).map((row) => row.workspace_id);
  }

  async function drainOnce() {
    const workspaceIds = discoverWorkspaceIds();
    const workspaces = [];
    let processed = 0;
    let failed = 0;

    for (const workspaceId of workspaceIds) {
      try {
        const results = await runInWorkspace(workspaceId, () => bridge.drain({ limit: drainBatchSize }));
        const rows = Array.isArray(results) ? results : [];
        const failures = rows.filter((row) => row?.ok === false).length;
        processed += rows.length;
        failed += failures;
        workspaces.push({ workspaceId, processed: rows.length, failed: failures });
      } catch (error) {
        failed += 1;
        workspaces.push({ workspaceId, processed: 0, failed: 1, error: error?.message || String(error) });
        logger?.error?.(`[commerce-outbox-worker] workspace ${workspaceId} failed`, error);
      }
    }

    return { workspaceCount: workspaceIds.length, processed, failed, workspaces };
  }

  function tick() {
    if (shuttingDown) {
      return Promise.resolve({ workspaceCount: 0, processed: 0, failed: 0, workspaces: [], skipped: "shutting_down" });
    }
    if (inFlight) return inFlight;
    inFlight = drainOnce()
      .catch((error) => {
        logger?.error?.("[commerce-outbox-worker] poll failed", error);
        return { workspaceCount: 0, processed: 0, failed: 1, workspaces: [], error: error?.message || String(error) };
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  function start() {
    if (timer || shuttingDown) return false;
    void tick();
    timer = setInterval(() => void tick(), pollIntervalMs);
    return true;
  }

  function stop() {
    if (!timer) return false;
    clearInterval(timer);
    timer = null;
    return true;
  }

  async function shutdown() {
    if (shuttingDown) {
      if (inFlight) await inFlight;
      return false;
    }
    shuttingDown = true;
    stop();
    if (inFlight) await inFlight;
    return true;
  }

  return {
    start,
    stop,
    shutdown,
    tick,
    discoverWorkspaceIds,
    get running() {
      return Boolean(timer);
    },
    get draining() {
      return Boolean(inFlight);
    },
    get stopping() {
      return shuttingDown;
    },
  };
}
