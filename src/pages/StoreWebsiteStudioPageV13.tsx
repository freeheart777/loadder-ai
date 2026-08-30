import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowsDownUp,
  Desktop,
  DeviceMobile,
  DeviceTablet,
  Eye,
  EyeSlash,
  FloppyDisk,
  GearSix,
  List,
  MagnifyingGlass,
  Plus,
  ShoppingCart,
  Trash,
  User,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";

import { apiFetch } from "../lib/api";
import { productMainImage } from "../lib/productMedia";

type PreviewMode = "desktop" | "tablet" | "mobile";
type Panel = "design" | "sections" | null;
type SectionType = "product-slider" | "banner-grid" | "trust" | "text";
type Section = {
  id: string;
  type: SectionType;
  title: string;
  enabled: boolean;
  mode?: "all" | "newest" | "in-stock";
  subtitle?: string;
  items?: string[];
};
type Product = {
  id: string;
  name: string;
  currency: string;
  basePriceMinor: number;
  brand?: string | null;
  metadata?: { gallery?: string[] };
  variants?: Array<{ inventoryQuantity: number; imageUrl?: string | null }>;
};
type Project = { id: string; name?: string; content: Record<string, any> };
type DesignSettings = {
  fontFamily: string;
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  typographyScale: number;
  borderRadius: number;
  sectionSpacing: number;
  heroOverlayIntensity: number;
  headingSize: number;
  bodyTextSize: number;
  buttonRadius: number;
  cardShadowStrength: number;
};
type CommerceTheme = {
  header?: {
    visible?: boolean;
    storeName?: string;
    logoUrl?: string;
    background?: string;
    textColor?: string;
    showSearch?: boolean;
    showAccount?: boolean;
    showCart?: boolean;
  };
  hero?: {
    visible?: boolean;
    title?: string;
    subtitle?: string;
    buttonText?: string;
    imageUrl?: string;
    textColor?: string;
  };
};

const seedSections: Section[] = [
  {
    id: "s1",
    type: "product-slider",
    title: "پیشنهاد ویژه",
    enabled: true,
    mode: "in-stock",
  },
  {
    id: "s2",
    type: "banner-grid",
    title: "بنرهای کمپین",
    enabled: true,
    items: ["ارسال رایگان برای خریدهای ویژه", "تخفیف محدود آخر هفته"],
  },
  {
    id: "s3",
    type: "product-slider",
    title: "جدیدترین محصولات",
    enabled: true,
    mode: "newest",
  },
  {
    id: "s4",
    type: "trust",
    title: "چرا از ما خرید کنید؟",
    enabled: true,
    items: ["ارسال سریع", "ضمانت بازگشت", "پرداخت امن", "پشتیبانی"],
  },
];
const seedDesign: DesignSettings = {
  fontFamily: "Vazirmatn",
  primaryColor: "#6d5dfc",
  textColor: "#111827",
  backgroundColor: "#ffffff",
  typographyScale: 100,
  borderRadius: 18,
  sectionSpacing: 32,
  heroOverlayIntensity: 38,
  headingSize: 38,
  bodyTextSize: 16,
  buttonRadius: 12,
  cardShadowStrength: 12,
};
const fonts = [
  "Vazirmatn",
  "IRANSansX",
  "Peyda",
  "Dana",
  "Shabnam",
  "Sahel",
  "Tahoma",
  "Arial",
];

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "خطا در ارتباط با سرور");
  return data;
}

function restoreDesign(content: Record<string, any>): DesignSettings {
  const legacy = content.storeBuilderV11?.design || {};
  const saved = content.storeBuilderV13?.design || {};
  return {
    ...seedDesign,
    fontFamily: legacy.font || seedDesign.fontFamily,
    primaryColor: legacy.primary || seedDesign.primaryColor,
    textColor: legacy.text || seedDesign.textColor,
    backgroundColor: legacy.surface || seedDesign.backgroundColor,
    borderRadius: legacy.radius ?? seedDesign.borderRadius,
    typographyScale: legacy.textScale ?? seedDesign.typographyScale,
    sectionSpacing: legacy.sectionGap ?? seedDesign.sectionSpacing,
    ...saved,
  };
}

