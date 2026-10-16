import { useEffect, useMemo, useRef, useState } from "react";
import StudioCanvas from "./StudioCanvas";
import { createConfigFromTemplate } from "./templates/registry";
import type { WebsiteTemplate } from "./templates/types";

// The picker preview is the template ITSELF: the same V16 config a created site starts from, rendered by the same
// canvas, scaled down and made inert. It cannot drift from the site the customer gets, and it needs no screenshots.
const DESIGN_WIDTH = 1200;
const NOOP = () => undefined;

export default function TemplateLivePreview({ template }: { template: WebsiteTemplate }) {
  const config = useMemo(() => createConfigFromTemplate(template), [template]);
  const frame = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.28);
  useEffect(() => {
    const node = frame.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => { if (entry?.contentRect.width) setScale(entry.contentRect.width / DESIGN_WIDTH); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div
    ref={frame}
    aria-hidden="true"
    data-template-preview={template.id}
    className="pointer-events-none relative aspect-[16/11] w-full select-none overflow-hidden rounded-xl border border-white/10 bg-white"
  >
    <div inert dir="rtl" className="absolute left-0 top-0 origin-top-left" style={{ width: DESIGN_WIDTH, transform: `scale(${scale})` }}>
      <StudioCanvas config={config} products={[]} device="desktop" selected={{ type: "section", id: null }} select={NOOP} interactive={false} />
    </div>
  </div>;
}
