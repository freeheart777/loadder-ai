import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Loadder AI Server",
  });
});

app.post("/api/business-brain/analyze", async (req, res) => {
  try {
    const {
      website = "",
      businessDescription = "",
      brandNotes = "",
    } = req.body;

    if (
      !website.trim() &&
      !businessDescription.trim() &&
      !brandNotes.trim()
    ) {
      return res.status(400).json({
        error: "حداقل یک منبع اطلاعاتی وارد کن.",
      });
    }

    const prompt = `
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
  "growthOpportunities": [
    {
      "title": "",
      "reason": "",
      "priority": "بالا"
    }
  ],
  "risks": [
    {
      "title": "",
      "reason": ""
    }
  ],
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

    const response = await openai.responses.create({
      model: "gpt-5.6-terra",
      reasoning: {
        effort: "low",
      },
      input: prompt,
      max_output_tokens: 2500,
    });

    const raw = response.output_text;

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

      parsed = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error("Business Brain error:", error);

    res.status(500).json({
      error: "تحلیل Business Brain انجام نشد.",
      details:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(
    `Loadder AI Server running on http://localhost:${PORT}`
  );
});
