import assert from "node:assert/strict";
import test from "node:test";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBookingRepository } from "../app/repositories/booking-repository.mjs";
import { formatAppointmentClock, formatAppointmentWhen, formatBookingDay, formatPrice, formatSlotTime, toPersianDigits } from "../../src/lib/appointmentTime.ts";

const ZONES = ["UTC", "Asia/Tehran", "America/Los_Angeles", "Pacific/Kiritimati", "Asia/Kolkata"];
const withZone = (zone, fn) => { const previous = process.env.TZ; process.env.TZ = zone; try { return fn(); } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; } };
const digits = (text) => text.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

test("a stored appointment renders as its intended wall-clock time in every viewer time zone", () => {
  for (const zone of ZONES) withZone(zone, () => {
    assert.equal(digits(formatAppointmentClock("2026-10-09T09:00:00.000Z")), "09:00", zone);
    assert.equal(digits(formatAppointmentClock("2026-10-09T16:00:00.000Z")), "16:00", zone);
    assert.match(formatAppointmentWhen("2026-10-09T09:00:00.000Z"), /ساعت ۰۹:۰۰$/, zone);
  });
});

test("regression control: formatting in the viewer's zone is the observed +3:30 bug", () => {
  const naive = withZone("Asia/Tehran", () => new Date("2026-10-09T09:00:00.000Z").toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
  assert.equal(naive, "12:30", "if this is no longer 12:30 the control no longer proves the test is sensitive");
  assert.notEqual(withZone("Asia/Tehran", () => digits(formatAppointmentClock("2026-10-09T09:00:00.000Z"))), naive);
});

test("customer-facing time has no seconds, Latin comma or raw ISO", () => {
  const text = formatAppointmentWhen("2026-10-09T16:00:00.000Z");
  assert.ok(!/[,،]\s*\d|:\d\d:\d\d|T\d\d/.test(digits(text)), text);
  assert.equal(formatSlotTime("16:00"), formatAppointmentClock("2026-10-09T16:00:00.000Z"));
  assert.equal(formatAppointmentWhen("2026-10-09T09:00:00.000Z"), "جمعه ۱۷ مهر ۱۴۰۵ ساعت ۰۹:۰۰");
  assert.equal(formatAppointmentWhen("2026-10-09T09:00:00.000Z", "medium"), "۱۷ مهر ۱۴۰۵ ساعت ۰۹:۰۰");
  assert.equal(formatBookingDay("2026-10-09"), "جمعه ۱۷ مهر ۱۴۰۵");
  assert.ok(!/[,،]/.test(text), text);
  assert.equal(toPersianDigits("09121110001"), "۰۹۱۲۱۱۱۰۰۰۱");
});

test("price is named in Persian and the stored amount is untouched", () => {
  assert.equal(formatPrice({ amount: 1200000, currency: "IRT" }), "۱٬۲۰۰٬۰۰۰ تومان");
  assert.equal(formatPrice({ amount: 450000, currency: "IRR" }), "۴۵۰٬۰۰۰ ریال");
  assert.ok(!formatPrice({ amount: 1, currency: "IRT" }).includes("IRT"));
  assert.equal(formatPrice(null), "");
});

test("canonical persistence: slot 09:00 is stored, confirmed and listed as the same instant", () => {
  const db = createSiteTestDb(), booking = createBookingRepository(db);
  runWithWorkspace("ws-1", () => {
    const service = booking.createService({ name: "ویزیت", durationMinutes: 30, modalities: ["IN_PERSON"] });
    const provider = booking.createProvider({ name: "دکتر" });
    booking.associate(provider.id, service.id);
    booking.addAvailability({ providerId: provider.id, weekday: 5, startsAt: "09:00", endsAt: "10:00", capacity: 1 });
    for (const zone of ZONES) withZone(zone, () => {
      const slots = booking.listCustomerSlots({ serviceId: service.id, providerId: provider.id, date: "2026-10-09" });
      assert.equal(slots[0].startsAtTime, "09:00", zone);
      assert.equal(slots[0].startsAt, "2026-10-09T09:00:00.000Z", zone);
    });
    const quote = booking.quoteCustomerBooking({ serviceId: service.id, providerId: provider.id, date: "2026-10-09", startsAt: "09:00" });
    assert.equal(quote.slot.startsAt, "2026-10-09T09:00:00.000Z");
    const claimed = booking.createCustomerAppointment({ serviceId: service.id, providerId: provider.id, date: "2026-10-09", startsAt: "09:00", customerName: "بیمار", customerContact: "09120000000" });
    assert.equal(claimed.confirmation.startsAt, "2026-10-09T09:00:00.000Z");
    assert.equal(booking.getCustomerConfirmation(claimed.confirmation.reference).startsAt, "2026-10-09T09:00:00.000Z");
    assert.equal(booking.listAppointments().find((a) => a.id === claimed.appointment.id).starts_at, "2026-10-09T09:00:00.000Z");
    assert.equal(digits(formatAppointmentClock(claimed.confirmation.startsAt)), "09:00");
  });
  db.close();
});
