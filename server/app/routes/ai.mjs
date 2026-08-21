import express from "express";
import OpenAI from "openai";

import { executeAgentTask } from "../../ai/agent/executor.js";
import { runCloudflare } from "../../ai/providers/cloudflare.js";

const router = express.Router();

const businessBrainPrompt = ({
  website,
  businessDescription,
  brandNotes,
}) => `
تو مغز هوشمند کسب‌وکار پلتفرم Loadder هستی.

وظیفه تو ساخت یک Business DNA اولیه برای کسب‌وکار است.

اطلاعات ورودی:

وب‌سایت:
${website || "ارائه نشده"}

توضیح کسب‌وکار:
${businessDescription || "ارائه نشده"}

اطلاعات برند:
${brandNotes || "ارائه نشده"}

خروجی را فقط به زبان فارسی و دقیقاً با این ساختار JSON بده:

{
  "businessSummary": "",
  "valueProposition": "",
  "targetAudience": [],
  "productsServices": [],
  "toneOfVoice": [],
  "marketPosition": "",
  "brandPersonality": [],
  "customerSegments": [],
  "growthOpportunities": [{ "title": "", "reason": "", "priority": "بالا" }],
  "risks": [{ "title": "", "reason": "" }],
  "recommendedActions": [],
  "confidenceScore": 0
}

قوانین:
- چیزی را که از ورودی قابل استنتاج نیست قطعی اعلام نکن.
- اگر داده کم است، محتاط باش.
- confidenceScore عددی بین 0 تا 100 باشد.
- پیشنهادها عملی و کوتاه باشند.
- متن تبلیغاتی یا کلیشه‌ای ننویس.
`;

function cleanJsonResponse(raw) {
  return String(raw || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

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

router.get("/ai/health", (req, res) => {
  res.json({
    success: true,
    service: "Loadder AI",
    providers: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      cloudflare: Boolean(
        process.env.CLOUDFLARE_ACCOUNT_ID &&
          process.env.CLOUDFLARE_API_TOKEN
      ),
    },
  });
});

router.post("/agent/run", async (req, res) => {
  try {
    const result = await executeAgentTask(req.body);
    res.json(result);
  } catch (error) {
    console.error("Agent execution error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Agent execution failed.",
    });
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

    const result = await runCloudflare({
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
      raw: result.raw,
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return res.status(502).json({
      success: false,
      message: "ارتباط با موتور هوش مصنوعی ناموفق بود.",
    });
  }
});

router.post("/business-brain/analyze", async (req, res) => {
  try {
    const website = String(req.body.website || "").trim();
    const businessDescription = String(
      req.body.businessDescription || ""
    ).trim();
    const brandNotes = String(req.body.brandNotes || "").trim();

    if (!website && !businessDescription && !brandNotes) {
      return res.status(400).json({
        success: false,
        error: "حداقل یک منبع اطلاعاتی وارد کن.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: "OpenAI برای Business Brain پیکربندی نشده است.",
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_BUSINESS_BRAIN_MODEL || "gpt-5.6-terra",
      reasoning: { effort: "low" },
      input: businessBrainPrompt({
        website,
        businessDescription,
        brandNotes,
      }),
      max_output_tokens: 2500,
    });

    return res.json({
      success: true,
      data: JSON.parse(cleanJsonResponse(response.output_text)),
    });
  } catch (error) {
    console.error("Business Brain error:", error);
    return res.status(500).json({
      success: false,
      error: "تحلیل Business Brain انجام نشد.",
    });
  }
});

export default router;

