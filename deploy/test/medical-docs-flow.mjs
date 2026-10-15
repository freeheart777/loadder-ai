// TEST ONLY: drives the Medical documents journey against a PRODUCTION-mode stack through real TLS, real
// ClamAV and encrypted storage. Run by deploy/medical-docs-check.sh (environment supplies everything).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";

const { APP, SITES, CA, PROJECT, ENVFILE, FILES } = process.env;
const agent = new https.Agent({ ca: fs.readFileSync(CA), lookup: (_h, _o, cb) => cb(null, [{ address: "127.0.0.1", family: 4 }]) });
const dcArgs = ["compose", "-p", PROJECT, "--env-file", ENVFILE, ...FILES.split(" ").flatMap((f) => ["-f", f]), "--profile", "medical-docs"];
const dc = (...a) => execFileSync("docker", [...dcArgs, ...a], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (${detail})`}`); if (!ok) failed += 1; };

function request(method, host, path, { headers = {}, body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const h = { ...headers, ...(cookie ? { cookie } : {}), ...(data && !headers["Content-Type"] ? { "Content-Type": "application/json" } : {}), ...(data ? { "Content-Length": data.length } : {}) };
    const req = https.request({ host, path, method, headers: h, agent, servername: host }, (res) => {
      const chunks = []; res.on("data", (c) => chunks.push(c));
      res.on("end", () => { const raw = Buffer.concat(chunks); let json = null; try { json = JSON.parse(raw.toString()); } catch { /* binary */ } resolve({ status: res.statusCode, headers: res.headers, raw, json }); });
    });
    req.on("error", reject); if (data) req.write(data); req.end();
  });
}
const app = (m, p, o) => request(m, APP, p, o);
const smsCode = async (mobile) => { for (let i = 0; i < 20; i++) { const line = dc("logs", "sms-mock", "--no-color").split("\n").filter((l) => l.includes(`"receptor":"${mobile}"`)).pop(); if (line) { const m = line.match(/"message":"([^"]*)"/); const digits = m && m[1].match(/\d{5,8}/g); if (digits) return digits.at(-1); } await sleep(500); } throw new Error(`no SMS for ${mobile}`); };
const signInOperator = async (mobile, name) => { await app("POST", "/api/auth/send-otp", { body: { mobile, name } }); const v = await app("POST", "/api/auth/verify-otp", { body: { mobile, code: await smsCode(mobile) } }); return v.headers["set-cookie"][0].split(";")[0]; };
const storeCount = () => Number(dc("exec", "-T", "server", "sh", "-c", "find /data/medical-private -type f | wc -l").trim());

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n% PATIENT-SECRET-BLOOD-GROUP-O-NEGATIVE\ntrailer<<>>\n%%EOF\n");
const PNG_MALWARE = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 7), Buffer.from("LOADDER-TEST-MALWARE-MARKER"), Buffer.alloc(16, 9)]);

// -------------------------------------------------------------------------------- setup
const op = await signInOperator("09126660001", "Docs Operator");
const create = (p, body) => app("POST", p, { cookie: op, body });
const site = (await create("/api/site-projects", { name: "Docs Clinic", siteType: "MEDICAL", content: {} })).json.project.id;
const when = new Date(Date.now() + 7 * 86400000), date = when.toISOString().slice(0, 10), weekday = when.getUTCDay();
const service = (await create("/api/booking/services", { siteProjectId: site, name: "ویزیت", durationMinutes: 30, modalities: ["IN_PERSON"] })).json.service.id;
const provider = (await create("/api/booking/providers", { siteProjectId: site, name: "دکتر یک" })).json.provider.id;
const provider2 = (await create("/api/booking/providers", { siteProjectId: site, name: "دکتر دو" })).json.provider.id;
await create(`/api/booking/providers/${provider}/services/${service}`, { siteProjectId: site });
await create(`/api/booking/providers/${provider2}/services/${service}`, { siteProjectId: site });
await create("/api/booking/availability", { siteProjectId: site, providerId: provider, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 3 });
await create(`/api/site-projects/${site}/publish`);
await create(`/api/site-projects/${site}/patient-identity`);
await create(`/api/site-projects/${site}/doctor-identities`, { providerId: provider, mobile: "09126660011", displayName: "دکتر یک" });
await create(`/api/site-projects/${site}/doctor-identities`, { providerId: provider2, mobile: "09126660012", displayName: "دکتر دو" });
const pub = `/api/auth/site/${site}`;

