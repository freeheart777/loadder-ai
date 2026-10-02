// Canonical Booking time contract.
// Availability stores the clinic's wall-clock "HH:MM"; the repository persists an
// appointment as that same wall-clock written with a "Z" suffix (booking-repository
// `isoFor`). The UTC fields of `startsAt` ARE the intended local time, so every
// customer-facing surface must read them through UTC. Rendering in the viewer's own
// time zone shifts the appointment by the viewer's offset (the observed +3:30 bug).
const WALL_CLOCK_ZONE = "UTC";
const number = new Intl.NumberFormat("fa-IR");

// Composed from parts, not from an ICU date pattern: CLDR patterns differ by engine version
// ("جمعه ۱۷ مهر ۱۴۰۵" vs "۱۴۰۵ مهر ۱۷, جمعه") and can carry a stray comma.
const dayParts = new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: WALL_CLOCK_ZONE });
const clockFormat = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: WALL_CLOCK_ZONE });

/** Persian-calendar date of a stored appointment instant, e.g. «جمعه ۱۷ مهر ۱۴۰۵». */
export const formatAppointmentDate = (iso: string, style: "full" | "medium" = "full") => {
  const part = Object.fromEntries(dayParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return (style === "full" ? [part.weekday, part.day, part.month, part.year] : [part.day, part.month, part.year]).join(" ");
};

/** Wall-clock time without seconds, e.g. «۰۹:۰۰». */
export const formatAppointmentClock = (iso: string) => clockFormat.format(new Date(iso));

/** One representation for date + time everywhere an appointment is shown. */
export const formatAppointmentWhen = (iso: string, style: "full" | "medium" = "full") => `${formatAppointmentDate(iso, style)} ساعت ${formatAppointmentClock(iso)}`;

/** A date-only value ("YYYY-MM-DD", as used by Booking slots) in the same Persian calendar. */
export const formatBookingDay = (date: string, style: "full" | "medium" = "full") => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? formatAppointmentDate(`${date}T00:00:00.000Z`, style) : "");

/** A slot time ("HH:MM") with Persian digits. */
export const formatSlotTime = (time: string) => (/^\d{2}:\d{2}$/.test(time) ? formatAppointmentClock(`1970-01-01T${time}:00.000Z`) : time);

const CURRENCY_NAMES: Record<string, string> = { IRT: "تومان", IRR: "ریال" };

/** Customer-facing price. The stored amount is never altered; only the unit is named. */
export const formatPrice = (price: { amount: number; currency: string } | null | undefined) => (price ? `${number.format(price.amount)} ${CURRENCY_NAMES[price.currency] ?? price.currency}` : "");

export const formatPersianNumber = (value: number) => number.format(value);

/** Latin digits typed by the customer (e.g. a phone number) shown with Persian digits. */
export const toPersianDigits = (text: string) => text.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
