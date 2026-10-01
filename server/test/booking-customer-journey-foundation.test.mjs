import assert from "node:assert/strict";
import test from "node:test";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { BookingError, createBookingRepository } from "../app/repositories/booking-repository.mjs";

const monday = "2026-10-05";

test("customer Booking projections use canonical service/provider/availability records", () => {
  const db = createSiteTestDb(), booking = createBookingRepository(db);
  let service, eligible;
  runWithWorkspace("ws-1", () => {
    service = booking.createService({ name: "مشاوره", durationMinutes: 30, modalities: ["ONLINE", "IN_PERSON"], priceAmount: 450000, priceCurrency: "IRR" });
    eligible = booking.createProvider({ name: "مشاور مجاز" });
    booking.createProvider({ name: "مشاور نامرتبط" });
    booking.associate(eligible.id, service.id);
    booking.addAvailability({ providerId: eligible.id, weekday: 1, startsAt: "09:00", endsAt: "09:30", capacity: 2 });
    booking.addAvailability({ providerId: eligible.id, weekday: 1, startsAt: "10:00", endsAt: "10:30", status: "CANCELLED" });
    assert.deepEqual(booking.listCustomerServices(), [{ id: service.id, name: "مشاوره", durationMinutes: 30, modalities: ["ONLINE", "IN_PERSON"], price: { amount: 450000, currency: "IRR" } }]);
    assert.deepEqual(booking.listEligibleProviders(service.id), [{ id: eligible.id, name: "مشاور مجاز" }]);
    assert.equal(booking.listEligibleProviders("missing").length, 0);
    const slots = booking.listCustomerSlots({ serviceId: service.id, providerId: eligible.id, date: monday });
    assert.deepEqual(slots.map((slot) => slot.state), ["available", "cancelled"]);
    assert.equal(booking.quoteCustomerBooking({ serviceId: service.id, providerId: eligible.id, date: monday, startsAt: "09:00", modality: "ONLINE" }).slot.remainingCapacity, 2);
  });
  runWithWorkspace("ws-2", () => {
    assert.equal(booking.listCustomerServices().length, 0);
    assert.equal(booking.listEligibleProviders(service.id).length, 0);
    assert.equal(booking.listCustomerSlots({ serviceId: service.id, providerId: eligible.id, date: monday }).length, 0);
  });
  db.close();
});

test("customer Booking claims are atomic, reject full/cancelled slots, and confirm canonically", () => {
  const db = createSiteTestDb(), booking = createBookingRepository(db);
  runWithWorkspace("ws-1", () => {
    const service = booking.createService({ name: "ویزیت", durationMinutes: 30, modalities: ["IN_PERSON"] });
    const provider = booking.createProvider({ name: "دکتر" });
    booking.associate(provider.id, service.id);
    booking.addAvailability({ providerId: provider.id, weekday: 1, startsAt: "09:00", endsAt: "09:30", capacity: 2 });
    booking.addAvailability({ providerId: provider.id, weekday: 1, startsAt: "10:00", endsAt: "10:30", status: "CANCELLED" });
    const first = booking.createCustomerAppointment({ serviceId: service.id, providerId: provider.id, date: monday, startsAt: "09:00", customerName: "مریم", customerContact: "0912", modality: "IN_PERSON" });
    assert.match(first.confirmation.reference, /^BK-[A-Z0-9]{12}$/);
    assert.equal(booking.listCustomerSlots({ serviceId: service.id, providerId: provider.id, date: monday }).find((slot) => slot.startsAt.endsWith("09:00:00.000Z")).state, "limited");
    const second = booking.createCustomerAppointment({ serviceId: service.id, providerId: provider.id, date: monday, startsAt: "09:00", customerName: "علی", modality: "IN_PERSON" });
    assert.ok(second.appointment.id);
    assert.throws(() => booking.createCustomerAppointment({ serviceId: service.id, providerId: provider.id, date: monday, startsAt: "09:00", customerName: "سارا", modality: "IN_PERSON" }), (error) => error instanceof BookingError && error.code === "BOOKING_SLOT_FULL" && error.status === 409);
    assert.throws(() => booking.createCustomerAppointment({ serviceId: service.id, providerId: provider.id, date: monday, startsAt: "10:00", customerName: "سارا" }), (error) => error.code === "BOOKING_SLOT_CANCELLED");
    assert.equal(booking.listAppointments().length, 2);
    assert.deepEqual(booking.getCustomerConfirmation(first.confirmation.reference), first.confirmation);
  });
  db.close();
});
