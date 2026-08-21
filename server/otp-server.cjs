const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3001;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
    credentials: true,
  })
);

app.use(express.json());

const otpStore = new Map();

const sendOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
  },
});

function normalizeMobile(value = "") {
  return String(value).replace(/\s+/g, "");
}

function isValidIranMobile(mobile) {
  return /^09\d{9}$/.test(mobile);
}

function generateOtp() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "Loadder OTP",
  });
});

app.post("/api/auth/send-otp", sendOtpLimiter, (req, res) => {
  const mobile = normalizeMobile(req.body.mobile);
  const name = String(req.body.name || "").trim();

  if (name.length < 2) {
    return res.status(400).json({
      success: false,
      message: "نام معتبر وارد کنید.",
    });
  }

  if (!isValidIranMobile(mobile)) {
    return res.status(400).json({
      success: false,
      message: "شماره موبایل معتبر نیست.",
    });
  }

  const otp = generateOtp();

  otpStore.set(mobile, {
    otp,
    name,
    expiresAt: Date.now() + 2 * 60 * 1000,
    attempts: 0,
  });

  console.log("");
  console.log("======================================");
  console.log("🔐 LOADDER OTP");
  console.log("Name:", name);
  console.log("Mobile:", mobile);
  console.log("OTP:", otp);
  console.log("Valid for: 2 minutes");
  console.log("======================================");
  console.log("");

  res.json({
    success: true,
    message: "کد تأیید ایجاد شد.",
  });
});

app.post("/api/auth/verify-otp", (req, res) => {
  const mobile = normalizeMobile(req.body.mobile);
  const code = String(req.body.code || "").trim();

  const record = otpStore.get(mobile);

  if (!record) {
    return res.status(400).json({
      success: false,
      message: "ابتدا درخواست کد تأیید بدهید.",
    });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(mobile);

    return res.status(400).json({
      success: false,
      message: "کد تأیید منقضی شده است.",
    });
  }

  record.attempts += 1;

  if (record.attempts > 5) {
    otpStore.delete(mobile);

    return res.status(429).json({
      success: false,
      message: "تعداد تلاش‌ها بیش از حد مجاز است.",
    });
  }

  if (record.otp !== code) {
    return res.status(400).json({
      success: false,
      message: "کد تأیید اشتباه است.",
    });
  }

  otpStore.delete(mobile);

  res.json({
    success: true,
    message: "ورود موفق بود.",
    user: {
      name: record.name,
      mobile,
    },
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log(`🚀 Loadder OTP Server`);
  console.log(`http://localhost:${PORT}`);
  console.log("");
});
