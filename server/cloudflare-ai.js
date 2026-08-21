import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: join(__dirname, ".env.cloudflare"),
});

const app = express();

const PORT = 3002;

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID;

const API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN;

const MODEL =
  "@cf/qwen/qwen3-30b-a3b-fp8";

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
  })
);

app.use(express.json());

app.get("/api/ai/health", (req, res) => {
  res.json({
    success: true,
    service: "Loadder AI Gateway",
    configured: Boolean(
      ACCOUNT_ID && API_TOKEN
    ),
    model: MODEL,
  });
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    const message =
      String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "پیام نمی‌تواند خالی باشد.",
      });
    }

    if (!ACCOUNT_ID || !API_TOKEN) {
      return res.status(500).json({
        success: false,
        message:
          "تنظیمات Cloudflare کامل نیست.",
      });
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
          max_tokens: 500,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content:
                "You are Loadder AI, a senior Persian-speaking business growth strategist. If the user writes in Persian, respond only in fluent natural Persian. Do not mix Persian with Vietnamese, Chinese, Korean, or other languages. Use clear headings, concise explanations, practical recommendations, and correct digital marketing terminology. Avoid repetition.",
            },
            {
              role: "user",
              content: message,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(
        "Cloudflare error:",
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        success: false,
        message:
          "ارتباط با موتور هوش مصنوعی Cloudflare ناموفق بود.",
        errors: data.errors || [],
      });
    }

    const rawAnswer =
      data?.result?.response ??
      data?.result?.text ??
      data?.result ??
      "پاسخی دریافت نشد.";

    const cleanPersian = (value) => {
      if (typeof value !== "string") {
        return value;
      }

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
        .replace(/\bPPC\b/gi, "PPC")
        .replace(/\bSEO\b/gi, "SEO")
        .replace(/\s{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    };

    const answer = cleanPersian(rawAnswer);

    res.json({
      success: true,
      model: MODEL,
      answer,
      raw: data.result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message:
        "خطای داخلی در Loadder AI Gateway.",
    });
  }
});

app.listen(PORT, () => {
  console.log("");
  console.log("🧠 Loadder AI Gateway");
  console.log(`http://localhost:${PORT}`);
  console.log(`Model: ${MODEL}`);
  console.log("");
});
