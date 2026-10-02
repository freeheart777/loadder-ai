import { Link } from "react-router-dom";
import { hasDetailPage } from "./detailRegistry";
import { normalizeSlug } from "./pages";
import type { PageConfig, SectionConfig, SectionItem } from "./types";

export type CatalogService = { id: string; name: string; durationMinutes: number; modalities: string[]; price: { amount: number; currency: string | null } | null; providers: { id: string; name: string; modalities?: string[] }[] };

const MODE_LABELS: Record<string, string> = { IN_PERSON: "حضوری", VIDEO: "ویدئویی", AUDIO: "صوتی", TEXT: "متنی", ONLINE: "آنلاین" };
const modeLabel = (mode: string) => MODE_LABELS[mode] || mode;
const fa = (value: number) => value.toLocaleString("fa-IR");

type Props = {
  siteProjectId: string;
  siteType: string;
  page: PageConfig;
  pages: PageConfig[];
  section: SectionConfig;
  item: SectionItem;
  catalog: CatalogService[] | null;
  colors: { background: string; text: string; primary: string; surface: string };
};

// Medical detail: authored copy plus canonical Booking facts (duration, care
// modes, price, doctors) from the public catalog. Nothing here is invented.
export default function VerticalDetail({ siteProjectId, siteType, page, pages, section, item, catalog, colors }: Props) {
  const base = `/site/${siteProjectId}`;
  const cardFor = (key: "bookingServiceId" | "bookingProviderId", id: string) => {
    for (const candidate of pages) if (hasDetailPage(siteType, candidate.slug)) for (const sec of candidate.sections) for (const entry of sec.items || []) {
      if (entry[key] === id) return { page: candidate, item: entry };
    }
    return null;
  };
  const linkTo = (card: ReturnType<typeof cardFor>, fallback: string) => card
    ? <Link className="font-black underline-offset-4 hover:underline" style={{ color: colors.primary }} to={`${base}/${card.page.slug}/${encodeURIComponent(normalizeSlug(card.item.title) || "")}`}>{card.item.title}</Link>
    : fallback;
  const service = item.bookingServiceId ? catalog?.find((entry) => entry.id === item.bookingServiceId) : undefined;
  const offered = item.bookingProviderId ? (catalog || []).filter((entry) => entry.providers.some((provider) => provider.id === item.bookingProviderId)) : [];
  const query = [item.bookingServiceId && `service=${encodeURIComponent(item.bookingServiceId)}`, item.bookingProviderId && `provider=${encodeURIComponent(item.bookingProviderId)}`].filter(Boolean).join("&");
  const rows: [string, string][] = service ? [["مدت", `${fa(service.durationMinutes)} دقیقه`], ...(service.modalities.length ? [["شیوه‌های مراجعه", service.modalities.map(modeLabel).join("، ")] as [string, string]] : []), ...(service.price ? [["هزینه", `${fa(service.price.amount)} ${service.price.currency || ""}`.trim()] as [string, string]] : [])] : [];
  const modes = [...new Set(offered.flatMap((entry) => entry.providers.find((provider) => provider.id === item.bookingProviderId)?.modalities ?? entry.modalities))];
  return <main dir="rtl" data-detail-page="true" data-vertical="medical" className="min-h-screen px-4 py-8 sm:p-12" style={{ background: colors.background, color: colors.text }}>
    <article className="mx-auto max-w-3xl">
      <Link to={`${base}/${page.slug}`} className="text-sm font-bold" style={{ color: colors.primary }}>بازگشت به {page.title}</Link>
      <p className="mt-10 text-sm font-bold" style={{ color: colors.primary }}>{item.meta || section.title || page.title}</p>
      <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{item.title}</h1>
      {item.subtitle && <p className="mt-5 text-lg opacity-70">{item.subtitle}</p>}
      {item.imageUrl && <img className="mt-8 max-h-[520px] w-full rounded-3xl object-cover" src={item.imageUrl} alt={item.title} />}
      {item.body && <p className="mt-8 whitespace-pre-wrap text-base leading-9 opacity-90">{item.body}</p>}
      {rows.length > 0 && <dl data-booking-facts="service" className="mt-8 grid gap-3">{rows.map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b pb-2" style={{ borderColor: "rgba(43,42,39,.12)" }}><dt className="opacity-65">{key}</dt><dd className="font-black">{value}</dd></div>)}</dl>}
      {service && service.providers.length > 0 && <section data-booking-facts="doctors"><h2 className="mt-8 text-xl font-black">پزشکان این خدمت</h2><ul className="mt-2 list-disc pr-5">{service.providers.map((provider) => <li key={provider.id}>{linkTo(cardFor("bookingProviderId", provider.id), provider.name)}</li>)}</ul></section>}
      {offered.length > 0 && <section data-booking-facts="services">
        {modes.length > 0 && <dl className="mt-8 grid gap-3"><div className="flex justify-between gap-4 border-b pb-2" style={{ borderColor: "rgba(43,42,39,.12)" }}><dt className="opacity-65">شیوه‌های مراجعه</dt><dd className="font-black">{modes.map(modeLabel).join("، ")}</dd></div></dl>}
        <h2 className="mt-8 text-xl font-black">خدمات این پزشک</h2><ul className="mt-2 list-disc pr-5">{offered.map((entry) => <li key={entry.id}>{linkTo(cardFor("bookingServiceId", entry.id), entry.name)}</li>)}</ul>
      </section>}
      <p className="mt-10"><Link data-booking-cta="true" to={`${base}/booking${query ? `?${query}` : ""}`} className="inline-flex min-h-12 items-center rounded-xl px-7 text-sm font-black text-white" style={{ background: colors.primary }}>رزرو نوبت</Link></p>
    </article>
  </main>;
}
