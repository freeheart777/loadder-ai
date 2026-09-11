import { apiFetch } from "./api";
import type { Item, MissionControl } from "./missionControlCopy";

/**
 * HOME — read-only adapters over endpoints that already exist.
 *
 * No endpoint is added, no shape is invented, nothing is written. Each zone
 * reads its own contract and fails on its own: one dead endpoint dims one zone
 * and leaves the rest of Home usable.
 *
 * Zone 1  GET /api/mission-control              the existing attention contract
 * Zone 2  GET /api/growth/copilot/runs          canonical prepared work
 * Zone 3  GET /api/intelligence/semantic/findings   canonical findings
 */

export type ZoneState<T> = { status: "loading" | "ok" | "failed"; data: T | null };

export type PreparedWork = { id: string; capability: string; createdAt: string | null };

export type Finding = {
  id: string;
  semanticType: string;
  state: string;
  calculatedAt: string | null;
  confidence: number | null;
};

async function readJson(path: string) {
  const response = await apiFetch(path);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error("READ_FAILED");
  return body as Record<string, unknown>;
}

/** Zone 1. Canonical order is the emitted order; Home shows the first item. */
export async function readAttention(): Promise<MissionControl> {
  const body = await readJson("/api/mission-control");
  const missionControl = body.missionControl as MissionControl | undefined;
  if (!missionControl || !Array.isArray(missionControl.items)) throw new Error("READ_FAILED");
  return missionControl;
}

export function primaryItem(missionControl: MissionControl | null): Item | null {
  return missionControl?.items?.[0] ?? null;
}

/**
 * Zone 2. Only runs the canonical record marks PREPARED — something was made
 * and a person has not answered yet. A succeeded run is finished, not in
 * progress, and nothing else in the record says how far along anything is.
 */
export async function readPreparedWork(): Promise<PreparedWork[]> {
  const body = await readJson("/api/growth/copilot/runs?limit=25");
  const items = (body.items ?? body.runs) as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items)) throw new Error("READ_FAILED");
  return items
    .filter((row) => String(row.status) === "PREPARED")
    .map((row) => ({
      id: String(row.id),
      capability: String(row.capability ?? ""),
      createdAt: (row.createdAt ?? row.created_at ?? null) as string | null,
    }));
}

/** Zone 3. Findings as recorded, newest first, including the ones that say too little. */
export async function readFindings(): Promise<Finding[]> {
  const body = await readJson("/api/intelligence/semantic/findings?limit=10");
  const findings = body.findings as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(findings)) throw new Error("READ_FAILED");
  return findings.map((row) => ({
    id: String(row.id),
    semanticType: String(row.semanticType ?? ""),
    state: String(row.state ?? ""),
    calculatedAt: (row.calculatedAt ?? null) as string | null,
    confidence: (row.confidence ?? null) as number | null,
  }));
}
