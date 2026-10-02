import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CARE_MODES, PUBLIC_BOOKABLE_MODES, createBookingRepository } from "../app/repositories/booking-repository.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { bookingScopeForSite } from "../app/services/booking-scope.mjs";
import { createBookingRouter } from "../app/routes/booking.mjs";

const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const weekday = new Date(`${future}T00:00:00.000Z`).getUTCDay();

function fixture() {
  const db = createSiteTestDb(), booking = createBookingRepository(db);
  const projects = createSiteProjectService({ repository: createSiteProjectRepository(db) });
  const make = (ws, name) => runWithWorkspace(ws, () => projects.create({ name, siteType: "MEDICAL", content: {} }));
  const a = make("ws-1", "A"), b = make("ws-1", "B");
  const sa = bookingScopeForSite(a), sb = bookingScopeForSite(b);
  const ids = runWithWorkspace("ws-1", () => {
    const service = booking.createService({ name: "ویزیت", durationMinutes: 30, modalities: ["IN_PERSON", "VIDEO", "TEXT"], scope: sa });
    const open = booking.createProvider({ name: "بدون محدودیت", scope: sa }), video = booking.createProvider({ name: "فقط ویدئو", scope: sa }), none = booking.createProvider({ name: "فقط متن", scope: sa });
    for (const p of [open, video, none]) { booking.associate(p.id, service.id, sa); booking.addAvailability({ providerId: p.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 5, scope: sa }); }
    booking.setProviderServiceModalities({ providerId: video.id, serviceId: service.id, modalities: ["VIDEO"], scope: sa });
    booking.setProviderServiceModalities({ providerId: none.id, serviceId: service.id, modalities: ["TEXT"], scope: sa });
    return { serviceId: service.id, open: open.id, video: video.id, none: none.id };
  });
  return { db, booking, projects, a, b, sa, sb, ids };
}
const slot = (f, providerId) => runWithWorkspace("ws-1", () => f.booking.listCustomerSlots({ serviceId: f.ids.serviceId, providerId, date: future, scope: f.sa })[0]);

test("a provider's modes are the service's public modes intersected with its restriction", () => {
  const f = fixture();
  assert.deepEqual(CARE_MODES, ["IN_PERSON", "VIDEO", "AUDIO", "TEXT", "ONLINE"]);
  assert.deepEqual(slot(f, f.ids.open).modalityOptions, ["IN_PERSON", "VIDEO"], "no restriction inherits the service, minus TEXT");
  assert.deepEqual(slot(f, f.ids.video).modalityOptions, ["VIDEO"]);
  assert.equal(slot(f, f.ids.none), undefined, "a provider left with no bookable mode is not bookable");
  runWithWorkspace("ws-1", () => {
    const catalog = f.booking.listCatalog(f.sa)[0];
    assert.deepEqual(catalog.modalities, ["IN_PERSON", "VIDEO"], "TEXT is never advertised");
    assert.deepEqual(catalog.providers.map((p) => [p.name, p.modalities]), [["بدون محدودیت", ["IN_PERSON", "VIDEO"]], ["فقط ویدئو", ["VIDEO"]]]);
    assert.deepEqual(f.booking.listEligibleProviders(f.ids.serviceId, f.sa).map((p) => p.name).sort(), ["بدون محدودیت", "فقط ویدئو"].sort());
    assert.equal(f.booking.listEligibleProviders(f.ids.serviceId, f.sa).some((p) => p.name === "فقط متن"), false);
    assert.deepEqual(Object.keys(f.booking.listEligibleProviders(f.ids.serviceId, f.sa)[0]).sort(), ["id", "name"], "the provider shape is unchanged");
  });
  f.db.close();
});

