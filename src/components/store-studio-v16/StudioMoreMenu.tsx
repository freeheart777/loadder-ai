import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DotsThree } from "@phosphor-icons/react";

// The Studio's secondary actions in one discoverable menu, so the top bar keeps only what editing needs
// (name and state, undo/redo, preview, save, publish). Every action that used to sit in the bar is here, unchanged.

export type MoreItem =
  | { kind: "link"; id: string; label: string; to: string; attrs?: Record<string, string> }
  | { kind: "external"; id: string; label: string; href: string }
  | { kind: "button"; id: string; label: string; onSelect: () => void }
  | { kind: "info"; id: string; label: string; attrs?: Record<string, string> };

const row = "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-right text-xs font-bold text-white/85 hover:bg-white/[.07] focus-visible:bg-white/[.1] focus-visible:outline-none";

export default function StudioMoreMenu({ items, children }: { items: MoreItem[]; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const onPointer = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onPointer); };
  }, [open]);

  return <div ref={root} className="relative">
    <button ref={trigger} type="button" data-studio-more aria-label="گزینه‌های بیشتر" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid min-h-10 min-w-10 place-items-center rounded-xl border border-white/10 bg-white/[.045] text-white/80 hover:bg-white/[.08]"><DotsThree size={20} weight="bold" /></button>
    {open && <div role="menu" aria-label="گزینه‌های بیشتر" data-studio-more-menu className="absolute left-0 top-full z-[90] mt-2 grid w-64 gap-0.5 rounded-2xl border border-white/10 bg-[#0d1624] p-2 shadow-2xl max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:left-auto max-sm:top-auto max-sm:mt-0 max-sm:w-auto">
      {items.map((item) => {
        if (item.kind === "link") return <Link key={item.id} role="menuitem" to={item.to} onClick={() => setOpen(false)} className={row} {...item.attrs}>{item.label}</Link>;
        if (item.kind === "external") return <a key={item.id} role="menuitem" href={item.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={row}>{item.label}</a>;
        if (item.kind === "button") return <button key={item.id} type="button" role="menuitem" onClick={() => { setOpen(false); item.onSelect(); }} className={row}>{item.label}</button>;
        return <span key={item.id} role="presentation" className="px-3 py-2 text-[11px] text-white/50" {...item.attrs}>{item.label}</span>;
      })}
      {children}
    </div>}
  </div>;
}
