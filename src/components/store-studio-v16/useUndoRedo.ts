import { useCallback, useEffect, useRef, useState } from "react";

const LIMIT = 100;
const COALESCE_MS = 700;

// Undo/redo over the editor document. Anything that changes `documentKey` is recorded; a burst of edits within
// COALESCE_MS (typing, dragging a slider) is one step. `selection`-only changes never reach the key, so they are not steps.
// `reset` starts a fresh history from a wholesale load (open, create, rollback, AI patch) so undo can never cross it.
export function useUndoRedo<T>(value: T, documentKey: (value: T) => string, apply: (value: T) => void) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const committed = useRef<{ value: T; key: string }>({ value, key: documentKey(value) });
  const lastPush = useRef(0);
  const applying = useRef(false);
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);

  useEffect(() => {
    const key = documentKey(value);
    if (applying.current) { applying.current = false; committed.current = { value, key }; return; }
    if (key === committed.current.key) { committed.current = { value, key: committed.current.key }; return; }
    const now = Date.now();
    if (now - lastPush.current > COALESCE_MS || past.current.length === 0) {
      past.current.push(committed.current.value);
      if (past.current.length > LIMIT) past.current.shift();
    }
    lastPush.current = now;
    future.current = [];
    committed.current = { value, key };
    refresh();
  }, [value, documentKey]);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(committed.current.value);
    lastPush.current = 0;
    applying.current = true;
    apply({ ...previous });
    refresh();
  }, [apply]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(committed.current.value);
    lastPush.current = 0;
    applying.current = true;
    apply({ ...next });
    refresh();
  }, [apply]);

  const reset = useCallback((fresh: T) => {
    past.current = []; future.current = [];
    committed.current = { value: fresh, key: documentKey(fresh) };
    lastPush.current = 0;
    refresh();
  }, [documentKey]);

  return { undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
