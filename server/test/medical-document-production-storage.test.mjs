import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createClamavScanner, createMedicalScannerFromEnv } from "../app/services/medical-document-scanner.mjs";
import { createMedicalDocumentService } from "../app/services/medical-document-service.mjs";
import { createEncryptedFileMedicalStorage, createFileMedicalStorage, createMedicalStorage, createUnconfiguredMedicalStorage, parseEncryptionKey } from "../app/services/medical-document-storage.mjs";

const KEY = crypto.randomBytes(32);
const tmp = () => mkdtempSync(path.join(tmpdir(), "loadder-medstore-"));
const PLAINTEXT = Buffer.from("%PDF-1.4 PATIENT SECRET: blood group O negative, HIV status ...");

async function code(promise) { try { await promise; return "no error"; } catch (error) { return error.code || error.message; } }

// ---------------------------------------------------------------- encrypted local storage

test("encrypted storage: round trip, ciphertext on disk, private permissions, fresh IV per object", async (t) => {
  const root = tmp(); t.after(() => rmSync(root, { recursive: true, force: true }));
  const storage = createEncryptedFileMedicalStorage({ root, key: KEY });
  assert.equal(storage.kind, "encrypted-file"); assert.equal(storage.encrypted, true);
  const ref = await storage.put({ workspaceId: "ws", siteProjectId: "site", body: PLAINTEXT });
  const ref2 = await storage.put({ workspaceId: "ws", siteProjectId: "site", body: PLAINTEXT });
  assert.deepEqual(await storage.get(ref), PLAINTEXT);

  const onDisk = fs.readFileSync(path.join(root, ref)), onDisk2 = fs.readFileSync(path.join(root, ref2));
  assert.equal(onDisk.includes(Buffer.from("PATIENT SECRET")), false, "plaintext must never reach the disk");
  assert.equal(onDisk.subarray(0, 4).toString(), "LMD1");
  assert.notDeepEqual(onDisk, onDisk2, "same plaintext, different ciphertext (random IV)");
  assert.equal(fs.statSync(path.join(root, ref)).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(path.join(root, ref))).mode & 0o777, 0o700);
  assert.deepEqual(fs.readdirSync(path.dirname(path.join(root, ref))).filter((f) => f.endsWith(".tmp")), [], "no temporary files left behind");

  await storage.remove(ref);
  assert.equal(await code(storage.get(ref)), "MEDICAL_STORAGE_NOT_FOUND");
});

test("encrypted storage: tampering, truncation, wrong key and moved ciphertext are all rejected", async (t) => {
  const root = tmp(); t.after(() => rmSync(root, { recursive: true, force: true }));
  const storage = createEncryptedFileMedicalStorage({ root, key: KEY });
  const a = await storage.put({ workspaceId: "ws", siteProjectId: "site", body: PLAINTEXT });
  const b = await storage.put({ workspaceId: "ws", siteProjectId: "site", body: Buffer.from("other document") });
  const fileA = path.join(root, a), original = fs.readFileSync(fileA);

  const flipped = Buffer.from(original); flipped[flipped.length - 1] ^= 0x01; fs.writeFileSync(fileA, flipped);
  assert.equal(await code(storage.get(a)), "MEDICAL_STORAGE_INTEGRITY", "a flipped ciphertext bit");
  fs.writeFileSync(fileA, original.subarray(0, 20));
  assert.equal(await code(storage.get(a)), "MEDICAL_STORAGE_INTEGRITY", "a truncated object");
  fs.writeFileSync(fileA, original);
  assert.deepEqual(await storage.get(a), PLAINTEXT, "restored original decrypts again");

  const other = createEncryptedFileMedicalStorage({ root, key: crypto.randomBytes(32) });
  assert.equal(await code(other.get(a)), "MEDICAL_STORAGE_INTEGRITY", "a different key cannot read it");

  fs.copyFileSync(fileA, path.join(root, b));       // ciphertext of A placed under B's key
  assert.equal(await code(storage.get(b)), "MEDICAL_STORAGE_INTEGRITY", "ciphertext is bound to its storage key");
  assert.equal(await code(storage.get("../outside")), "MEDICAL_STORAGE_KEY_INVALID");
});

