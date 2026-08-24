import type { CSSProperties } from "react";

export type LandingBlueprint = {
  goal: string;
  offer: string;
  audienceSummary: string;
  conversionStrategy?: {
    presetId: string;
    presetVersion: number;
    goal: string;
    channelStrategy: string;
    strategyVersion: number;
    audienceState: string;
    conversionAction: string;
    messageMatchPriority: string;
    proofPriority: string;
    frictionLevel: string;
    recommendedSectionSequence: string[];
  };
  primaryCta: { label: string; type: string; target: string } | null;
  secondaryCta: { label: string; type: string; target: string } | null;
  seo: { title: string; description: string };
  socialPreview: {
    title: string;
    description: string;
    imageAssetId: string | null;
  };
  sections: Array<{
    id: string;
    componentId: string;
    version: number;
    variant: string;
    props: Record<string, unknown>;
    contentBindings: Array<{ role: string; creativePlacementId: string }>;
    assetBindings: Array<{ role: string; contentAssetId: string }>;
    trackingBindings: Array<{ action: string }>;
  }>;
  websiteVisualDescriptors?: Array<{
    sectionId: string;
    descriptor: {
      componentId: string;
      componentVersion: number;
      props: Record<string, string>;
    };
  }>;
  designTokens: {
    font: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    foregroundColor: string;
    mutedColor: string;
    radius: string;
    spacingDensity: string;
    buttonStyle: string;
    containerWidth: string;
  };
  tracking: { enabledActions: string[] };
  accessibility: { mainLabel: string };
};
const text = (value: unknown) => (typeof value === "string" ? value : ""),
  items = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((x): x is string => typeof x === "string").slice(0, 12)
      : [];
const visualStyle = (
  blueprint: LandingBlueprint,
  sectionId: string,
): CSSProperties | undefined => {
  const visual = blueprint.websiteVisualDescriptors?.find(
    (item) => item.sectionId === sectionId,
  )?.descriptor;
  if (!visual) return;
  const token =
      visual.props.accentToken === "SECONDARY"
        ? blueprint.designTokens.secondaryColor
        : visual.props.accentToken === "MUTED"
          ? blueprint.designTokens.mutedColor
          : blueprint.designTokens.primaryColor,
    opacity =
      visual.props.intensity === "STRONG"
        ? 0.32
        : visual.props.intensity === "BALANCED"
          ? 0.22
          : 0.14;
  if (visual.componentId === "LOADDER_GRADIENT_FIELD")
    return {
      background: `radial-gradient(ellipse at ${visual.props.variant === "HALO" ? "50% 45%" : "15% 20%"},${token} 0,transparent 62%)`,
      opacity,
    };
  if (visual.componentId === "LOADDER_GLOW_BANDS")
    return {
      background: `linear-gradient(${visual.props.orientation === "HORIZONTAL" ? "0deg" : "-24deg"},transparent 0 24%,${token} 24% 30%,transparent 30% 62%,${token} 62% 68%,transparent 68% 100%)`,
      opacity,
    };
  if (visual.componentId === "LOADDER_GEOMETRIC_PATTERN")
    return {
      backgroundImage: `linear-gradient(45deg,${token} 25%,transparent 25% 75%,${token} 75%)`,
      backgroundSize:
        visual.props.density === "DENSE"
          ? "20px 20px"
          : visual.props.density === "MEDIUM"
            ? "32px 32px"
            : "48px 48px",
      opacity,
    };
};
export default function TrustedLandingRenderer({
  blueprint,
}: {
  blueprint: LandingBlueprint;
}) {
  const t = blueprint.designTokens,
    space =
      t.spacingDensity === "compact"
        ? "2rem 1.25rem"
        : t.spacingDensity === "spacious"
          ? "5rem 1.5rem"
          : "3rem 1.5rem",
    width =
      t.containerWidth === "narrow"
        ? "48rem"
        : t.containerWidth === "wide"
          ? "78rem"
          : "64rem",
    radius =
      t.radius === "pill"
        ? "999px"
        : t.radius === "lg"
          ? "24px"
          : t.radius === "sm"
            ? "8px"
            : "16px";
  return (
    <main
      aria-label={blueprint.accessibility.mainLabel}
      dir="rtl"
      style={{
        background: t.backgroundColor,
        color: t.foregroundColor,
        fontFamily: t.font === "serif" ? "serif" : "inherit",
        minHeight: "100%",
      }}
    >
      {blueprint.sections.map((section, index) => {
        const heading =
            text(section.props.headline) ||
            text(section.props.heading) ||
            section.componentId,
          body = text(section.props.body),
          list = items(section.props.items),
          hero = section.componentId === "HERO",
          cta = section.props.primaryCta as
            LandingBlueprint["primaryCta"] | undefined,
          visual = visualStyle(blueprint, section.id);
        return (
          <section
            key={section.id}
            data-component={section.componentId}
            style={{
              maxWidth: width,
              margin: "0 auto",
              padding: hero ? space : space,
              textAlign: section.variant === "CENTERED" ? "center" : "right",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {visual && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  ...visual,
                }}
              />
            )}
            <div
              style={{
                border: hero
                  ? "none"
                  : "1px solid color-mix(in srgb, currentColor 14%, transparent)",
                borderRadius: radius,
                padding: hero ? 0 : "2rem",
                position: "relative",
              }}
            >
              {index === 0 ? (
                <h1
                  style={{
                    fontSize: "clamp(2rem,6vw,4.5rem)",
                    lineHeight: 1.15,
                  }}
                >
                  {heading}
                </h1>
              ) : (
                <h2 style={{ fontSize: "clamp(1.5rem,4vw,2.5rem)" }}>
                  {heading}
                </h2>
              )}
              {body && (
                <p
                  style={{
                    color: t.mutedColor,
                    fontSize: "1.05rem",
                    lineHeight: 1.9,
                    maxWidth: "48rem",
                    margin:
                      section.variant === "CENTERED"
                        ? "1.25rem auto"
                        : "1.25rem 0",
                  }}
                >
                  {body}
                </p>
              )}
              {list.length > 0 && (
                <ul
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                    gap: "1rem",
                    listStyle: "none",
                    padding: 0,
                  }}
                >
                  {list.map((item, i) => (
                    <li
                      key={i}
                      style={{
                        borderRadius: radius,
                        background: t.secondaryColor,
                        padding: "1rem",
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {cta && (
                <a
                  href={cta.target}
                  style={{
                    display: "inline-flex",
                    minHeight: 44,
                    alignItems: "center",
                    marginTop: "1rem",
                    borderRadius: radius,
                    background:
                      t.buttonStyle === "outline"
                        ? "transparent"
                        : t.primaryColor,
                    color:
                      t.buttonStyle === "outline" ? t.primaryColor : "white",
                    border: `2px solid ${t.primaryColor}`,
                    padding: "0.7rem 1.2rem",
                    textDecoration: "none",
                  }}
                >
                  {cta.label}
                </a>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
