export function isDemoMode() {
  if (typeof window === "undefined") return false;

  return new URLSearchParams(
    window.location.search
  ).get("demo") === "1";
}

export function withDemo(path: string) {
  if (!isDemoMode()) return path;

  const separator =
    path.includes("?") ? "&" : "?";

  return `${path}${separator}demo=1`;
}
