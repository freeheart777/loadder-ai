export const MISSION_CONTROL_RANKING_POLICY = Object.freeze({
  version: "mission-control-ranking/1",
  maxItems: 7,
  defaultTarget: 4,
  maxUndecidedRecommendations: 2,
  maxRecommendationsPerExperiment: 25,
  pendingAgeFloorMs: 15 * 60 * 1000,
  conversionLookbackMs: 30 * 24 * 60 * 60 * 1000,
  bands: Object.freeze({ decideTodayAt: 6, reviewAt: 2 }),
});

export const MISSION_CONTROL_READ_POLICY = "ACTIVE_WORKSPACE_MEMBER";

export function overduePoints(relevantAt, now) {
  const age = Math.max(0, now.getTime() - Date.parse(relevantAt));
  if (age >= 30 * 24 * 60 * 60 * 1000) return 3;
  if (age >= 7 * 24 * 60 * 60 * 1000) return 2;
  return age > 0 ? 1 : 0;
}

export function missionControlBand(score) {
  if (score >= MISSION_CONTROL_RANKING_POLICY.bands.decideTodayAt) return "DECIDE_TODAY";
  if (score >= MISSION_CONTROL_RANKING_POLICY.bands.reviewAt) return "REVIEW";
  return "FYI";
}
