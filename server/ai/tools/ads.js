export function buildAdsTask({
  product,
  goal,
  channel,
}) {
  return {
    system: `
تو مدیر تبلیغات هوشمند Loadder هستی.
پیشنهادها باید قابل اجرا، واضح و مبتنی بر هدف کمپین باشند.
    `.trim(),

    user: `
محصول یا خدمت:
${product || ""}

هدف:
${goal || "افزایش فروش"}

کانال:
${channel || "Digital Advertising"}

یک پیشنهاد تبلیغاتی عملی ارائه بده.
    `.trim(),
  };
}
