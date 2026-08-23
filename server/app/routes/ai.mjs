import express from "express";
import { executeAgentTask } from "../../ai/agent/executor.js";
import { runCloudflare } from "../../ai/providers/cloudflare.js";
import { AiProviderError } from "../ai/ai-provider-errors.mjs";

function cleanPersian(value) {
  if (typeof value !== "string") return value;

  return value
    .replace(/Quảng cáo/gi, "تبلیغات")
    .replace(/tìm kiếm/gi, "جستجو")
    .replace(/광고/gi, "تبلیغات")
    .replace(/Angebot/gi, "پیشنهاد")
    .replace(/previous/gi, "قبلی")
    .replace(/campaign/gi, "کمپین")
    .replace(/Social Media Platforms/gi, "شبکه‌های اجتماعی")
    .replace(/Social Media/gi, "شبکه‌های اجتماعی")
    .replace(/Email Marketing/gi, "ایمیل مارکتینگ")
    .replace(/Content Marketing/gi, "بازاریابی محتوایی")
    .replace(/Pay-Per-Click/gi, "تبلیغات کلیکی")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function createAiRouter({ businessBrainService = null, cloudflareRunner = runCloudflare, agentRunner = executeAgentTask, readiness = () => ({ openaiConfigured: false, cloudflareConfigured: false, businessBrainConfigured: false, contentGenerationConfigured: false }) } = {}) {
const router = express.Router();
router.get("/ai/health", (_req, res) => res.json({ success: true, service: "Loadder AI", providers: readiness() }));

router.post("/agent/run", async (req, res) => {
  try {
    const result = await agentRunner(req.body);
    res.json(result);
  } catch {
    res.status(502).json({ success: false, code: "AI_PROVIDER_UNAVAILABLE", message: "Agent request could not be completed." });
  }
});

router.post("/ai/chat", async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "پیام نمی‌تواند خالی باشد.",
      });
    }

    if (message.length > 4000) return res.status(400).json({ success: false, code: "AI_INPUT_INVALID", message: "پیام معتبر نیست." });
    const result = await cloudflareRunner({
      system:
        "You are Loadder AI, a senior Persian-speaking business growth strategist. If the user writes in Persian, respond only in fluent natural Persian. Do not mix Persian with Vietnamese, Chinese, Korean, or other languages. Use clear headings, concise explanations, practical recommendations, and correct digital marketing terminology. Avoid repetition.",
      user: message,
      maxTokens: 500,
      temperature: 0.7,
    });

    return res.json({
      success: true,
      model: result.model,
      answer: cleanPersian(result.answer),
    });
  } catch {
    return res.status(502).json({
      success: false,
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "ارتباط با موتور هوش مصنوعی ناموفق بود.",
    });
  }
});

router.post("/business-brain/analyze", async (req, res) => {
  try {
    if (!businessBrainService) throw new AiProviderError("AI_OPERATION_DISABLED");
    const result = await businessBrainService.analyze(req.body, { userId: req.user.id });
    return res.json({ success: true, data: result.data, reusedResult: result.reusedResult });
  } catch (error) {
    const normalized = error instanceof AiProviderError ? error : new AiProviderError("AI_PROVIDER_UNAVAILABLE");
    if (normalized.retryAfter) res.set("Retry-After", String(normalized.retryAfter));
    return res.status(normalized.status).json({ success: false, code: normalized.code, message: "تحلیل Business Brain انجام نشد." });
  }
});
return router;
}

export default createAiRouter();
