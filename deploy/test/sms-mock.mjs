// TEST ONLY: stands in for api.kavenegar.com (reached through a network alias, trusted via
// NODE_EXTRA_CA_CERTS) so production-mode sign-in can be exercised end to end without a real SMS provider.
// Every accepted message is logged as one JSON line. A receptor ending in 9999 simulates a provider outage.
import https from "node:https";
import fs from "node:fs";

https.createServer({ key: fs.readFileSync("/certs/key.pem"), cert: fs.readFileSync("/certs/cert.pem") }, (req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const form = new URLSearchParams(raw);
    const receptor = form.get("receptor") || "", message = form.get("message") || "";
    const ok = req.method === "POST" && /^\/v1\/[^/]+\/sms\/send\.json$/.test(req.url);
    res.setHeader("content-type", "application/json");
    if (!ok) { res.statusCode = 404; return res.end(JSON.stringify({ return: { status: 404, message: "not found" } })); }
    console.log(JSON.stringify({ receptor, message }));
    if (receptor.endsWith("9999")) { res.statusCode = 500; return res.end(JSON.stringify({ return: { status: 500, message: "provider down" } })); }
    res.end(JSON.stringify({ return: { status: 200, message: "ok" }, entries: [{ messageid: 1, status: 1, statustext: "queued", cost: 0 }] }));
  });
}).listen(443, () => console.log("sms-mock listening"));
