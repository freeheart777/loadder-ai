// One header policy for every public HTML surface a published site is served
// on: the custom domain, /sites/:id and the legacy /api/auth/sites/:id route.
//
// The server-rendered pages contain no scripts and no forms, so script-src can
// be closed entirely — which also means a hostile href could not execute even
// if one reached the markup. Inline <style> is required by the renderer, and
// images may be https or inline data URLs, so both stay allowed.

export const PUBLIC_SITE_CSP = [
  "default-src 'self'",
  "img-src 'self' https: data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "script-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const BASE = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": PUBLIC_SITE_CSP,
};

/** Headers for a published public page. */
export const publishedSiteHeaders = (extra = {}) => ({
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  ...BASE,
  ...extra,
});

/** Headers for a tokenised draft preview: private, and never indexed. */
export const previewSiteHeaders = (extra = {}) => ({
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  ...BASE,
  "Referrer-Policy": "no-referrer",
  ...extra,
});