test("booking enforces the provider's modes and never accepts TEXT publicly", () => {
  const f = fixture();
  const claim = (providerId, modality) => runWithWorkspace("ws-1", () => f.booking.createCustomerAppointment({ serviceId: f.ids.serviceId, providerId, date: future, startsAt: "10:00", customerName: "n", modality, scope: f.sa }));
  assert.equal(claim(f.ids.video, "VIDEO").appointment.modality, "VIDEO");
  assert.throws(() => claim(f.ids.video, "IN_PERSON"), (e) => e.code === "BOOKING_MODALITY_INVALID", "the service offers it but this doctor does not");
  assert.throws(() => claim(f.ids.open, "TEXT"), (e) => e.code === "BOOKING_MODALITY_INVALID", "an asynchronous text consultation does not exist yet");
  assert.equal(claim(f.ids.open, "IN_PERSON").appointment.modality, "IN_PERSON");
  assert.throws(() => claim(f.ids.none, "TEXT"), (e) => e.code === "BOOKING_SLOT_NOT_FOUND");
  f.db.close();
});

test("restrictions can only narrow: unknown or un-offered modes are rejected, null clears, scope is enforced", () => {
  const f = fixture();
  runWithWorkspace("ws-1", () => {
    const set = (modalities, scope = f.sa, providerId = f.ids.open) => f.booking.setProviderServiceModalities({ providerId, serviceId: f.ids.serviceId, modalities, scope });
    assert.throws(() => set(["AUDIO"]), (e) => e.code === "BOOKING_MODALITY_NOT_OFFERED" && e.status === 409, "a provider cannot add a mode the service lacks");
    assert.throws(() => set(["TELEPATHY"]), (e) => e.code === "BOOKING_MODALITY_INVALID" && e.status === 400);
    assert.throws(() => set("VIDEO"), (e) => e.code === "BOOKING_MODALITY_INVALID");
    assert.deepEqual(set(["VIDEO", "VIDEO"]).modalities, ["VIDEO"]);
    assert.equal(set(null).modalities, null);
    assert.deepEqual(slot(f, f.ids.open)?.modalityOptions, ["IN_PERSON", "VIDEO"], "clearing restores the service's modes");
    assert.equal(set(["VIDEO"], f.sb), null, "another site's scope cannot touch this link");
    assert.equal(f.booking.listAssociations(f.sa).find((l) => l.providerId === f.ids.video).modalities.join(), "VIDEO");
    assert.equal(f.booking.listAssociations(f.sa).find((l) => l.providerId === f.ids.open).modalities, null);
  });
  f.db.close();
});

test("when a service later drops a mode, a stored restriction can never resurrect it", () => {
  const f = fixture();
  f.db.prepare("UPDATE booking_services SET modalities_json=? WHERE id=?").run(JSON.stringify(["IN_PERSON"]), f.ids.serviceId);
  assert.equal(slot(f, f.ids.video), undefined, "VIDEO is gone from the service, so the VIDEO-only doctor has nothing to offer");
  assert.deepEqual(slot(f, f.ids.open).modalityOptions, ["IN_PERSON"]);
  f.db.close();
});

test("operator route sets restrictions per site, 400/404/409 truthfully", async () => {
  const f = fixture();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: "u" }; runWithWorkspace("ws-1", next); });
  app.use(createBookingRouter({ repository: f.booking, siteProjectService: f.projects, db: f.db }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const put = async (siteProjectId, body, providerId = f.ids.open) => { const res = await fetch(`http://127.0.0.1:${server.address().port}/booking/providers/${providerId}/services/${f.ids.serviceId}/modalities`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteProjectId, ...body }) }); return res.status; };
  try {
    assert.equal(await put(f.a.id, { modalities: ["VIDEO"] }), 200);
    assert.equal(await put(f.a.id, { modalities: ["AUDIO"] }), 409);
    assert.equal(await put(f.a.id, { modalities: "VIDEO" }), 400);
    assert.equal(await put(f.b.id, { modalities: ["VIDEO"] }), 404, "site B cannot reach site A's link");
    assert.equal(await put(f.a.id, { modalities: null }), 200);
  } finally { await new Promise((resolve) => server.close(resolve)); f.db.close(); }
  assert.deepEqual(PUBLIC_BOOKABLE_MODES.includes("TEXT"), false);
});
