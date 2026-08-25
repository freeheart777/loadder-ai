import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const baseUrl = String(process.env.SMOKE_API_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const mobile = String(process.env.SMOKE_OTP_MOBILE || "").replace(/\s+/g, "");
const name = String(process.env.SMOKE_OTP_NAME || "SMS OTP Smoke").trim();

if (!/^09\d{9}$/.test(mobile)) {
  throw new Error("SMOKE_OTP_MOBILE must be an operator-owned Iranian mobile in 09xxxxxxxxx format.");
}

const request = await fetch(`${baseUrl}/api/auth/send-otp`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mobile, name }),
  signal: AbortSignal.timeout(12_000),
});
const requested = await request.json();
if (!request.ok || !requested.success) {
  throw new Error(`OTP request failed: ${requested.code || request.status}`);
}
stdout.write("OTP request accepted. Enter the code received on the operator-owned phone.\n");
const terminal = createInterface({ input: stdin, output: stdout });
const code = (await terminal.question("OTP: ")).trim();
terminal.close();
if (!/^\d{5}$/.test(code)) throw new Error("OTP must be five digits.");

const verify = await fetch(`${baseUrl}/api/auth/verify-otp`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mobile, code }),
  signal: AbortSignal.timeout(12_000),
});
const verified = await verify.json();
if (!verify.ok || !verified.success || !verify.headers.get("set-cookie")) {
  throw new Error(`OTP verification failed: ${verified.code || verify.status}`);
}
stdout.write("OTP delivery and session creation verified.\n");
