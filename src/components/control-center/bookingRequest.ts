// How the Booking panels address the canonical /api/booking endpoints. With a site, every request
// is pinned to that site (query for reads, body for writes); without one it is the workspace's own
// site-less view. Kept free of React so the scope invariant is unit-testable.
export const bookingReadPath = (siteProjectId?: string) => (siteProjectId ? `/api/booking?siteProjectId=${encodeURIComponent(siteProjectId)}` : "/api/booking");

/** The pinned id comes last so a caller-supplied body can never redirect a write to another site. */
export function bookingRequestInit(siteProjectId: string | undefined, method: string, body?: object): RequestInit {
  return {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify({ ...body, ...(siteProjectId ? { siteProjectId } : {}) }) : undefined,
  };
}
