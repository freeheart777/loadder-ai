import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: join(__dirname, "../../.env.cloudflare"),
  quiet: true,
});

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID;

const API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN;

const MODEL =
  process.env.CLOUDFLARE_MODEL ||
  "@cf/qwen/qwen3-30b-a3b-fp8";

export async function runCloudflare({
  system,
  user,
  maxTokens = 500,
  temperature = 0.7,
}) {
  if (!ACCOUNT_ID || !API_TOKEN) {
    throw new Error(
      "Cloudflare configuration is incomplete."
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: "system",
            content: system,
          },
          {
            role: "user",
            content: user,
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errorMessage =
      data?.errors?.[0]?.message ||
      "Cloudflare AI request failed.";

    throw new Error(errorMessage);
  }

  const answer =
    data?.result?.response ??
    data?.result?.text ??
    "";

  return {
    provider: "cloudflare",
    model: MODEL,
    answer,
    raw: data.result,
  };
}