test("encryption keys: exactly 32 bytes as hex or base64, nothing else", () => {
  assert.equal(parseEncryptionKey(KEY.toString("hex")).length, 32);
  assert.equal(parseEncryptionKey(KEY.toString("base64")).length, 32);
  assert.equal(parseEncryptionKey(KEY.toString("base64url")).length, 32);
  for (const bad of ["", undefined, "short", "z".repeat(64), KEY.toString("hex").slice(2), `${KEY.toString("hex")}00`, "a".repeat(44)]) assert.equal(parseEncryptionKey(bad), null, `rejects ${String(bad).slice(0, 12)}`);
  assert.throws(() => createEncryptedFileMedicalStorage({ root: tmp(), key: Buffer.alloc(16) }), /32-byte/);
});

test("production storage is opt-in and fails closed otherwise; development is unchanged", async () => {
  const dir = tmp();
  const good = { MEDICAL_DOCUMENTS_ENABLED: "true", MEDICAL_DOCUMENT_ENCRYPTION_KEY: KEY.toString("hex"), MEDICAL_DOCUMENT_DIR: dir };
  const reasons = (env) => { const s = createMedicalStorage({ nodeEnv: "production", env }); return [s.kind, s.reason]; };
  assert.deepEqual(reasons({}), ["unconfigured", "not_enabled"]);
  assert.deepEqual(reasons({ ...good, MEDICAL_DOCUMENTS_ENABLED: "yes" }), ["unconfigured", "not_enabled"], "only the exact opt-in value enables it");
  assert.deepEqual(reasons({ ...good, MEDICAL_DOCUMENT_ENCRYPTION_KEY: "" }), ["unconfigured", "invalid_encryption_key"]);
  assert.deepEqual(reasons({ ...good, MEDICAL_DOCUMENT_ENCRYPTION_KEY: "tooshort" }), ["unconfigured", "invalid_encryption_key"]);
  assert.deepEqual(reasons({ ...good, MEDICAL_DOCUMENT_DIR: "" }), ["unconfigured", "no_storage_directory"]);
  assert.deepEqual(reasons({ ...good, MEDICAL_DOCUMENT_DIR: "relative/dir" }), ["unconfigured", "no_storage_directory"], "no cwd-relative location in production");
  assert.deepEqual(reasons(good), ["encrypted-file", undefined]);
  // The development directory variable alone never enables production storage.
  assert.deepEqual(reasons({ MEDICAL_DOCUMENT_DEV_DIR: dir }), ["unconfigured", "not_enabled"]);
  // Development ignores the opt-in and keeps the plain local adapter.
  assert.equal(createMedicalStorage({ nodeEnv: "development", root: dir, env: good }).kind, "file");

  const closed = createUnconfiguredMedicalStorage("not_enabled");
  for (const call of [() => closed.put({}), () => closed.get("k"), () => closed.remove("k")]) assert.equal(await code(Promise.resolve().then(call)), "MEDICAL_STORAGE_NOT_CONFIGURED");
  rmSync(dir, { recursive: true, force: true });
});

test("the document service is production-ready only with BOTH a scanner and configured storage", () => {
  const audit = { record() {} }, scanner = { scan: async () => ({ verdict: "clean" }) };
  const encrypted = createEncryptedFileMedicalStorage({ root: tmp(), key: KEY }), closed = createUnconfiguredMedicalStorage("not_enabled");
  const ready = (storage, scan) => createMedicalDocumentService({ db: null, audit, storage, scanner: scan, nodeEnv: "production" }).productionReady();
  assert.equal(ready(encrypted, scanner), true);
  assert.equal(ready(encrypted, null), false, "no scanner");
  assert.equal(ready(closed, scanner), false, "no storage");
  assert.equal(ready(closed, null), false);
  assert.equal(createMedicalDocumentService({ db: null, audit, storage: createFileMedicalStorage({ root: tmp() }), nodeEnv: "development" }).productionReady(), true, "development stays usable without a scanner");
});

// ---------------------------------------------------------------- ClamAV scanner (against a fake clamd)

async function fakeClamd(mode) {
  const received = { command: "", payload: Buffer.alloc(0), chunks: 0, terminated: false };
  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0), started = false;
    socket.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);
      if (!started) { const nul = buffer.indexOf(0); if (nul < 0) return; received.command = buffer.subarray(0, nul).toString(); buffer = buffer.subarray(nul + 1); started = true; if (received.command === "zPING") return socket.end(mode === "badping" ? "NOPE\0" : "PONG\0"); }
      for (;;) {
        if (buffer.length < 4) return;
        const size = buffer.readUInt32BE(0);
        if (size === 0) { received.terminated = true; break; }
        if (buffer.length < 4 + size) return;
        received.payload = Buffer.concat([received.payload, buffer.subarray(4, 4 + size)]); received.chunks += 1; buffer = buffer.subarray(4 + size);
      }
      if (mode === "ok") socket.end("stream: OK\0");
      else if (mode === "found") socket.end("stream: Win.Test.EICAR_HDB-1 FOUND\0");
      else if (mode === "error") socket.end("INSTREAM size limit exceeded. ERROR\0");
      else if (mode === "garbage") socket.end("something unexpected\0");
      else if (mode === "close") socket.destroy();
      // "silent": keep the connection open and never answer
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { port: server.address().port, received, close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }) };
}

