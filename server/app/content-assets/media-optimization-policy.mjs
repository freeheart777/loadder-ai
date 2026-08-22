export const MEDIA_OPTIMIZATION_POLICY = Object.freeze({
  id: "media_optimization@1",
  imageMinimumSavingPercent: 15,
  videoMinimumSavingPercent: 20,
  sourceRecoveryMs: 7 * 24 * 60 * 60 * 1000,
  image: Object.freeze({ maxPixels: 40_000_000, minDimension: 320, maxDimension: 8192 }),
  video: Object.freeze({ maxUploadBytes: 100 * 1024 * 1024, minDurationSeconds: 1, maxDurationSeconds: 180, maxWidth: 3840, maxHeight: 2160, minShortSide: 320 }),
});

export function acceptOptimization({ originalBytes, candidateBytes, qualityPassed, compatibilityPassed, minimumSavingPercent }) {
  const savingPercent = originalBytes > 0 ? ((originalBytes - candidateBytes) / originalBytes) * 100 : 0;
  return Object.freeze({ accepted: Boolean(qualityPassed && compatibilityPassed && candidateBytes < originalBytes && savingPercent >= minimumSavingPercent), savingPercent });
}
