// Icons a repeater item (services / metrics / features cards) can show.
// Plain data shared by templates and the Inspector; the canvas maps each name
// to a Phosphor component. An item without an icon keeps the default star.
export const SECTION_ITEM_ICONS = [
  ["scales", "ترازو"],
  ["gavel", "چکش قضاوت"],
  ["briefcase", "کیف کار"],
  ["handshake", "دست دادن"],
  ["bank", "ساختمان رسمی"],
  ["buildings", "شرکت"],
  ["house", "خانه و ملک"],
  ["users", "خانواده"],
  ["shield", "حمایت و امنیت"],
  ["certificate", "مدرک و مجوز"],
  ["trophy", "موفقیت"],
  ["medal", "افتخار"],
  ["clock", "زمان"],
  ["chat", "مشاوره"],
  ["file", "سند و قرارداد"],
  ["lightning", "سرعت"],
  ["star", "ستاره"],
] as const;

export type SectionItemIcon = (typeof SECTION_ITEM_ICONS)[number][0];

export const isSectionItemIcon = (value: unknown): value is SectionItemIcon =>
  SECTION_ITEM_ICONS.some(([name]) => name === value);