export default function StoreWebsiteStudioPageV13() {
  const [project, setProject] = useState<Project | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<Section[]>(seedSections);
  const [design, setDesign] = useState<DesignSettings>(seedDesign);
  const [commerceTheme, setCommerceTheme] = useState<CommerceTheme>({});
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const listing = await readResponse(
          await apiFetch("/api/site-projects", { signal: controller.signal }),
        );
        const selected =
          (listing.projects || []).find(
            (item: any) => String(item.siteType).toUpperCase() === "STORE",
          ) || listing.projects?.[0];
        if (!selected) throw new Error("پروژه فروشگاهی پیدا نشد");
        const detail = await readResponse(
          await apiFetch(`/api/site-projects/${selected.id}`, {
            signal: controller.signal,
          }),
        );
        const loaded = detail.project as Project;
        setProject(loaded);
        const savedSections = loaded.content?.storeBuilderV11?.sections;
        if (Array.isArray(savedSections)) setSections(savedSections);
        setDesign(restoreDesign(loaded.content || {}));
        setCommerceTheme(loaded.content?.commerceStudioV7 || {});
        const catalog = await readResponse(
          await apiFetch(`/api/stores/${selected.id}/products`, {
            signal: controller.signal,
          }),
        );
        setProducts(catalog.products || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setMessage(
          error instanceof Error ? error.message : "خطا در بارگذاری استودیو",
        );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, []);

  async function save() {
    if (!project) return;
    setBusy(true);
    setMessage("");
    try {
      const legacyBuilder = project.content?.storeBuilderV11 || {};
      const legacyDesign = legacyBuilder.design || {};
      const legacyCommerce = project.content?.commerceStudioV7 || {};
      const content = {
        ...project.content,
        storeBuilderV11: {
          ...legacyBuilder,
          sections,
          design: {
            ...legacyDesign,
            font: design.fontFamily,
            primary: design.primaryColor,
            surface: design.backgroundColor,
            text: design.textColor,
            radius: design.borderRadius,
            textScale: design.typographyScale,
            sectionGap: design.sectionSpacing,
          },
        },
        storeBuilderV13: { version: 13, design },
        commerceStudioV7: {
          ...legacyCommerce,
          fontFamily: `${design.fontFamily}, Tahoma, sans-serif`,
          baseTextColor: design.textColor,
          accent: design.primaryColor,
          surface: design.backgroundColor,
          cardRadius: design.borderRadius,
        },
      };
      const result = await readResponse(
        await apiFetch(`/api/site-projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }),
      );
      setProject(result.project);
      setMessage("طراحی فروشگاه ذخیره شد");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ذخیره طراحی انجام نشد",
      );
    } finally {
      setBusy(false);
    }
  }

  function moveSection(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    setSections((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addSection(type: SectionType) {
    const title =
      type === "product-slider"
        ? "محصولات منتخب"
        : type === "banner-grid"
          ? "مجموعه بنر"
          : type === "trust"
            ? "اعتمادسازی"
            : "داستان برند";
    const items =
      type === "banner-grid"
        ? ["بنر جدید"]
        : type === "trust"
          ? ["ارسال سریع", "پرداخت امن"]
          : undefined;
    setSections((current) => [
      ...current,
      {
        id: `v13-${crypto.randomUUID()}`,
        type,
        title,
        enabled: true,
        mode: "all",
        items,
      },
    ]);
  }

  const visibleSections = useMemo(
    () => sections.filter((section) => section.enabled),
    [sections],
  );

  return (
    <main
      dir="rtl"
      className="h-screen overflow-hidden bg-[#080d15] text-white"
    >
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d141f] px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            aria-label="بازگشت به داشبورد"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 bg-white/5"
          >
            <ArrowRight />
          </Link>
          <div>
            <div className="text-[10px] font-bold tracking-[.18em] text-violet-300">
              STORE STUDIO V13
            </div>
            <h1 className="text-base font-black sm:text-lg">
              {project?.name || "استودیوی فروشگاه"}
            </h1>
          </div>
        </div>
        <StudioToolbar
          mode={mode}
          setMode={setMode}
          panel={panel}
          setPanel={setPanel}
          projectId={project?.id}
        />
        <button
          type="button"
          disabled={busy || !project}
          onClick={() => void save()}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black disabled:opacity-40"
        >
          <FloppyDisk />
          ذخیره
        </button>
      </header>

      <div className="grid h-[calc(100vh-64px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="order-2 overflow-auto bg-[#222b38] p-4 sm:p-7 lg:order-1">
          {busy && !project ? (
            <div className="grid min-h-96 place-items-center text-sm text-white/50">
              در حال آماده‌سازی استودیو…
            </div>
          ) : (
            <PreviewContainer mode={mode} design={design}>
              <StorePreview
                mode={mode}
                design={design}
                theme={commerceTheme}
                products={products}
                sections={visibleSections}
              />
            </PreviewContainer>
          )}
        </section>
        <aside className="order-1 max-h-[42vh] overflow-y-auto border-b border-white/10 bg-[#101722] p-5 lg:order-2 lg:max-h-none lg:border-b-0 lg:border-r">
          {panel === "sections" ? (
            <SectionsPanel
              sections={sections}
              setSections={setSections}
              move={moveSection}
              add={addSection}
            />
          ) : (
            <DesignPanel design={design} setDesign={setDesign} />
          )}
          {message && (
            <p
              role="status"
              className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-6 text-white/65"
            >
              {message}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

function StudioToolbar({
  mode,
  setMode,
  panel,
  setPanel,
  projectId,
}: {
  mode: PreviewMode;
  setMode: (mode: PreviewMode) => void;
  panel: Panel;
  setPanel: (panel: Panel) => void;
  projectId?: string;
}) {
  const modes: Array<{
    value: PreviewMode;
    label: string;
    icon: typeof Desktop;
  }> = [
    { value: "desktop", label: "دسکتاپ", icon: Desktop },
    { value: "tablet", label: "تبلت", icon: DeviceTablet },
    { value: "mobile", label: "موبایل", icon: DeviceMobile },
  ];
  return (
    <nav
      aria-label="ابزارهای استودیو"
      className="flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1"
    >
      {modes.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={mode === item.value}
          onClick={() => setMode(item.value)}
          className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold ${mode === item.value ? "bg-violet-600" : "text-white/65 hover:bg-white/10"}`}
        >
          <item.icon />
          {item.label}
        </button>
      ))}
      <span className="mx-1 h-7 w-px bg-white/10" />
      <button
        type="button"
        aria-pressed={panel === "design"}
        onClick={() => setPanel("design")}
        className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold ${panel === "design" ? "bg-violet-600" : "text-white/65 hover:bg-white/10"}`}
      >
        <GearSix />
        طراحی
      </button>
      <button
        type="button"
        aria-pressed={panel === "sections"}
        onClick={() => setPanel("sections")}
        className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold ${panel === "sections" ? "bg-violet-600" : "text-white/65 hover:bg-white/10"}`}
      >
        <ArrowsDownUp />
        بخش‌ها
      </button>
      {projectId ? (
        <Link
          target="_blank"
          rel="noreferrer"
          to={`/store/${projectId}`}
          className="flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white/65 hover:bg-white/10"
        >
          <Eye />
          پیش‌نمایش فروشگاه
        </Link>
      ) : (
        <span className="flex min-h-10 items-center px-3 text-xs text-white/30">
          پیش‌نمایش فروشگاه
        </span>
      )}
    </nav>
  );
}

