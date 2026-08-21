const configuredBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
).trim();

export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, "");

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function apiFetch(
  path: string,
  init?: RequestInit
) {
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...init?.headers,
    },
  });
}