test("scanner speaks INSTREAM correctly and maps clamd answers to verdicts", async () => {
  const body = crypto.randomBytes(200_000);        // several 64 KiB chunks
  const results = {};
  for (const [mode, expected] of [["ok", "clean"], ["found", "infected"], ["error", "error"], ["garbage", "error"], ["close", "error"]]) {
    const clamd = await fakeClamd(mode);
    const scanner = createClamavScanner({ host: "127.0.0.1", port: clamd.port, timeoutMs: 2000 });
    results[mode] = (await scanner.scan({ body })).verdict;
    assert.equal(results[mode], expected, mode);
    if (mode === "ok") {
      assert.equal(clamd.received.command, "zINSTREAM");
      assert.ok(clamd.received.chunks >= 4, "multi-chunk framing");
      assert.equal(clamd.received.terminated, true, "stream is terminated with a zero-length chunk");
      assert.deepEqual(clamd.received.payload, body, "clamd receives exactly the document bytes");
    }
    await clamd.close();
  }
});

test("scanner fails closed on silence, refusal and an unreachable daemon", async () => {
  const silent = await fakeClamd("silent");
  const started = Date.now();
  assert.equal((await createClamavScanner({ host: "127.0.0.1", port: silent.port, timeoutMs: 300 }).scan({ body: Buffer.from("x") })).verdict, "error");
  assert.ok(Date.now() - started < 3000, "a silent daemon cannot hang an upload");
  await silent.close();
  const dead = await fakeClamd("ok"); const port = dead.port; await dead.close();   // port now refuses
  assert.equal((await createClamavScanner({ host: "127.0.0.1", port, timeoutMs: 500 }).scan({ body: Buffer.from("x") })).verdict, "error");
});

test("scanner ping and environment wiring", async () => {
  const up = await fakeClamd("ok"), bad = await fakeClamd("badping");
  assert.equal(await createClamavScanner({ host: "127.0.0.1", port: up.port }).ping(), true);
  assert.equal(await createClamavScanner({ host: "127.0.0.1", port: bad.port }).ping(), false);
  await up.close(); await bad.close();
  assert.equal(createMedicalScannerFromEnv({}), null, "no CLAMAV_HOST, no scanner");
  assert.equal(createMedicalScannerFromEnv({ CLAMAV_HOST: "clamav" }).kind, "clamav");
  assert.throws(() => createClamavScanner({}), /host is required/);
});

// ---------------------------------------------------------------- shared wiring

test("one factory configures the public and operator document services identically", async () => {
  const { createSiteTestDb } = await import("../test-helpers/site-test-db.mjs");
  const { createConfiguredMedicalDocuments } = await import("../app/services/medical-document-runtime.mjs");
  const db = createSiteTestDb(), dir = tmp();
  const all = { MEDICAL_DOCUMENTS_ENABLED: "true", MEDICAL_DOCUMENT_ENCRYPTION_KEY: KEY.toString("hex"), MEDICAL_DOCUMENT_DIR: dir, CLAMAV_HOST: "127.0.0.1" };
  const make = (env, nodeEnv = "production") => createConfiguredMedicalDocuments({ db, nodeEnv, env });

  const full = make(all);
  assert.equal(full.storage.kind, "encrypted-file"); assert.equal(full.scanner.kind, "clamav"); assert.equal(full.service.productionReady(), true);
  for (const missing of ["MEDICAL_DOCUMENTS_ENABLED", "MEDICAL_DOCUMENT_ENCRYPTION_KEY", "MEDICAL_DOCUMENT_DIR", "CLAMAV_HOST"]) {
    const { [missing]: _removed, ...partial } = all;
    assert.equal(make(partial).service.productionReady(), false, `production must stay closed without ${missing}`);
  }
  assert.equal(make({}).service.productionReady(), false, "default production: closed");
  assert.equal(make({}, "development").service.productionReady(), true, "development stays usable");
  rmSync(dir, { recursive: true, force: true }); db.close();
});
