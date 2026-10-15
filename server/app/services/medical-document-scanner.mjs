import net from "node:net";

// Malware scanning through a ClamAV daemon (clamd, INSTREAM over TCP). Implements the scanner contract of
// medical-document-service: scan({ body, mimeType }) -> { verdict: "clean" | "infected" | "error" }.
// Anything that is not an explicit clean answer (refused connection, timeout, truncated or unknown reply,
// clamd ERROR, size limit) is "error", which the service turns into a 503 and stores nothing: fail closed.
const CHUNK = 64 * 1024;

export function createClamavScanner({ host, port = 3310, timeoutMs = 20_000, connect = (options) => net.connect(options) }) {
  if (!host) throw new Error("A ClamAV host is required.");
  const exchange = (frames) => new Promise((resolve) => {
    let settled = false, reply = "";
    const socket = connect({ host, port });
    const done = (value) => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); resolve(value); };
    const timer = setTimeout(() => done(null), timeoutMs);
    socket.on("error", () => done(null));
    socket.on("data", (data) => { reply += data.toString("latin1"); });
    socket.on("close", () => done(reply || null));
    socket.on("end", () => done(reply || null));
    socket.on("connect", () => { for (const frame of frames) socket.write(frame); });
  });

  async function scan({ body }) {
    const data = Buffer.from(body);
    const frames = [Buffer.from("zINSTREAM\0")];
    for (let offset = 0; offset < data.length; offset += CHUNK) {
      const chunk = data.subarray(offset, Math.min(offset + CHUNK, data.length)), header = Buffer.alloc(4);
      header.writeUInt32BE(chunk.length); frames.push(header, chunk);
    }
    frames.push(Buffer.alloc(4));                       // zero-length chunk terminates the stream
    const reply = (await exchange(frames))?.replace(/\0/g, "").trim() ?? "";
    if (/^stream: OK$/.test(reply)) return { verdict: "clean" };
    if (/^stream: .+ FOUND$/.test(reply)) return { verdict: "infected" };
    return { verdict: "error" };                        // ERROR, empty, truncated or anything unexpected
  }

  async function ping() { return (await exchange([Buffer.from("zPING\0")]))?.replace(/\0/g, "").trim() === "PONG"; }
  return Object.freeze({ kind: "clamav", scan, ping });
}

export function createMedicalScannerFromEnv(env = process.env) {
  if (!env.CLAMAV_HOST) return null;
  const port = Number(env.CLAMAV_PORT || 3310);
  return createClamavScanner({ host: env.CLAMAV_HOST, port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 3310 });
}
