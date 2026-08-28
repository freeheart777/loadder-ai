import express from "express";
import { requireWorkspaceId } from "../tenant-context.mjs";

const safeCount = (db, table) => {
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!exists) return 0;
  try {
    return db.prepare(`SELECT count(*) AS count FROM ${table} WHERE workspace_id=?`).get(requireWorkspaceId()).count;
  } catch {
    return 0;
  }
};

export function createSiteOperationsRouter({ db, getCRMStats, integrationService }) {
  const router = express.Router();

  router.get("/site-operations/overview", (req, res) => {
    const crm = typeof getCRMStats === "function" ? getCRMStats() : {};
    const connections = typeof integrationService?.connections === "function" ? integrationService.connections() : [];
    const byCapability = (capability) => connections.filter((connection) => connection.status === "CONNECTED" && connection.capabilities?.includes?.(capability)).length;

    return res.json({
      success: true,
      overview: {
        customers: Array.isArray(crm.customers) ? crm.customers.length : safeCount(db, "customers"),
        leads: Array.isArray(crm.leads) ? crm.leads.length : safeCount(db, "leads"),
        orders: Array.isArray(crm.orders) ? crm.orders.length : safeCount(db, "orders"),
        carts: Array.isArray(crm.carts) ? crm.carts.length : safeCount(db, "carts"),
        products: safeCount(db, "products"),
        sites: safeCount(db, "site_projects"),
        appointments: safeCount(db, "appointments"),
        integrations: connections.length,
        connectedCrm: byCapability("WRITE_CRM"),
        connectedPayments: byCapability("PAYMENTS"),
        analytics: { provider: "GA4", status: "NOT_CONNECTED" },
        payment: { status: byCapability("PAYMENTS") > 0 ? "CONNECTED" : "NOT_CONNECTED" },
      },
    });
  });

  return router;
}
