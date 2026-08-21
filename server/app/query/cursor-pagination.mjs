export class CursorPaginationError extends Error {
  constructor(message = "cursor is invalid.") { super(message); this.code = "INVALID_CURSOR"; }
}

export function encodeCursor(kind, position) {
  return Buffer.from(JSON.stringify({ version: 1, kind, position }), "utf8").toString("base64url");
}

export function decodeCursor(value, kind, fields) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 1000 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new CursorPaginationError();
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (parsed?.version !== 1 || parsed.kind !== kind || !parsed.position || typeof parsed.position !== "object") throw new CursorPaginationError();
    const position = {};
    for (const field of fields) {
      const item = parsed.position[field];
      if (typeof item !== "string" || !item || item.length > 300) throw new CursorPaginationError();
      position[field] = item;
    }
    if (Object.keys(parsed.position).length !== fields.length) throw new CursorPaginationError();
    return position;
  } catch (error) {
    if (error instanceof CursorPaginationError) throw error;
    throw new CursorPaginationError();
  }
}

export function pageResult(rows, limit, kind, positionOf) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? encodeCursor(kind, positionOf(items.at(-1))) : null };
}
