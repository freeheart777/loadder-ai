import OpenAI from "openai";

const cleanJson = (value) => String(value || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

export function createDesignModelRouter({ env = process.env } = {}) {
  async function propose({ prompt, section, locale = "fa-IR" }) {
    if (!env.OPENAI_API_KEY) return { provider: "deterministic", model: "local-rules", proposal: deterministicProposal(prompt, section) };
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: env.OPENAI_DESIGN_MODEL || env.OPENAI_BUSINESS_BRAIN_MODEL || "gpt-5.6-terra",
      reasoning: { effort: "low" },
      max_output_tokens: 900,
      input: `You are Loadder Design Copilot. Locale: ${locale}. Return JSON only. Never return HTML, JavaScript, CSS, URLs with javascript:, or code.\nAllowed keys: title, subtitle, bg, fg, padding, radius, align, ctaText, ctaHref, imageUrl, columns.\nCurrent section: ${JSON.stringify(section)}\nUser request: ${prompt}\nReturn {"changes":{...},"summary":"..."}`,
    });
    return { provider: "openai", model: response.model || env.OPENAI_DESIGN_MODEL || "configured", proposal: JSON.parse(cleanJson(response.output_text)) };
  }
  return Object.freeze({ propose });
}

function deterministicProposal(prompt, section = {}) {
  const p = String(prompt || "").toLowerCase();
  const changes = {};
  if (/لوکس|luxury|premium/.test(p)) Object.assign(changes, { bg: "#0b0b0f", fg: "#f8fafc", radius: 28, padding: Math.max(Number(section.padding) || 48, 72) });
  if (/مینیمال|minimal/.test(p)) Object.assign(changes, { bg: "#ffffff", fg: "#111827", radius: 8, padding: 56 });
  if (/مرکز|center/.test(p)) changes.align = "center";
  if (/فروش|conversion|cta/.test(p)) changes.ctaText = "همین حالا شروع کنید";
  return { changes, summary: Object.keys(changes).length ? "پیشنهاد طراحی آماده است." : "درخواست دریافت شد؛ برای نتیجه دقیق‌تر جزئیات بیشتری بنویس." };
}
