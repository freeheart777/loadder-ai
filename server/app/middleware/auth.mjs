import { SESSION_COOKIE_NAME } from "../services/auth-service.mjs";

export function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return cookies;
      const key = decodeURIComponent(part.slice(0, separator));
      const value = decodeURIComponent(part.slice(separator + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

export function getSessionToken(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME] || null;
}

export function createRequireAuth(authService) {
  return function requireAuth(req, res, next) {
    const identity = authService.resolveSession(getSessionToken(req));

    if (!identity) {
      return res.status(401).json({
        ok: false,
        message: "Authentication required.",
      });
    }

    req.auth = identity;
    req.user = identity.user;
    return next();
  };
}

export function createRequireWorkspace(repository) {
  return function requireWorkspace(req, res, next) {
    const requestedWorkspaceId = String(
      req.headers["x-workspace-id"] || ""
    ).trim();
    const membership = requestedWorkspaceId
      ? repository.findMembership(req.user.id, requestedWorkspaceId)
      : req.auth.activeMembership || null;

    if (!membership) {
      return res.status(403).json({
        ok: false,
        message: "Workspace access denied.",
      });
    }

    req.membership = membership;
    req.workspace = membership.workspace;
    return next();
  };
}