console.log("== readiness (production mode)");
const settings = (await app("GET", `/api/site-projects/${site}/medical/settings`, { cookie: op })).json.settings;
check("environment is production", settings.environment === "production", JSON.stringify(settings.environment));
check("documents report production-ready", settings.documents.productionReady === true, JSON.stringify(settings.documents));
check("scanner configured, storage encrypted-file", settings.documents.scannerConfigured === true && settings.documents.storage === "encrypted-file" && settings.documents.encrypted === true, JSON.stringify(settings.documents));

console.log("== patient journey");
await request("POST", APP, `${pub}/patient/otp`, { body: { mobile: "09126660021" } });
const signed = (await request("POST", APP, `${pub}/patient/verify`, { body: { mobile: "09126660021", code: await smsCode("09126660021"), name: "بیمار مدارک" } })).json;
if (!signed.session) { console.error("patient verify failed:", JSON.stringify(signed)); process.exit(2); }
const identity = { "X-Loadder-App-Token": signed.session.token, "X-Loadder-App-Project": signed.authProjectId };
const booked = (await request("POST", APP, `${pub}/booking/appointments`, { headers: identity, body: { serviceId: service, providerId: provider, date, startsAt: "10:00", customerName: "بیمار مدارک", customerContact: "09126660021", modality: "IN_PERSON" } })).json;
const appointmentId = booked.appointment?.id;
check("patient signed in through SMS and booked", Boolean(signed.session?.token && appointmentId), JSON.stringify(booked).slice(0, 120));
const upload = (body, mime, title) => request("POST", APP, `${pub}/patient/appointments/${appointmentId}/documents`, { headers: { ...identity, "Content-Type": mime, "X-Document-Title": encodeURIComponent(title), "X-Document-Filename": encodeURIComponent("scan.bin") }, body });

const before = storeCount();
const clean = await upload(PDF, "application/pdf", "نتیجه آزمایش");
check("clean upload is accepted and scanned clean", clean.status === 201 && clean.json.document.scanState === "clean", `${clean.status} ${clean.raw.toString().slice(0, 150)}`);
const docId = clean.json?.document?.id;
check("exactly one object was stored", storeCount() === before + 1, `${before} -> ${storeCount()}`);

const infected = await upload(PNG_MALWARE, "image/png", "فایل مشکوک");
check("a file the scanner flags is rejected (422)", infected.status === 422 && infected.json.code === "MEDICAL_DOCUMENT_REJECTED", `${infected.status} ${infected.raw.toString().slice(0, 150)}`);
check("the rejected file stored nothing", storeCount() === before + 1, `count ${storeCount()}`);
check("the rejection does not reveal the signature name", !/Loadder|Marker|FOUND/i.test(infected.raw.toString()), infected.raw.toString().slice(0, 150));

console.log("== encryption at rest");
const ref = dc("exec", "-T", "server", "sh", "-c", "find /data/medical-private -type f | head -1").trim();
if (!ref) { console.error("no stored object found; cannot inspect encryption"); process.exit(2); }
const stored = Buffer.from(dc("exec", "-T", "server", "sh", "-c", `base64 ${ref}`).replace(/\s/g, ""), "base64");
check("stored object is ciphertext (LMD1 header, no plaintext)", stored.subarray(0, 4).toString() === "LMD1" && !stored.includes(Buffer.from("PATIENT-SECRET")), `${stored.subarray(0, 8).toString("hex")}`);
check("stored file is private (0600) in a private directory", /^600 /.test(dc("exec", "-T", "server", "sh", "-c", `stat -c '%a %U' ${ref}`)) && /^700 /.test(dc("exec", "-T", "server", "sh", "-c", `stat -c '%a %U' $(dirname ${ref})`)), "permissions");

