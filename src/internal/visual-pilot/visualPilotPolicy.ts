export const VISUAL_PILOT_CONTRACT = Object.freeze({
  componentId: "LOADDER_DOT_MATRIX",
  componentVersion: 1,
  runtimeTier: "INTERACTIVE",
  mobileTier: "STATIC",
  motionPolicy: "REDUCED_MOTION_STATIC",
  fallbackPolicy: "CSS_DOT_FIELD",
  maxInstancesPerPage: 1,
});

export type VisualPilotQualityTier = "LOW" | "BALANCED";
export type VisualPilotProps = {
  density?: number;
  intensity?: number;
  speed?: number;
  motionEnabled?: boolean;
  qualityTier?: VisualPilotQualityTier;
};

export const VISUAL_PILOT_DEFAULTS = Object.freeze({
  density: 42,
  intensity: 0.72,
  speed: 0.18,
  motionEnabled: true,
  qualityTier: "BALANCED" as VisualPilotQualityTier,
});

const bounded = (value: unknown, fallback: number, minimum: number, maximum: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;

export function normalizeVisualPilotProps(props: VisualPilotProps = {}) {
  return Object.freeze({
    density: bounded(props.density, VISUAL_PILOT_DEFAULTS.density, 20, 64),
    intensity: bounded(props.intensity, VISUAL_PILOT_DEFAULTS.intensity, 0.25, 1),
    speed: bounded(props.speed, VISUAL_PILOT_DEFAULTS.speed, 0.05, 0.4),
    motionEnabled: props.motionEnabled !== false,
    qualityTier: props.qualityTier === "LOW" ? "LOW" as const : "BALANCED" as const,
  });
}

export function shouldUseStaticVisual({
  reducedMotion = false,
  mobile = false,
  lowPower = false,
  motionEnabled = true,
  qualityTier = "BALANCED" as VisualPilotQualityTier,
} = {}) {
  return reducedMotion || mobile || lowPower || !motionEnabled || qualityTier === "LOW";
}

export function visualPilotFrame(timeSeconds: number, speed: number) {
  const safeTime = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
  const safeSpeed = bounded(speed, VISUAL_PILOT_DEFAULTS.speed, 0.05, 0.4);
  return safeTime * safeSpeed;
}
