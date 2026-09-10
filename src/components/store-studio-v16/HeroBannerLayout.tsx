import { ArrowLeft, ImageSquare } from "@phosphor-icons/react";
import { bannerConfigForSection, layoutHeightPixels } from "./config";
import type {
  DeviceMode,
  HeroConfig,
  LayoutDirection,
  LayoutRatio,
  MediaSlot,
  MediaSlotKey,
  SectionConfig,
  StudioConfig,
} from "./types";

type MediaControlRenderer = (slot: MediaSlotKey, hasImage: boolean) => React.ReactNode;

type MediaTileProps = {
  slot: MediaSlot;
  slotKey: MediaSlotKey;
  label: string;
  minHeight: number;
  control?: MediaControlRenderer;
  featured?: boolean;
};

function MediaTile({ slot, slotKey, label, minHeight, control, featured = false }: MediaTileProps) {
  return (
    <div
      data-media-slot={slotKey}
      className="group/media-slot relative h-full min-w-0 overflow-hidden rounded-[inherit] bg-slate-100"
      style={{ minHeight }}
    >
      {slot.imageUrl ? (
        <img src={slot.imageUrl} alt={slot.altText || label} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 text-center text-slate-400">
          <div>
            <ImageSquare size={featured ? 58 : 38} className="mx-auto" />
            <b className="mt-2 block text-xs text-slate-600">{label}</b>
            {control && <span className="mt-1 block text-[10px]">برای انتخاب تصویر کلیک کنید</span>}
          </div>
        </div>
      )}
      {control?.(slotKey, Boolean(slot.imageUrl))}
    </div>
  );
}

function desktopColumns(ratio: LayoutRatio, direction: LayoutDirection, primaryIsMedia: boolean) {
  const primary = ratio;
  const secondary = 100 - ratio;
  const mediaFirst = direction === "media-left";
  const first = primaryIsMedia === mediaFirst ? primary : secondary;
  return `${first}fr ${100 - first}fr`;
}

function orderedPair(
  media: React.ReactNode,
  companion: React.ReactNode,
  direction: LayoutDirection,
) {
  return direction === "media-left" ? [media, companion] : [companion, media];
}