function PreviewContainer({
  mode,
  design,
  children,
}: {
  mode: PreviewMode;
  design: DesignSettings;
  children: React.ReactNode;
}) {
  const width =
    mode === "desktop" ? "100%" : mode === "tablet" ? "768px" : "390px";
  const maxWidth = mode === "desktop" ? "1180px" : undefined;
  return (
    <div
      className="mx-auto min-h-full"
      data-preview-mode={mode}
      style={{ width, maxWidth }}
    >
      <div
        className="min-h-full overflow-hidden bg-white transition-[width,border-radius] duration-200"
        style={{
          borderRadius: mode === "desktop" ? 4 : 24,
          boxShadow: "0 24px 80px rgba(0,0,0,.28)",
          fontFamily: `${design.fontFamily}, Tahoma, sans-serif`,
          color: design.textColor,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function StorePreview({
  mode,
  design,
  theme,
  products,
  sections,
}: {
  mode: PreviewMode;
  design: DesignSettings;
  theme: CommerceTheme;
  products: Product[];
  sections: Section[];
}) {
  const mobile = mode === "mobile";
  const tablet = mode === "tablet";
  const header = theme.header || {};
  const hero = theme.hero || {};
  const storeName = header.storeName || "فروشگاه شما";
  return (
    <div
      style={{
        background: design.backgroundColor,
        fontSize: `${(design.bodyTextSize * design.typographyScale) / 100}px`,
        lineHeight: 1.8,
      }}
    >
      {header.visible !== false &&
        (mobile ? (
          <header
            className="border-b border-slate-200 bg-white px-4 py-3"
            style={{ color: header.textColor || design.textColor }}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="منوی فروشگاه"
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200"
              >
                <List />
              </button>
              {header.logoUrl ? (
                <img
                  src={header.logoUrl}
                  alt=""
                  className="h-10 w-10 rounded-xl object-contain"
                />
              ) : null}
              <b className="min-w-0 flex-1 truncate">{storeName}</b>
              {header.showCart !== false && (
                <button
                  type="button"
                  aria-label="سبد خرید"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200"
                >
                  <ShoppingCart />
                </button>
              )}
            </div>
            {header.showSearch !== false && (
              <div className="mt-3 flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs text-slate-400">
                <MagnifyingGlass />
                جستجو در محصولات
              </div>
            )}
          </header>
        ) : (
          <header
            className="flex items-center gap-5 border-b border-slate-200 px-6"
            style={{
              minHeight: 72,
              background: header.background || "#fff",
              color: header.textColor || design.textColor,
            }}
          >
            {header.logoUrl ? (
              <img
                src={header.logoUrl}
                alt=""
                className="h-11 w-11 rounded-xl object-contain"
              />
            ) : null}
            <b className="shrink-0">{storeName}</b>
            {header.showSearch !== false && (
              <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-100 px-4 text-xs text-slate-400">
                <MagnifyingGlass />
                جستجو در فروشگاه
              </div>
            )}
            <nav className="flex items-center gap-2">
              {header.showAccount !== false && (
                <button
                  type="button"
                  className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs"
                >
                  <User />
                  حساب
                </button>
              )}
              {header.showCart !== false && (
                <button
                  type="button"
                  className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs"
                >
                  <ShoppingCart />
                  سبد
                </button>
              )}
            </nav>
          </header>
        ))}

      {hero.visible !== false && (
        <HeroPreview mobile={mobile} design={design} hero={hero} />
      )}
      {sections.map((section, index) => (
        <SectionPreview
          key={section.id}
          section={section}
          products={products}
          design={design}
          columns={mobile ? 2 : tablet ? 3 : 4}
          mobile={mobile}
          index={index}
        />
      ))}
      <footer
        className="px-6 py-8 text-center text-xs text-white/60"
        style={{ background: "#0f172a" }}
      >
        {storeName} · فروشگاه ساخته‌شده با لودر
      </footer>
    </div>
  );
}

function HeroPreview({
  mobile,
  design,
  hero,
}: {
  mobile: boolean;
  design: DesignSettings;
  hero: NonNullable<CommerceTheme["hero"]>;
}) {
  const overlay = Math.max(0, Math.min(100, design.heroOverlayIntensity)) / 100;
  const title = hero.title || "فروشگاهی که برای فروش ساخته شده";
  const subtitle =
    hero.subtitle || "محصولات شما، با تجربه‌ای سریع و حرفه‌ای برای مشتری.";
  if (mobile)
    return (
      <section style={{ background: design.primaryColor }}>
        {hero.imageUrl && (
          <div
            className="aspect-[4/3] bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,${overlay * 0.35}),rgba(0,0,0,${overlay * 0.35})),url(${hero.imageUrl})`,
            }}
          />
        )}
        <div
          className="px-5 py-8 text-center"
          style={{ color: hero.textColor || "#fff" }}
        >
          <h1
            className="font-black leading-tight"
            style={{ fontSize: `${Math.max(28, design.headingSize * 0.78)}px` }}
          >
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-sm opacity-85">{subtitle}</p>
          <button
            type="button"
            className="mt-6 min-h-11 px-5 font-bold"
            style={{
              borderRadius: design.buttonRadius,
              background: "#fff",
              color: design.primaryColor,
            }}
          >
            {hero.buttonText || "مشاهده محصولات"}
          </button>
        </div>
      </section>
    );
  return (
    <section
      className="relative flex min-h-[420px] items-center overflow-hidden bg-cover bg-center px-10"
      style={{
        backgroundColor: design.primaryColor,
        backgroundImage: hero.imageUrl
          ? `linear-gradient(90deg,rgba(5,10,20,${Math.min(1, overlay + 0.18)}),rgba(5,10,20,${overlay * 0.35})),url(${hero.imageUrl})`
          : `linear-gradient(135deg,${design.primaryColor},#111827)`,
        color: hero.textColor || "#fff",
      }}
    >
      <div className="max-w-2xl">
        <h1
          className="font-black leading-tight"
          style={{ fontSize: `${design.headingSize}px` }}
        >
          {title}
        </h1>
        <p className="mt-5 max-w-xl opacity-85">{subtitle}</p>
        <button
          type="button"
          className="mt-7 min-h-11 bg-white px-6 font-bold"
          style={{
            borderRadius: design.buttonRadius,
            color: design.primaryColor,
          }}
        >
          {hero.buttonText || "مشاهده محصولات"}
        </button>
      </div>
    </section>
  );
}

function SectionPreview({
  section,
  products,
  design,
  columns,
  mobile,
  index,
}: {
  section: Section;
  products: Product[];
  design: DesignSettings;
  columns: number;
  mobile: boolean;
  index: number;
}) {
  const padding = mobile
    ? "20px 14px"
    : `${design.sectionSpacing}px ${Math.max(24, design.sectionSpacing)}px`;
  const heading = (
    <h2
      className="mb-5 font-black"
      style={{
        fontSize: `${mobile ? Math.max(20, design.headingSize * 0.58) : Math.max(24, design.headingSize * 0.72)}px`,
      }}
    >
      {section.title}
    </h2>
  );
  if (section.type === "product-slider") {
    let list = [...products];
    if (section.mode === "in-stock")
      list = list.filter((product) =>
        (product.variants || []).some(
          (variant) => variant.inventoryQuantity > 0,
        ),
      );
    if (section.mode === "newest") list.reverse();
    list = list.slice(0, Math.max(columns, mobile ? 4 : 8));
    return (
      <section
        style={{
          padding,
          background: index % 2 ? "#f8fafc" : design.backgroundColor,
        }}
      >
        {heading}
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}
        >
          {list.length ? (
            list.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                design={design}
                mobile={mobile}
              />
            ))
          ) : (
            <EmptyProducts columns={columns} design={design} />
          )}
        </div>
      </section>
    );
  }
  if (section.type === "banner-grid")
    return (
      <section style={{ padding }}>
        {heading}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: mobile ? "1fr" : "repeat(2,minmax(0,1fr))",
          }}
        >
          {(section.items || ["بنر فروشگاه"]).map((item, itemIndex) => (
            <article
              key={`${section.id}-${itemIndex}`}
              className="flex min-h-36 items-end overflow-hidden p-5 text-white"
              style={{
                borderRadius: design.borderRadius,
                background: `linear-gradient(135deg,${design.primaryColor},#111827)`,
              }}
            >
              <b>{item}</b>
            </article>
          ))}
        </div>
      </section>
    );
  if (section.type === "trust")
    return (
      <section
        style={{
          padding,
          background: index % 2 ? "#f8fafc" : design.backgroundColor,
        }}
      >
        {heading}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${mobile ? 2 : 4},minmax(0,1fr))`,
          }}
        >
          {(section.items || []).map((item, itemIndex) => (
            <article
              key={`${section.id}-${itemIndex}`}
              className="border border-slate-200 bg-white p-4 text-center font-bold"
              style={{ borderRadius: design.borderRadius }}
            >
              {item}
            </article>
          ))}
        </div>
      </section>
    );
  return (
    <section className="text-center" style={{ padding }}>
      <h2
        className="font-black"
        style={{ fontSize: `${mobile ? 24 : design.headingSize}px` }}
      >
        {section.title}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-slate-500">
        {section.subtitle ||
          "داستان برند، معرفی فروشگاه یا پیام مهم شما در این بخش نمایش داده می‌شود."}
      </p>
    </section>
  );
}

function ProductCard({
  product,
  design,
  mobile,
}: {
  product: Product;
  design: DesignSettings;
  mobile: boolean;
}) {
  const shadowAlpha =
    Math.max(0, Math.min(40, design.cardShadowStrength)) / 100;
  return (
    <article
      className="min-w-0 overflow-hidden border border-slate-200 bg-white"
      style={{
        borderRadius: design.borderRadius,
        boxShadow: `0 10px 30px rgba(15,23,42,${shadowAlpha})`,
      }}
    >
      <div className="aspect-square overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {productMainImage(product) ? (
          <img
            src={productMainImage(product)}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className={mobile ? "p-3" : "p-4"}>
        <div className="truncate font-bold">{product.name}</div>
        {!mobile && product.brand ? (
          <div className="mt-1 truncate text-xs text-slate-400">
            {product.brand}
          </div>
        ) : null}
        <div
          className="mt-3 text-xs font-black"
          style={{ color: design.primaryColor }}
        >
          {new Intl.NumberFormat("fa-IR").format(
            (product.basePriceMinor || 0) / 100,
          )}{" "}
          {product.currency}
        </div>
      </div>
    </article>
  );
}

function EmptyProducts({
  columns,
  design,
}: {
  columns: number;
  design: DesignSettings;
}) {
  return (
    <>
      {Array.from({ length: columns }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden border border-slate-200 bg-white"
          style={{ borderRadius: design.borderRadius }}
        >
          <div className="aspect-square bg-slate-100" />
          <div className="p-3">
            <div className="h-3 rounded bg-slate-100" />
            <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </>
  );
}

function DesignPanel({
  design,
  setDesign,
}: {
  design: DesignSettings;
  setDesign: React.Dispatch<React.SetStateAction<DesignSettings>>;
}) {
  const patch = <K extends keyof DesignSettings>(
    key: K,
    value: DesignSettings[K],
  ) => setDesign((current) => ({ ...current, [key]: value }));
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[.18em] text-violet-300">
        DESIGN SYSTEM
      </p>
      <h2 className="mt-1 text-lg font-black">طراحی فروشگاه</h2>
      <div className="mt-5 space-y-4">
        <label className="block text-xs text-white/60">
          خانواده فونت
          <select
            value={design.fontFamily}
            onChange={(event) => patch("fontFamily", event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-white"
          >
            {fonts.map((font) => (
              <option key={font}>{font}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <Color
            label="اصلی"
            value={design.primaryColor}
            onChange={(value) => patch("primaryColor", value)}
          />
          <Color
            label="متن"
            value={design.textColor}
            onChange={(value) => patch("textColor", value)}
          />
          <Color
            label="زمینه"
            value={design.backgroundColor}
            onChange={(value) => patch("backgroundColor", value)}
          />
        </div>
        <Range
          label="مقیاس تایپوگرافی"
          suffix="%"
          min={80}
          max={130}
          value={design.typographyScale}
          onChange={(value) => patch("typographyScale", value)}
        />
        <Range
          label="گردی کارت"
          suffix="px"
          min={0}
          max={40}
          value={design.borderRadius}
          onChange={(value) => patch("borderRadius", value)}
        />
        <Range
          label="فاصله بخش‌ها"
          suffix="px"
          min={16}
          max={72}
          value={design.sectionSpacing}
          onChange={(value) => patch("sectionSpacing", value)}
        />
        <Range
          label="تیرگی Hero"
          suffix="%"
          min={0}
          max={90}
          value={design.heroOverlayIntensity}
          onChange={(value) => patch("heroOverlayIntensity", value)}
        />
        <Range
          label="اندازه عنوان"
          suffix="px"
          min={28}
          max={72}
          value={design.headingSize}
          onChange={(value) => patch("headingSize", value)}
        />
        <Range
          label="اندازه متن"
          suffix="px"
          min={13}
          max={22}
          value={design.bodyTextSize}
          onChange={(value) => patch("bodyTextSize", value)}
        />
        <Range
          label="گردی دکمه"
          suffix="px"
          min={0}
          max={32}
          value={design.buttonRadius}
          onChange={(value) => patch("buttonRadius", value)}
        />
        <Range
          label="شدت سایه کارت"
          suffix="%"
          min={0}
          max={40}
          value={design.cardShadowStrength}
          onChange={(value) => patch("cardShadowStrength", value)}
        />
      </div>
    </div>
  );
}

function SectionsPanel({
  sections,
  setSections,
  move,
  add,
}: {
  sections: Section[];
  setSections: React.Dispatch<React.SetStateAction<Section[]>>;
  move: (index: number, delta: number) => void;
  add: (type: SectionType) => void;
}) {
  const patch = (id: string, change: Partial<Section>) =>
    setSections((current) =>
      current.map((section) =>
        section.id === id ? { ...section, ...change } : section,
      ),
    );
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[.18em] text-violet-300">
        SECTIONS
      </p>
      <h2 className="mt-1 text-lg font-black">مدیریت بخش‌ها</h2>
      <div className="mt-5 space-y-3">
        {sections.map((section, index) => (
          <article
            key={section.id}
            className="rounded-2xl border border-white/10 bg-white/[.03] p-3"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={section.enabled ? "پنهان‌کردن بخش" : "نمایش بخش"}
                onClick={() => patch(section.id, { enabled: !section.enabled })}
                className="grid min-h-10 min-w-10 place-items-center rounded-lg bg-white/5"
              >
                {section.enabled ? <Eye /> : <EyeSlash />}
              </button>
              <input
                aria-label="عنوان بخش"
                value={section.title}
                onChange={(event) =>
                  patch(section.id, { title: event.target.value })
                }
                className="min-h-10 min-w-0 flex-1 rounded-lg bg-black/20 px-3 text-xs"
              />
              <button
                type="button"
                onClick={() => move(index, -1)}
                aria-label="انتقال به بالا"
                className="min-h-10 px-1"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                aria-label="انتقال به پایین"
                className="min-h-10 px-1"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() =>
                  setSections((current) =>
                    current.filter((item) => item.id !== section.id),
                  )
                }
                aria-label="حذف بخش"
                className="grid min-h-10 min-w-8 place-items-center text-red-400"
              >
                <Trash />
              </button>
            </div>
            {section.type === "product-slider" && (
              <select
                value={section.mode || "all"}
                onChange={(event) =>
                  patch(section.id, {
                    mode: event.target.value as Section["mode"],
                  })
                }
                className="mt-2 min-h-10 w-full rounded-lg bg-black/20 px-3 text-xs"
              >
                <option value="all">همه محصولات</option>
                <option value="newest">جدیدترین</option>
                <option value="in-stock">فقط موجود</option>
              </select>
            )}
            {(section.type === "banner-grid" || section.type === "trust") && (
              <textarea
                aria-label="آیتم‌های بخش"
                value={(section.items || []).join("\n")}
                onChange={(event) =>
                  patch(section.id, { items: event.target.value.split("\n") })
                }
                rows={3}
                className="mt-2 w-full rounded-lg bg-black/20 p-3 text-xs"
              />
            )}
            {section.type === "text" && (
              <textarea
                aria-label="متن بخش"
                value={section.subtitle || ""}
                onChange={(event) =>
                  patch(section.id, { subtitle: event.target.value })
                }
                rows={3}
                className="mt-2 w-full rounded-lg bg-black/20 p-3 text-xs"
              />
            )}
          </article>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <AddButton onClick={() => add("product-slider")}>محصولات</AddButton>
        <AddButton onClick={() => add("banner-grid")}>بنر</AddButton>
        <AddButton onClick={() => add("trust")}>اعتمادسازی</AddButton>
        <AddButton onClick={() => add("text")}>متن</AddButton>
      </div>
    </div>
  );
}

function AddButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-xs"
    >
      <Plus />
      {children}
    </button>
  );
}
function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-xl border border-white/10 p-2 text-center text-[10px] text-white/55">
      <input
        aria-label={`رنگ ${label}`}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mb-1 h-9 w-full rounded bg-transparent"
      />
      {label}
    </label>
  );
}
function Range({
  label,
  suffix,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs text-white/60">
      <span className="flex justify-between">
        <span>{label}</span>
        <b>
          {value}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full"
      />
    </label>
  );
}
