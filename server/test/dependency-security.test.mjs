import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import express from "express";

const require = createRequire(import.meta.url);
const version = (name) => require(`${name}/package.json`).version;
const atLeast = (actual, floor) => { const a = actual.split(".").map(Number), f = floor.split(".").map(Number); for (let i = 0; i < 3; i += 1) { if (a[i] !== f[i]) return a[i] > f[i]; } return true; };

// Patched floors for advisories that were open before external staging (GHSA-jqcg-44mw-7w3h proxy-addr,
// GHSA-x5fp-wj9c-mxmx / GHSA-4mjr-xmp4-gh2g qs, ip-address SSRF/DoS set). A lockfile regression fails here.
test("runtime dependencies stay at or above the patched versions", () => {
  assert.ok(atLeast(version("proxy-addr"), "2.0.8"), `proxy-addr ${version("proxy-addr")}`);
  assert.ok(atLeast(version("qs"), "6.16.1"), `qs ${version("qs")}`);
  assert.ok(atLeast(version("ip-address"), "10.7.4"), `ip-address ${version("ip-address")}`);
});

async function clientIp(trustProxy, headers) {
  const app = express();
  app.set("trust proxy", trustProxy);
  app.get("/ip", (req, res) => res.json({ ip: req.ip }));
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  try { return (await (await fetch(`http://127.0.0.1:${server.address().port}/ip`, { headers })).json()).ip; }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

// The production configuration is an exact hop count (TRUST_PROXY=1). Behaviour must not change with the patch.
test("trust proxy as a hop count ignores forged forwarded addresses beyond the trusted hop", async () => {
  // One trusted hop (the connecting peer, 127.0.0.1): the right-most X-Forwarded-For entry is the client, a forged left entry is ignored.
  assert.equal(await clientIp(1, { "X-Forwarded-For": "6.6.6.6, 203.0.113.9" }), "203.0.113.9");
  // An IPv4-mapped IPv6 spoof of a loopback/private address is not honoured as the client beyond that hop.
  assert.equal(await clientIp(1, { "X-Forwarded-For": "::ffff:127.0.0.1, 198.51.100.7" }), "198.51.100.7");
  // No trust: the header is ignored entirely.
  assert.match(await clientIp(false, { "X-Forwarded-For": "6.6.6.6" }), /127\.0\.0\.1$/);
});
