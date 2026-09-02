const configuredBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
).trim();

export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, "");

const nativeFetch = globalThis.fetch.bind(globalThis);
const API_FETCH_PATCH_FLAG = "__loadderApiFetchPatched__";

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

if (!(globalThis as typeof globalThis & Record<string, unknown>)[API_FETCH_PATCH_FLAG]) {
  (globalThis as typeof globalThis & Record<string, unknown>)[API_FETCH_PATCH_FLAG] = true;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const targetsApi = url === API_BASE_URL || url.startsWith(`${API_BASE_URL}/`);
    if (!targetsApi || init?.credentials) return nativeFetch(input, init);
    return nativeFetch(input, { ...init, credentials: "include" });
  }) as typeof globalThis.fetch;
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function apiFetch(
  path: string,
  init?: RequestInit
) {
  return nativeFetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...init?.headers,
    },
  });
}
