import express from "express";

const PLATFORM_ROLES = new Set([
  "platform_super_admin",
  "platform_support",
  "platform_ops",
  "platform_finance",
  "platform_security",
]);

function normalizeRoles(value) {
  const roles = Array.isArray(value) ? value : [];
  return [...new Set(roles.map((role) => String(role || "").trim()).filter((role) => PLATFORM_ROLES.has(role)))];
}

export function createPlatformGrantResolver(raw = process.env.LOADDER_PLATFORM_ADMIN_GRANTS) {
  let grants = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) grants = parsed;
    } catch {
      grants = {};
    }
  }

  return function resolvePlatformGrant(user) {
    if (!user?.id) return null;
    const roles = normalizeRoles(grants[user.id]);
    return roles.length ? { userId: user.id, roles } : null;
  };
}

export function createPlatformAdminReadModel(db) {
  const count = (sql) => Number(db.prepare(sql).get()?.count || 0);
  return {
    overview() {
      return {
        users: {
          total: count("SELECT COUNT(*) AS count FROM users"),
          active: count("SELECT COUNT(*) AS count FROM users WHERE status='active'"),
          evidence: "persisted",
        },
        workspaces: {
          total: count("SELECT COUNT(*) AS count FROM workspaces"),
          active: count("SELECT COUNT(*) AS count FROM workspaces WHERE status='active'"),
          evidence: "persisted",
        },
        sessions: {
          active: count("SELECT COUNT(*) AS count FROM sessions WHERE revoked_at IS NULL AND expires_at > datetime('now')"),
          evidence: "persisted",
        },
        projects: {
          status: "unavailable",
          reason: "project aggregation is intentionally deferred from the authorization foundation",
        },
        readiness: {
          status: "unknown",
          reason: "platform-wide readiness aggregation is not authoritative in this foundation",
        },
      };
    },
  };
}

// This router is intentionally mounted after global auth and before workspace resolution.
export function createPlatformAdminRouter({
  readModel,
  auditRepository,
  resolvePlatformGrant = createPlatformGrantResolver(),
  now = () => new Date().toISOString(),
}) {
  const router = express.Router();

  router.use((req, res, next) => {
    const grant = resolvePlatformGrant(req.user);
    if (!grant) {
      return res.status(403).json({
        success: false,
        code: "PLATFORM_ADMIN_ACCESS_DENIED",
        message: "Platform administrator access denied.",
      });
    }
    req.platformGrant = grant;
    return next();
  });

  router.get("/overview", (req, res) => {
    try {
      const overview = readModel.overview();
      auditRepository.createAuditLog({
        workspaceId: null,
        userId: req.user.id,
        action: "platform_admin.read_overview",
        resourceType: "platform_admin",
        resourceId: "overview",
        metadata: { roles: req.platformGrant.roles },
        createdAt: now(),
      });
      return res.json({
        success: true,
        mode: "read-only",
        roles: req.platformGrant.roles,
        overview,
      });
    } catch (error) {
      console.error("Platform admin overview error:", error);
      return res.status(500).json({
        success: false,
        code: "PLATFORM_ADMIN_INTERNAL_ERROR",
        message: "Unable to load platform administration overview.",
      });
    }
  });

  return router;
}
