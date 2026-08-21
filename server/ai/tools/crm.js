export function buildCRMTask({
  customer,
  goal,
}) {
  return {
    system: `
تو Agent مدیریت ارتباط با مشتری Loadder هستی.
پاسخ باید عملی، کوتاه و تجاری باشد.
    `.trim(),

    user: `
اطلاعات مشتری:
${JSON.stringify(customer || {}, null, 2)}

هدف:
${goal || "پیشنهاد بهترین اقدام بعدی"}

بهترین اقدام بعدی را پیشنهاد بده.
    `.trim(),
  };
}
