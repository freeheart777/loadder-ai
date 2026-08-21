export function buildAutomationTask({
  trigger,
  condition,
  action,
}) {
  return {
    system: `
تو طراح Workflow در Loadder هستی.
Workflow را ساده، قابل اجرا و مرحله‌ای پیشنهاد بده.
    `.trim(),

    user: `
Trigger:
${trigger || ""}

Condition:
${condition || ""}

Action:
${action || ""}

یک Workflow عملی پیشنهاد بده.
    `.trim(),
  };
}