console.log("== authenticated access");
const own = await request("GET", APP, `${pub}/patient/documents/${docId}/file`, { headers: identity });
check("patient downloads exactly their file", own.status === 200 && own.raw.equals(PDF), `${own.status}`);
check("download is no-store + nosniff", own.headers["cache-control"] === "no-store" && own.headers["x-content-type-options"] === "nosniff", JSON.stringify(own.headers["cache-control"]));
check("a forged or missing session is refused", (await request("GET", APP, `${pub}/patient/documents/${docId}/file`, { headers: { "X-Loadder-App-Token": "forged" } })).status === 401 && (await request("GET", APP, `${pub}/patient/documents/${docId}/file`)).status === 401, "anonymous access");
const doctorToken = async (mobile) => { await request("POST", APP, `${pub}/doctor/otp`, { body: { mobile } }); return (await request("POST", APP, `${pub}/doctor/verify`, { body: { mobile, code: await smsCode(mobile) } })).json.session.token; };
const doc1 = await doctorToken("09126660011"), doc2 = await doctorToken("09126660012");
check("the appointment's doctor reads the file", (await request("GET", APP, `${pub}/doctor/documents/${docId}/file`, { headers: { "X-Loadder-App-Token": doc1 } })).raw.equals(PDF), "doctor 1");
check("another doctor cannot", (await request("GET", APP, `${pub}/doctor/documents/${docId}/file`, { headers: { "X-Loadder-App-Token": doc2 } })).status === 404, "doctor 2");
const listed = await app("GET", `/api/site-projects/${site}/medical-documents`, { cookie: op });
check("operators see metadata only, no title or file", listed.status === 200 && !JSON.stringify(listed.json).includes("نتیجه آزمایش"), JSON.stringify(listed.json).slice(0, 100));
check("opening a file as operator needs a reason", (await app("POST", `/api/site-projects/${site}/medical-documents/${docId}/access`, { cookie: op, body: {} })).status === 400, "no reason");
const opened = await app("POST", `/api/site-projects/${site}/medical-documents/${docId}/access`, { cookie: op, body: { reason: "support request by patient" } });
check("with a reason it opens (and is audited)", opened.status === 200 && opened.raw.equals(PDF), `${opened.status}`);

console.log("== unauthorized and cross-tenant access");
const EICAR = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
const eicarUpload = await upload(EICAR, "application/pdf", "eicar");
check("an EICAR file is refused (not an allowed document type) and nothing is stored", eicarUpload.status >= 400 && eicarUpload.status < 500 && storeCount() === before + 1, `${eicarUpload.status} count ${storeCount()}`);
check("operator routes reject an anonymous caller", (await app("GET", `/api/site-projects/${site}/medical-documents`)).status === 401, "anonymous");
const opB = await signInOperator("09126660002", "Other Workspace");
const siteB = (await app("POST", "/api/site-projects", { cookie: opB, body: { name: "Other Clinic", siteType: "MEDICAL", content: {} } })).json.project.id;
await app("POST", `/api/site-projects/${siteB}/publish`, { cookie: opB }); await app("POST", `/api/site-projects/${siteB}/patient-identity`, { cookie: opB });
const unknown = "11111111-1111-4111-8111-111111111111";
const foreignList = await app("GET", `/api/site-projects/${site}/medical-documents`, { cookie: opB });
const unknownList = await app("GET", `/api/site-projects/${unknown}/medical-documents`, { cookie: opB });
check("another workspace's operator sees nothing of site A (same as a nonexistent site)", foreignList.status === unknownList.status && !JSON.stringify(foreignList.json).includes(docId), `${foreignList.status} vs ${unknownList.status}`);
const foreignOpen = await app("POST", `/api/site-projects/${site}/medical-documents/${docId}/access`, { cookie: opB, body: { reason: "attempt" } });
check("another workspace's operator cannot open the file", foreignOpen.status >= 400 && !foreignOpen.raw.equals(PDF), `${foreignOpen.status}`);
const pubB = `/api/auth/site/${siteB}`;
const crossPatient = await request("GET", APP, `${pubB}/patient/documents/${docId}/file`, { headers: identity });
check("a patient session from site A cannot read documents through site B", crossPatient.status >= 400 && !crossPatient.raw.equals(PDF), `${crossPatient.status}`);
const crossDoctor = await request("GET", APP, `${pubB}/doctor/documents/${docId}/file`, { headers: { "X-Loadder-App-Token": doc1 } });
check("a doctor session from site A cannot read documents through site B", crossDoctor.status >= 400 && !crossDoctor.raw.equals(PDF), `${crossDoctor.status}`);

console.log("== scanner outage fails closed");
dc("stop", "clamav");
const down = await upload(PDF, "application/pdf", "بدون اسکنر");
check("upload while the scanner is down answers 503", down.status === 503 && down.json.code === "MEDICAL_DOCUMENT_SCAN_UNAVAILABLE", `${down.status} ${down.raw.toString().slice(0, 120)}`);
check("nothing was stored during the outage", storeCount() === before + 1, `count ${storeCount()}`);
dc("start", "clamav");
for (let i = 0; i < 60; i++) { if (dc("ps", "--format", "{{.Service}}={{.Health}}").includes("clamav=healthy")) break; await sleep(3000); }
const back = await upload(PDF, "application/pdf", "بعد از بازگشت");
check("uploads work again once the scanner is back", back.status === 201, `${back.status} ${back.raw.toString().slice(0, 120)}`);

