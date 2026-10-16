import { createContext, useContext, useRef, useState } from "react";
import type { CSSProperties, ElementType, KeyboardEvent, ReactNode } from "react";
import { describeField, normalizeFieldText } from "./editable-fields";
import type { EditableFieldRef } from "./editable-fields";
import type { StudioConfig } from "./types";

// Direct text editing on the canvas. The text is edited in place on the element that renders it; the result goes
// through the Phase 1 registry (`writeField`) into the SAME document state the Inspector edits, so there is no second
// store. Outside the interactive Studio canvas (preview, published pages) this renders exactly the plain element.

export type InlineEdit = { config: StudioConfig; commit: (ref: EditableFieldRef, text: string) => void };
export const InlineEditContext = createContext<InlineEdit | null>(null);

type Props = {
  as?: ElementType;
  field: EditableFieldRef;
  value: string;
  className?: string;
  style?: CSSProperties;
  /** Shown when the field is empty (display only; the stored value stays empty). */
  fallback?: string;
  children?: ReactNode;   // optional decoration rendered after the text while NOT editing
};

/**
 * Leaving a page (or changing the page list) first commits a text edit in progress to the page it belongs to.
 * All direct DOM access for inline editing lives in this module; the state-owned canvas and Studio page stay free of it.
 */
export function commitActiveInlineEdit() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.dataset.editing === "true") active.blur();
}

const label = (field: EditableFieldRef) => ("field" in field ? field.field : "text");

export default function EditableText({ as: Tag = "span", field, value, className, style, fallback, children }: Props) {
  const inline = useContext(InlineEditContext);
  const spec = inline ? describeField(inline.config, field) : null;
  const [editing, setEditing] = useState(false);
  // The text shown while editing is captured once on entry: React never re-renders it, so the caret is never disturbed.
  const [initial, setInitial] = useState(value);
  const host = useRef<HTMLElement | null>(null);
  const composing = useRef(false);
  const finished = useRef(false);

  if (!inline || !spec) return <Tag className={className} style={style}>{value || fallback || ""}{children}</Tag>;

  const begin = () => { finished.current = false; setInitial(value); setEditing(true); };
  const focusEnd = (node: HTMLElement | null) => {
    host.current = node;
    if (!node || !editing || node.dataset.started) return;
    node.dataset.started = "1";
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  const readText = () => {
    const node = host.current;
    if (!node) return value;
    // innerText keeps line breaks of multiline fields; single-line fields are flattened by the registry.
    return normalizeFieldText(spec.multiline ? node.innerText : node.textContent, spec.multiline, spec.maxLength);
  };
  const finish = (commit: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const text = commit ? readText() : null;
    setEditing(false);
    if (text !== null && text !== value) inline.commit(field, text);
  };

  if (!editing) {
    return <Tag
      key="view"
      className={`${className ?? ""} cursor-text rounded-sm outline-none hover:outline hover:outline-1 hover:outline-dashed hover:outline-violet-400/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500`}
      style={style}
      tabIndex={0}
      data-editable-field={label(field)}
      data-editable-scope={field.scope}
      onDoubleClick={(event: React.MouseEvent) => { event.stopPropagation(); begin(); }}
      onKeyDown={(event: KeyboardEvent) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === "F2")) { event.preventDefault(); event.stopPropagation(); begin(); } }}
    >{value || fallback || ""}{children}</Tag>;
  }

  return <Tag
    key="edit"
    ref={focusEnd}
    className={`${className ?? ""} cursor-text rounded-sm outline outline-2 outline-violet-500`}
    style={{ ...style, minWidth: "1ch", whiteSpace: spec.multiline ? "pre-wrap" : undefined }}
    contentEditable
    suppressContentEditableWarning
    spellCheck={false}
    role="textbox"
    aria-multiline={spec.multiline}
    aria-label={`ویرایش متن (${label(field)})`}
    data-editable-field={label(field)}
    data-editing="true"
    data-editable-scope={field.scope}
    draggable={false}
    onClick={(event: React.MouseEvent) => event.stopPropagation()}
    onDoubleClick={(event: React.MouseEvent) => event.stopPropagation()}
    onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
    onDragStart={(event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); }}
    onDrop={(event: React.DragEvent) => event.preventDefault()}
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={() => { composing.current = false; }}
    onPaste={(event: React.ClipboardEvent) => {
      // Plain text only, whatever the clipboard carries.
      event.preventDefault();
      const text = normalizeFieldText(event.clipboardData.getData("text/plain"), spec.multiline, spec.maxLength);
      document.execCommand("insertText", false, text);
    }}
    onKeyDown={(event: KeyboardEvent) => {
      event.stopPropagation();   // no section shortcuts, no page navigation, no app undo while typing
      if (event.nativeEvent.isComposing || composing.current) return;
      if (event.key === "Escape") { event.preventDefault(); finish(false); return; }
      if (event.key === "Enter" && (!spec.multiline || event.ctrlKey || event.metaKey)) { event.preventDefault(); finish(true); return; }
      if (event.key === "Enter" && spec.multiline && event.shiftKey) { event.preventDefault(); document.execCommand("insertLineBreak"); }
    }}
    onKeyUp={(event: KeyboardEvent) => event.stopPropagation()}
    onBlur={() => { if (!composing.current) finish(true); else window.setTimeout(() => finish(true), 0); }}
  >{initial}</Tag>;
}
