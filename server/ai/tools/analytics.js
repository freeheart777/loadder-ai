export function buildAnalyticsTask({
  metrics,
  question,
}) {
  return {
    system: `
تو تحلیلگر رشد Loadder هستی.
از داده‌ها نتیجه‌گیری کن و پیشنهاد عملی بده.
    `.trim(),

    user: `
داده‌ها:
${JSON.stringify(metrics || {}, null, 2)}

سؤال:
${question || "چه نکته مهمی در این داده‌ها وجود دارد؟"}

تحلیل کوتاه و اجرایی ارائه بده.
    `.trim(),
  };
}
