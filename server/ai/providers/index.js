import { runCloudflare } from "./cloudflare.js";

export async function runAI({
  provider = "cloudflare",
  system,
  user,
  maxTokens,
  temperature,
}) {
  if (provider === "cloudflare") {
    return runCloudflare({
      system,
      user,
      maxTokens,
      temperature,
    });
  }

  throw new Error(
    `Unsupported AI provider: ${provider}`
  );
}