function TextContent({
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  textColor,
  primaryColor,
  buttonRadius,
  alignment,
  device,
  onPrimaryAction,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  textColor: string;
  primaryColor: string;
  buttonRadius: number;
  alignment: "right" | "center" | "left";
  device: DeviceMode;
  onPrimaryAction?: () => void;
}) {
  const safeLink = (value?: string) => value && (/^(?:https:\/\/|\/|#)/.test(value) ? value : undefined);
  return (
    <div dir="rtl" className="flex h-full items-center p-6 sm:p-8 lg:p-12" style={{ color: textColor }}>
      <div className="w-full" style={{ textAlign: alignment }}>
        {eyebrow && <span className="inline-flex rounded-full bg-current/10 px-3 py-1 text-[11px] font-black">{eyebrow}</span>}
        {title && <h2 className="mt-4 font-black leading-[1.16]" style={{ fontSize: device === "mobile" ? 32 : device === "tablet" ? 40 : 50 }}>{title}</h2>}
        {subtitle && <p className="mt-4 max-w-2xl text-sm leading-8 opacity-75">{subtitle}</p>}
        {(ctaLabel || secondaryCtaLabel) && (
          <div className={`mt-6 flex flex-wrap gap-3 ${alignment === "center" ? "justify-center" : alignment === "left" ? "justify-end" : "justify-start"}`}>
            {ctaLabel && (
              <a
                href={safeLink(ctaHref) || "#products"}
                onClick={(event) => { if (onPrimaryAction) { event.preventDefault(); onPrimaryAction(); } }}
                className="inline-flex min-h-11 items-center gap-2 px-6 py-3 text-xs font-black text-white"
                style={{ background: primaryColor, borderRadius: buttonRadius }}
              >
                {ctaLabel}<ArrowLeft size={15} />
              </a>
            )}
            {secondaryCtaLabel && (
              <a
                href={safeLink(secondaryCtaHref) || "#"}
                className="inline-flex min-h-11 items-center border border-current/25 bg-white/10 px-6 py-3 text-xs font-black"
                style={{ borderRadius: buttonRadius }}
              >
                {secondaryCtaLabel}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResponsivePair({
  device,
  ratio,
  direction,
  primaryIsMedia,
  media,
  companion,
}: {
  device: DeviceMode;
  ratio: LayoutRatio;
  direction: LayoutDirection;
  primaryIsMedia: boolean;
  media: React.ReactNode;
  companion: React.ReactNode;
}) {
  if (device === "mobile") return <div className="grid grid-cols-1">{media}{companion}</div>;
  const children = orderedPair(media, companion, direction);
  return <div className="grid h-full min-w-0" style={{ gridTemplateColumns: desktopColumns(ratio, direction, primaryIsMedia), direction: "ltr" }}>{children}</div>;
}

export function HeroLayoutRenderer({
  hero,
  design,
  device,
  renderMediaControl,
  onPrimaryAction,
}: {
  hero: HeroConfig;
  design: StudioConfig["design"];
  device: DeviceMode;
  renderMediaControl?: MediaControlRenderer;
  onPrimaryAction?: () => void;
}) {
  const layout = hero.layout === "split" ? "image-text" : hero.layout === "background" ? "full-image" : hero.layout === "centered" || hero.layout === "minimal" ? "text-led" : hero.layout;
  const minHeight = device === "mobile" ? 250 : layoutHeightPixels[hero.heightPreset];
  const media = (slot: MediaSlotKey, label: string, featured = false, compact = false) => (
    <MediaTile
      slot={hero.mediaSlots[slot]}
      slotKey={slot}
      label={label}
      minHeight={device === "mobile" ? (compact ? 170 : 250) : compact ? Math.max(150, minHeight / 2) : minHeight}
      control={renderMediaControl}
      featured={featured}
    />
  );
  const text = (
    <TextContent
      eyebrow={hero.eyebrow}
      title={hero.title}
      subtitle={hero.subtitle}
      ctaLabel={hero.ctaLabel}
      ctaHref={hero.ctaHref}
      secondaryCtaLabel={hero.secondaryCtaLabel}
      secondaryCtaHref={hero.secondaryCtaHref}
      textColor={hero.textColor}
      primaryColor={design.primaryColor}
      buttonRadius={design.buttonRadius}
      alignment={hero.alignment}
      device={device}
      onPrimaryAction={onPrimaryAction}
    />
  );
  const hasText = Boolean(hero.eyebrow || hero.title || hero.subtitle || hero.ctaLabel || hero.secondaryCtaLabel);
  const editor = Boolean(renderMediaControl);
  const hasMedia = (slot: MediaSlotKey) => Boolean(hero.mediaSlots[slot].imageUrl);
  const fullMedia = (slot: MediaSlotKey = "main") => <div data-hero-layout="full-image" style={{ minHeight }}>{media(slot, "تصویر تمام‌عرض", true)}</div>;
  const fullText = <div data-hero-layout="text-only" style={{ minHeight }}>{text}</div>;

  if (!editor && !hasMedia("main")) {
    if (hasText) return fullText;
    if (hasMedia("secondary")) return fullMedia("secondary");
    if (hasMedia("tertiary")) return fullMedia("tertiary");
    return null;
  }

  if (layout === "full-image" || !hasText) {
    return <div className="relative" data-hero-layout="full-image" style={{ minHeight }}>
      {media("main", "تصویر تمام‌عرض", true)}
      {layout === "full-image" && hasText && <div className="absolute inset-0 z-20" style={{ background: `rgba(15,23,42,${Math.min(90, Math.max(0, hero.overlayOpacity)) / 100})` }}>{text}</div>}
    </div>;
  }
  if (layout === "main-two") {
    const secondarySlots = editor ? (["secondary", "tertiary"] as MediaSlotKey[]) : (["secondary", "tertiary"] as MediaSlotKey[]).filter(hasMedia);
    if (!secondarySlots.length) return fullMedia();
    const secondary = <div className={`grid min-w-0 ${device === "mobile" ? "grid-cols-1" : secondarySlots.length > 1 ? "grid-rows-2" : "grid-rows-1"}`}>{secondarySlots.map((slot, index) => <div key={slot} className="h-full">{media(slot, index ? "بنر سوم" : "بنر دوم", false, true)}</div>)}</div>;
    return <ResponsivePair device={device} ratio={hero.ratio} direction={hero.direction} primaryIsMedia media={media("main", "بنر اصلی", true)} companion={secondary} />;
  }
  if (layout === "main-secondary") {
    if (!editor && !hasMedia("secondary")) return fullMedia();
    return <ResponsivePair device={device} ratio={hero.ratio} direction={hero.direction} primaryIsMedia media={media("main", "بنر اصلی", true)} companion={media("secondary", "بنر ثانویه")} />;
  }
  return <ResponsivePair device={device} ratio={hero.ratio} direction={hero.direction} primaryIsMedia={layout !== "text-led"} media={media("main", "تصویر Hero", true)} companion={text} />;
}

export function BannerLayoutRenderer({
  section,
  config,
  device,
  renderMediaControl,
}: {
  section: SectionConfig;
  config: StudioConfig;
  device: DeviceMode;
  renderMediaControl?: MediaControlRenderer;
}) {
  const banner = bannerConfigForSection(section);
  const minHeight = device === "mobile" ? 190 : layoutHeightPixels[banner.height];
  const media = (slot: MediaSlotKey, label: string, featured = false, compact = false) => (
    <MediaTile
      slot={banner.mediaSlots[slot]}
      slotKey={slot}
      label={label}
      minHeight={device === "mobile" ? (compact ? 150 : 210) : compact ? Math.max(130, minHeight / 2) : minHeight}
      control={renderMediaControl}
      featured={featured}
    />
  );
  const text = (
    <TextContent
      eyebrow={section.eyebrow}
      title={section.title}
      subtitle={section.subtitle}
      ctaLabel={section.ctaLabel}
      ctaHref={section.ctaHref}
      textColor={section.textColor}
      primaryColor={config.design.primaryColor}
      buttonRadius={config.design.buttonRadius}
      alignment="right"
      device={device}
    />
  );
  const hasText = Boolean(section.eyebrow || section.title || section.subtitle || section.ctaLabel);
  const editor = Boolean(renderMediaControl);
  const hasMedia = (slot: MediaSlotKey) => Boolean(banner.mediaSlots[slot].imageUrl);
  const fullMedia = (slot: MediaSlotKey = "main") => <div data-banner-layout="full-width" style={{ minHeight }}>{media(slot, "بنر تمام‌عرض", true)}</div>;
  const fullText = <div data-banner-layout="text-only" style={{ minHeight }}>{text}</div>;

  if (!editor && !hasMedia("main")) {
    if (hasText) return fullText;
    if (hasMedia("secondary")) return fullMedia("secondary");
    if (hasMedia("tertiary")) return fullMedia("tertiary");
    return null;
  }

  if (banner.layout === "full-width" || ((banner.layout === "image-text" || banner.layout === "text-image") && !hasText)) {
    return fullMedia();
  }
  if (banner.layout === "main-two") {
    const secondarySlots = editor ? (["secondary", "tertiary"] as MediaSlotKey[]) : (["secondary", "tertiary"] as MediaSlotKey[]).filter(hasMedia);
    if (!secondarySlots.length) return fullMedia();
    const secondary = <div className={`grid min-w-0 ${device === "mobile" ? "grid-cols-1" : secondarySlots.length > 1 ? "grid-rows-2" : "grid-rows-1"}`}>{secondarySlots.map((slot, index) => <div key={slot} className="h-full">{media(slot, index ? "بنر سوم" : "بنر دوم", false, true)}</div>)}</div>;
    return <ResponsivePair device={device} ratio={banner.ratio} direction={banner.direction} primaryIsMedia media={media("main", "بنر اصلی", true)} companion={secondary} />;
  }
  if (banner.layout === "two-up") {
    if (!editor && !hasMedia("secondary")) return fullMedia();
    return <ResponsivePair device={device} ratio={banner.ratio} direction={banner.direction} primaryIsMedia media={media("main", "بنر اول", true)} companion={media("secondary", "بنر دوم")} />;
  }
  return <ResponsivePair device={device} ratio={banner.ratio} direction={banner.direction} primaryIsMedia media={media("main", "تصویر بنر", true)} companion={text} />;
}
