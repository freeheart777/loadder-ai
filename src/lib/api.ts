const configuredBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
).trim();

export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, "");

const nativeFetch = globalThis.fetch.bind(globalThis);
const API_FETCH_PATCH_FLAG = "__loadderApiFetchPatched__";
let canonicalStoreProjectId = "";

export function setCanonicalStoreProjectId(projectId: string | null | undefined) {
  canonicalStoreProjectId = String(projectId || "").trim();
}

export function getCanonicalStoreProjectId() {
  return canonicalStoreProjectId;
}

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

async function normalizeCanonicalStoreListing(response: Response) {
  if (!canonicalStoreProjectId || !response.ok) return response;
  const data = await response.clone().json().catch(() => null);
  if (!data || !Array.isArray(data.projects)) return response;
  const index = data.projects.findIndex((project: { id?: string }) => project?.id === canonicalStoreProjectId);
  if (index <= 0) return response;
  const projects = [...data.projects];
  const [active] = projects.splice(index, 1);
  projects.unshift(active);
  return new Response(JSON.stringify({ ...data, projects }), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export async function apiFetch(
  path: string,
  init?: RequestInit
) {
  const response = await nativeFetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...init?.headers,
    },
  });
  const method = String(init?.method || "GET").toUpperCase();
  if (method === "GET" && path.replace(/\/+$/, "") === "/api/site-projects") {
    return normalizeCanonicalStoreListing(response);
  }
  return response;
}
