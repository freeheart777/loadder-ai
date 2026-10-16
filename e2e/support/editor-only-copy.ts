// Wording that talks to the website's editor instead of to its visitors. Shared by the unit and browser starter-copy tests.
export const EDITOR_ONLY: [label: string, pattern: RegExp][] = [
  ["editor hint eyebrow", /برای شروع آماده و قابل ویرایش/],
  ["'write it here' instruction", /اینجا\s*(را\s*)?(بنویسید|وارد کنید|اضافه کنید)/],
  ["'editable' wording", /قابل ویرایش/],
  ["'this is a sample' disclaimer", /این\s*(کارت|یادداشت|متن|بخش)\s*نمونه است/],
  ["'publish it in this section' instruction", /(را|رو)\s*(پس از|بعد از)\s*دریافت.*(در این بخش|اینجا)\s*منتشر کنید/],
  ["'describe your … in this section' instruction", /در این بخش .*(منتشر|معرفی|بنویسید) کنید?/],
  ["'introduce your …' instruction", /(را|رو)\s[^.،]{0,60}(معرفی|تکمیل)\s*کنید/],
];
