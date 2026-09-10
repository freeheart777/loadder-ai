import { apiFetch } from "./api";
import type { MissionControlItem } from "./beginnerCopy";

/**
 * Read-only adapters for the Loadder Home zones.
 *
 * Every zone reads an endpoint that already exists. No endpoint was added, no
 * persistence was created, and nothing here writes. When a source is missing or
 * fails, the zone reports that honestly rather than inferring a value.
 */

export type ZoneState<T> = { status: "loading" | "ready" | "failed"; data: T | null };

async function read<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error("HOME_READ_FAILED");
  return body as T;
}

// --- Zone 1 -----------------------------------------------------------------

export type MissionControl = {
  contractVersion: number;
  generatedAt: string;
  items: MissionControlItem[];
  banners: Array<{ code: string; staleReasons?: string[] }>;
  signalStatus: Array<{ signalId: string; status: "ok" | "failed" }>;
  bounds: { maxItems: number; truncated: boolean };
};

export const readMissionControl = () =>
  read<{ missionControl: MissionControl }>("/api/mission-control").then((body) => body.missionControl);

// --- Zone 2 -----------------------------------------------------------------

/**
 * Work in flight, counted from the canonical business-state snapshot. These are
 * counts of real records, never a synthesised progress percentage and never a
 * workflow state this surface invented.
 */
export type BusinessState = {
  experiments: { open: Array<{ id: string; status: string }>; truncated: boolean };
  content: { pendingCandidateIds: string[]; reconciliationRequiredIds: string[]; truncated: boolean };
};

export type InProgress = { openWork: number; awaitingYou: number; needsSorting: number; total: number };

export function summariseInProgress(state: BusinessState): InProgress {
  const openWork = state.experiments?.open?.length ?? 0;
  const awaitingYou = state.content?.pendingCandidateIds?.length ?? 0;
  const needsSorting = state.content?.reconciliationRequiredIds?.length ?? 0;
  return { openWork, awaitingYou, needsSorting, total: openWork + awaitingYou + needsSorting };
}

export const readInProgress = () =>
  read<{ state: BusinessState }>("/api/business-state").then((body) => summariseInProgress(body.state));

// --- Zone 3 -----------------------------------------------------------------

/**
 * The only canonical findings today are review-readiness assessments. They carry
 * their own uncertainty, so the zone renders what was counted and immediately
 * states the boundary. Nothing is inferred and no learning is stored.
 */
export type Finding = {
  id: string;
  state: string;
  calculatedAt: string;
  value?: { observedCount?: number; reasons?: string[] };
};

export type Learned = { observedCount: number; calculatedAt: string } | null;

export function latestLearned(findings: Finding[]): Learned {
  const usable = (findings ?? []).filter((f) => typeof f?.value?.observedCount === "number");
  if (usable.length === 0) return null;
  const newest = usable.reduce((best, f) => (f.calculatedAt > best.calculatedAt ? f : best));
  return { observedCount: newest.value?.observedCount ?? 0, calculatedAt: newest.calculatedAt };
}

export const readLearned = () =>
  read<{ findings: Finding[] }>("/api/intelligence/semantic/findings?semanticType=growth_experiment_review_readiness&limit=10")
    .then((body) => latestLearned(body.findings));
