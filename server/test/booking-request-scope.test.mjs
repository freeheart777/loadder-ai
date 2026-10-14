import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bookingReadPath, bookingRequestInit } from "../../src/components/control-center/bookingRequest.ts";

// Safety invariant: inside a site's Control Center every /api/booking request names that site, so a
// write can never land in the workspace-level (site-less) Booking records by omission.
const SITE = "site-1";
const sent = (siteProjectId, method, body) => { const init = bookingRequestInit(siteProjectId, method, body); return { ...init, json: init.body ? JSON.parse(init.body) : undefined }; };

test("reads are pinned to the site, and unpinned only for the workspace Booking Studio", () => {
  assert.equal(bookingReadPath(SITE), "/api/booking?siteProjectId=site-1");
  assert.equal(bookingReadPath("a b&c"), "/api/booking?siteProjectId=a%20b%26c");
  assert.equal(bookingReadPath(undefined), "/api/booking");
});

test("every site mutation body carries the site id, including an empty body", () => {
  for (const method of ["POST", "PUT"]) {
    assert.equal(sent(SITE, method, {}).json.siteProjectId, SITE);
    assert.equal(sent(SITE, method, { name: "x" }).json.siteProjectId, SITE);
  }
  assert.equal(sent(SITE, "PUT", { modalities: null }).json.siteProjectId, SITE);
  assert.equal(sent(SITE, "POST", { name: "x" }).headers["Content-Type"], "application/json");
});

test("a caller-supplied body can never redirect a write to another site", () => {
  assert.equal(sent(SITE, "POST", { siteProjectId: "other", name: "x" }).json.siteProjectId, SITE);
});

test("the workspace Booking Studio sends no site id", () => {
  assert.equal("siteProjectId" in sent(undefined, "POST", { name: "x" }).json, false);
});

test("every mutation BookingPanels exposes targets /api/booking with a body, so the pin always applies", () => {
  const source = readFileSync(new URL("../../src/components/control-center/BookingPanels.tsx", import.meta.url), "utf8");
  const calls = [...source.matchAll(/\bact\(\s*([`"])(\/[^`"]*)\1\s*,\s*"(POST|PUT|PATCH|DELETE)"\s*,\s*([^,\s)]+)/g)];
  const declared = (source.match(/\bact\(\s*[`"]\//g) || []).length;
  assert.equal(calls.length, declared, "an act() call has a shape this guard does not understand; extend the guard, do not skip it");
  assert.ok(calls.length >= 7, `expected the shared panels' mutations, found ${calls.length}`);
  for (const [, , path, method, body] of calls) {
    assert.ok(path.startsWith("/api/booking/"), `${method} ${path} must stay on the canonical Booking API`);
    assert.ok(body.startsWith("{"), `${method} ${path} must send an object body (got ${body}) so siteProjectId is attached`);
  }
});