console.log("== backups and plaintext hygiene");
const composeExtra = FILES.split(" ").filter((f) => f !== "deploy/compose.prod.yaml").map((f) => `-f ${f}`).join(" ") + " --profile medical-docs";
const scriptEnv = { ...process.env, LOADDER_PROJECT: PROJECT, LOADDER_COMPOSE_EXTRA: composeExtra };
const backupDir = fs.mkdtempSync("/tmp/meddocs-backup-");
execFileSync("bash", ["deploy/backup.sh", backupDir], { env: scriptEnv, stdio: "pipe" });
const dbBackup = `${backupDir}/${fs.readdirSync(backupDir).find((f) => f.startsWith("loadder-"))}`, filesBackup = `${backupDir}/${fs.readdirSync(backupDir).find((f) => f.startsWith("files-"))}`;
const listing = execFileSync("tar", ["-tzf", filesBackup], { encoding: "utf8" });
const objectPath = listing.split("\n").find((l) => l.startsWith("medical-private/") && !l.endsWith("/"));
const extracted = execFileSync("tar", ["-xzOf", filesBackup, objectPath], { maxBuffer: 16 * 1024 * 1024 });
check("the backup contains the object, encrypted", Boolean(objectPath) && extracted.subarray(0, 4).toString() === "LMD1" && !extracted.includes(Buffer.from("PATIENT-SECRET")), objectPath || "no object");
const needle = "PATIENT-SECRET-BLOOD-GROUP";
const archiveText = execFileSync("tar", ["-xzOf", filesBackup], { maxBuffer: 64 * 1024 * 1024 });
check("no plaintext document content in the files backup or the database backup", !archiveText.includes(Buffer.from(needle)) && !fs.readFileSync(dbBackup).includes(Buffer.from(needle)), "plaintext found in a backup");
const volumeHits = dc("exec", "-T", "server", "sh", "-c", `grep -rl "${needle}" /data 2>/dev/null | wc -l`).trim();
check("no plaintext document content anywhere in the data volume", volumeHits === "0", `${volumeHits} file(s)`);

console.log("== restore keeps documents readable with the correct key only");
const del = await request("DELETE", APP, `${pub}/patient/documents/${docId}`, { headers: identity });
check("the patient deletes the document (access removed)", del.status === 200 && (await request("GET", APP, `${pub}/patient/documents/${docId}/file`, { headers: identity })).status === 404, `${del.status}`);
execFileSync("bash", ["deploy/restore.sh", dbBackup, filesBackup, "--yes", "--no-pre-backup"], { env: scriptEnv, stdio: "pipe" });
const restored = await request("GET", APP, `${pub}/patient/documents/${docId}/file`, { headers: identity });
check("after restore the document is readable again, byte for byte", restored.status === 200 && restored.raw.equals(PDF), `${restored.status}`);
const rekey = (key) => execFileSync("docker", [...dcArgs, "up", "-d", "--no-deps", "server"], { env: { ...process.env, MEDICAL_DOCUMENT_ENCRYPTION_KEY: key }, stdio: "pipe" });
const waitHealthy = async () => { for (let i = 0; i < 60; i++) { if (dc("ps", "--format", "{{.Service}}={{.Health}}").includes("server=healthy")) return; await sleep(3000); } };
rekey("f".repeat(64)); await waitHealthy();
const wrongKey = await request("GET", APP, `${pub}/patient/documents/${docId}/file`, { headers: identity });
check("with a WRONG key the file is not served and nothing leaks", wrongKey.status >= 400 && !wrongKey.raw.includes(Buffer.from("PATIENT-SECRET")), `${wrongKey.status}`);
rekey(process.env.MEDICAL_DOCUMENT_ENCRYPTION_KEY); await waitHealthy();
const again = await request("GET", APP, `${pub}/patient/documents/${docId}/file`, { headers: identity });
check("with the correct key it is readable again", again.status === 200 && again.raw.equals(PDF), `${again.status}`);

const logs = dc("logs", "server", "--no-color");
check("server logs contain neither document content nor the key", !logs.includes("PATIENT-SECRET") && !logs.includes(process.env.MEDICAL_DOCUMENT_ENCRYPTION_KEY), "leak in logs");
fs.rmSync(backupDir, { recursive: true, force: true });

console.log(failed ? `\nMEDICAL DOCUMENTS CHECK: ${failed} FAILURE(S)` : "\nMEDICAL DOCUMENTS CHECK: ALL PASSED");
process.exit(failed ? 1 : 0);
