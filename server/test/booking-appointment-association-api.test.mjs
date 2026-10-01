import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { createBookingRepository } from "../app/repositories/booking-repository.mjs";
import { createBookingRouter } from "../app/routes/booking.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";

test("Booking API rejects appointments when the provider is not associated with the service", async () => {
  const db = createSiteTestDb();
  const repository = createBookingRepository(db);
  let service;
  let associatedProvider;
  let unassociatedProvider;
  runWithWorkspace("ws-1", () => {
    service = repository.createService({ name: "مشاوره", durationMinutes: 30 });
    associatedProvider = repository.createProvider({ name: "مشاور مجاز" });
    unassociatedProvider = repository.createProvider({ name: "مشاور غیرمرتبط" });
    assert.equal(repository.associate(associatedProvider.id, service.id), true);
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => runWithWorkspace("ws-1", next));
  app.use("/api", createBookingRouter({ repository, siteProjectService: { list: () => [{ siteType: "MEDICAL" }] } }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const postAppointment = (providerId) => fetch(`${base}/booking/appointments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serviceId: service.id, providerId, customerName: "مریم", startsAt: "2026-10-01T09:00:00Z" }),
  });

  try {
    const rejected = await postAppointment(unassociatedProvider.id);
    assert.equal(rejected.status, 404);
    assert.equal((await rejected.json()).success, false);
    const accepted = await postAppointment(associatedProvider.id);
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json()).appointment.provider_id, associatedProvider.id);
    assert.equal(runWithWorkspace("ws-1", () => repository.listAppointments().length), 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});

test("Booking API denies a workspace without a persisted Booking capability", async () => {
  const db = createSiteTestDb();
  const repository = createBookingRepository(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => runWithWorkspace("booking-disabled", next));
  app.use("/api", createBookingRouter({ repository, siteProjectService: { list: () => [] } }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/booking`;
    const read = await fetch(base);
    assert.equal(read.status, 403);
    assert.equal((await read.json()).code, "BOOKING_CAPABILITY_REQUIRED");
    const write = await fetch(`${base}/services`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "نباید ساخته شود", durationMinutes: 30 }) });
    assert.equal(write.status, 403);
    assert.equal(runWithWorkspace("booking-disabled", () => repository.listServices()).length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});

test("customer Booking API projects and claims canonical slots without trusting client workspace", async () => {
  const db = createSiteTestDb(), repository = createBookingRepository(db);
  let service, provider;
  runWithWorkspace("ws-1", () => {
    service = repository.createService({ name: "ویزیت", durationMinutes: 30, modalities: ["ONLINE"] });
    provider = repository.createProvider({ name: "دکتر" });
    repository.associate(provider.id, service.id);
    repository.addAvailability({ providerId: provider.id, weekday: 1, startsAt: "09:00", endsAt: "09:30" });
  });
  const app = express(); app.use(express.json()); app.use((req, _res, next) => runWithWorkspace("ws-1", next));
  app.use("/api", createBookingRouter({ repository, siteProjectService: { list: () => [{ siteType: "MEDICAL" }] } }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/booking/customer`;
  try {
    const services = await (await fetch(`${base}/services`)).json();
    assert.equal(services.services[0].id, service.id);
    const providers = await (await fetch(`${base}/services/${service.id}/providers`)).json();
    assert.deepEqual(providers.providers.map((entry) => entry.id), [provider.id]);
    const slots = await (await fetch(`${base}/slots?serviceId=${service.id}&providerId=${provider.id}&date=2026-10-05`)).json();
    assert.equal(slots.slots[0].state, "available");
    const created = await fetch(`${base}/appointments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ serviceId: service.id, providerId: provider.id, date: "2026-10-05", startsAt: "09:00", customerName: "مریم", modality: "ONLINE", workspaceId: "ws-2" }) });
    assert.equal(created.status, 201); const body = await created.json();
    const confirmation = await (await fetch(`${base}/confirmations/${body.confirmation.reference}`)).json();
    assert.equal(confirmation.confirmation.appointmentId, body.appointment.id);
    assert.equal(runWithWorkspace("ws-2", () => repository.listAppointments().length), 0);
  } finally { await new Promise((resolve) => server.close(resolve)); db.close(); }
});
