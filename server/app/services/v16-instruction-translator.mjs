import { resolveTarget } from "./v16-patch-engine.mjs";
import { targetKind } from "./v16-patch-policy.mjs";

// Ask Loadder's natural-language front door onto the structured patch engine.
//
// This module is pure and deterministic: same document + same instruction
// always yields the same operations. It NEVER invents a path that would
// bypass the Commerce Truth guard on its own initiative — where it attempts a
// price change, it is producing exactly what a naive translation would
// produce, and relies on v16-patch-policy to reject it structurally. It never
// widens the contract; it only ever proposes operations already legal under
// v16-patch-policy's ALLOWED table.

export class InstructionTranslatorError extends Error {
  constructor(message, code = "TRANSLATOR_ERROR") {
    super(message);
    this.name = "InstructionTranslatorError";
    this.code = code;
    this.status = 400;
  }
}

const MAX_INSTRUCTION_LENGTH = 500;
const MIN_VISIBLE_PRODUCTS = 1;
const MAX_VISIBLE_PRODUCTS = 12;
const SPACING_STEP = 24;
const MAX_SPACING = 96;

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Persian/Arabic-Indic digits read as Latin ones; everything else untouched. */
function toLatinDigits(text) {
  return String(text ?? "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)));
}

/**
 * Translate one natural-language instruction into structured patch operations
 * against exactly one already-selected section. Resolution never spans
 * beyond that target: an instruction cannot address any other part of the
 * document, no matter what it says.
 */
export function translateInstruction({ document, target, instruction }) {
  const text = String(instruction ?? "").trim();
  if (!text) throw new InstructionTranslatorError("یک دستور برای Ask Loadder لازم است.", "TRANSLATOR_INSTRUCTION_REQUIRED");
  if (text.length > MAX_INSTRUCTION_LENGTH) {
    throw new InstructionTranslatorError(`دستور باید حداکثر ${MAX_INSTRUCTION_LENGTH} نویسه باشد.`, "TRANSLATOR_INSTRUCTION_TOO_LONG");
  }
  if (targetKind(target) !== "section") {
    throw new InstructionTranslatorError("Ask Loadder فقط روی یک بخش انتخاب‌شده عمل می‌کند.", "TRANSLATOR_TARGET_MUST_BE_SECTION");
  }

  const builder = document && typeof document.storeBuilderV16 === "object" ? document.storeBuilderV16 : null;
  const section = builder ? resolveTarget(builder, target) : null;
  if (!section) throw new InstructionTranslatorError("بخش انتخاب‌شده در سند پیدا نشد.", "TRANSLATOR_SECTION_NOT_FOUND");

  const normalized = toLatinDigits(text);
  const operations = [];
  const matches = [];
  const warnings = [];
  const isProducts = section.type === "products";

  // 1. "Calmer / less busy" — presentation spacing, legal on every section.
  if (/خلوت|فضای\s*بیشتر/.test(text)) {
    const nextTop = Math.min(MAX_SPACING, Number(section.spacingTop || 0) + SPACING_STEP);
    const nextBottom = Math.min(MAX_SPACING, Number(section.spacingBottom || 0) + SPACING_STEP);
    if (nextTop !== section.spacingTop) operations.push({ type: "SET", target, path: "spacingTop", value: nextTop });
    if (nextBottom !== section.spacingBottom) operations.push({ type: "SET", target, path: "spacingBottom", value: nextBottom });
    matches.push("density");
  }

  // 2. Product count — only meaningful, and only in-contract, on a products
  // section. visibleProductCount lives OUTSIDE productSettings on purpose.
  const countMatch = normalized.match(/(\d+)\s*(?:تا\s*)?محصول/);
  if (countMatch) {
    if (!isProducts) {
      warnings.push("این بخش محصول ندارد؛ تعداد نمایش تغییر نکرد.");
    } else {
      const requested = Math.max(MIN_VISIBLE_PRODUCTS, Math.min(MAX_VISIBLE_PRODUCTS, parseInt(countMatch[1], 10)));
      const current = Number(section.visibleProductCount) || MAX_VISIBLE_PRODUCTS;
      if (requested !== current) operations.push({ type: "SET", target, path: "visibleProductCount", value: requested });
      matches.push("productCount");
    }
  }

  // 3. Bigger images — same rule: in-contract only on a products section.
  if (/(تصویر|تصاویر|عکس)/.test(text) && /بزرگ/.test(text)) {
    if (!isProducts) {
      warnings.push("اندازه تصویر برای این نوع بخش قابل تنظیم نیست.");
    } else if (section.productImageSize !== "large") {
      operations.push({ type: "SET", target, path: "productImageSize", value: "large" });
      matches.push("imageSize");
    } else {
      warnings.push("تصاویر این بخش از پیش در بزرگ‌ترین حالت هستند.");
    }
  }

  // 4. Price / Commerce truth. Deliberately translated as an attempted SET so
  // the existing Commerce Truth guard in v16-patch-policy rejects it
  // structurally — this translator does not special-case or soften that
  // rejection, and does not silently drop the request either.
  if (/قیمت/.test(text) && (/تومان|ریال/.test(text) || /\d/.test(normalized))) {
    const amount = Number((normalized.match(/\d+/) || ["0"])[0]);
    operations.push({ type: "SET", target, path: "price", value: amount });
    warnings.push("درخواست تغییر قیمت رد شد: قیمت جزو صحت تجاری محافظت‌شده است و از طریق Ask Loadder قابل تغییر نیست.");
    matches.push("priceAttempt");
  }

  if (!operations.length) {
    throw new InstructionTranslatorError("هیچ تغییر قابل‌اجرا و مجازی در این دستور شناسایی نشد.", "TRANSLATOR_NO_OPERATIONS");
  }

  return { operations, matches, warnings };
}
