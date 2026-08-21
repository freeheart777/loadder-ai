import * as raw from "./database.mjs";
import { requireWorkspaceId } from "../app/tenant-context.mjs";

export const db = raw.db;
export const calculateCampaignKPIs = raw.calculateCampaignKPIs;
export const seedDefaultAutomations = raw.seedDefaultAutomations;
export const seedCRMData = raw.seedCRMData;
export const seedMarketingData = raw.seedMarketingData;

function owned(table, id, workspaceId = requireWorkspaceId()) {
  return Boolean(
    raw.db
      .prepare(`SELECT 1 FROM ${table} WHERE id = ? AND workspace_id = ?`)
      .get(id, workspaceId)
  );
}

function filterOwned(table, records, workspaceId = requireWorkspaceId()) {
  const ids = new Set(
    raw.db
      .prepare(`SELECT id FROM ${table} WHERE workspace_id = ?`)
      .all(workspaceId)
      .map((row) => row.id)
  );
  return records.filter((record) => ids.has(record.id));
}

function scopedCreate(create, input) {
  return create({ ...input, workspaceId: requireWorkspaceId() });
}

export function getAutomations() {
  return filterOwned("automations", raw.getAutomations());
}
export function getAutomationById(id) {
  return owned("automations", id) ? raw.getAutomationById(id) : null;
}
export function createAutomation(input) {
  return scopedCreate(raw.createAutomation, input);
}
export function updateAutomation(id, updates) {
  return owned("automations", id) ? raw.updateAutomation(id, updates) : null;
}
export function deleteAutomation(id) {
  return owned("automations", id) ? raw.deleteAutomation(id) : false;
}
export function saveEvent(event) {
  return raw.saveEvent({ ...event, workspaceId: requireWorkspaceId() });
}
export function saveExecution(execution) {
  return raw.saveExecution({
    ...execution,
    workspaceId: requireWorkspaceId(),
  });
}
export function getExecutions(limit = 100) {
  const workspaceId = requireWorkspaceId();
  return raw.db
    .prepare(`
      SELECT * FROM executions
      WHERE workspace_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(workspaceId, limit)
    .map((row) => ({
      id: row.id,
      timestamp: row.created_at,
      eventId: row.event_id,
      eventType: row.event_type,
      workflowId: row.workflow_id,
      workflowTitle: row.workflow_title,
      actionType: row.action_type,
      channel: row.channel,
      template: row.template,
      recipient: row.recipient,
      status: row.status,
      result: JSON.parse(row.result_json || "{}"),
    }));
}
export function clearExecutions() {
  return raw.db
    .prepare("DELETE FROM executions WHERE workspace_id = ?")
    .run(requireWorkspaceId());
}

export function getCustomers() {
  return filterOwned("customers", raw.getCustomers());
}
export function getCustomerById(id) {
  return owned("customers", id) ? raw.getCustomerById(id) : null;
}
export function createCustomer(input) {
  return scopedCreate(raw.createCustomer, input);
}
export function getLeads() {
  return filterOwned("leads", raw.getLeads());
}
export function getLeadById(id) {
  return owned("leads", id) ? raw.getLeadById(id) : null;
}
export function createLead(input) {
  const workspaceId = requireWorkspaceId();
  if (input.customerId && !owned("customers", input.customerId, workspaceId)) {
    throw new Error("Customer does not belong to the active workspace.");
  }
  return raw.createLead({ ...input, workspaceId });
}
export function updateLead(id, updates) {
  const workspaceId = requireWorkspaceId();
  if (!owned("leads", id, workspaceId)) return null;
  if (
    updates.customerId &&
    !owned("customers", updates.customerId, workspaceId)
  ) {
    throw new Error("Customer does not belong to the active workspace.");
  }
  return raw.updateLead(id, updates);
}
export function convertLeadToCustomer(leadId, overrides = {}) {
  const workspaceId = requireWorkspaceId();
  if (!owned("leads", leadId, workspaceId)) return null;
  return raw.convertLeadToCustomer(leadId, overrides, workspaceId);
}
export function transferLeadAttributionToCustomer(leadId, customerId) {
  const workspaceId = requireWorkspaceId();
  if (
    !owned("leads", leadId, workspaceId) ||
    !owned("customers", customerId, workspaceId)
  ) {
    return [];
  }
  return raw.transferLeadAttributionToCustomer(
    leadId,
    customerId,
    workspaceId
  );
}

export function getOrders() {
  return filterOwned("orders", raw.getOrders());
}
export function createOrder(input) {
  const workspaceId = requireWorkspaceId();
  if (!owned("customers", input.customerId, workspaceId)) {
    throw new Error("Customer does not belong to the active workspace.");
  }
  return raw.createOrder({ ...input, workspaceId });
}
export function getCarts() {
  return filterOwned("carts", raw.getCarts());
}
export function createCart(input) {
  const workspaceId = requireWorkspaceId();
  if (input.customerId && !owned("customers", input.customerId, workspaceId)) {
    throw new Error("Customer does not belong to the active workspace.");
  }
  return raw.createCart({ ...input, workspaceId });
}
export function getCustomerEvents(customerId) {
  if (!owned("customers", customerId)) return [];
  return filterOwned("customer_events", raw.getCustomerEvents(customerId));
}
export function createCustomerEvent(input) {
  const workspaceId = requireWorkspaceId();
  if (input.customerId && !owned("customers", input.customerId, workspaceId)) {
    throw new Error("Customer does not belong to the active workspace.");
  }
  return raw.createCustomerEvent({ ...input, workspaceId });
}
export function getCustomer360(customerId) {
  const workspaceId = requireWorkspaceId();
  if (!owned("customers", customerId, workspaceId)) return null;
  const result = raw.getCustomer360(customerId);
  result.orders = filterOwned("orders", result.orders, workspaceId);
  result.carts = filterOwned("carts", result.carts, workspaceId);
  result.events = filterOwned("customer_events", result.events, workspaceId);
  result.executions = filterOwned("executions", result.executions, workspaceId);
  result.attribution = filterOwned(
    "attribution_touchpoints",
    result.attribution,
    workspaceId
  );
  result.summary.ordersCount = result.orders.length;
  result.summary.completedOrders = result.orders.filter(
    (order) => order.status === "completed"
  ).length;
  result.summary.workflowExecutions = result.executions.length;
  result.summary.attributionTouchpoints = result.attribution.length;
  return result;
}
export function getCRMStats() {
  const workspaceId = requireWorkspaceId();
  const count = (table, condition = "1 = 1") =>
    raw.db
      .prepare(
        `SELECT COUNT(*) AS count FROM ${table} WHERE workspace_id = ? AND ${condition}`
      )
      .get(workspaceId).count;
  const onlineRevenue = raw.db
    .prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM orders WHERE workspace_id = ? AND status = 'completed'
    `)
    .get(workspaceId).total;
  return {
    totalCustomers: count("customers"),
    totalLeads: count("leads"),
    hotLeads: count("leads", "score >= 80"),
    completedOrders: count("orders", "status = 'completed'"),
    onlineRevenue,
    abandonedCarts: count("carts", "status = 'abandoned'"),
  };
}

export const getMarketingChannels = raw.getMarketingChannels;
export const getMarketingPlatforms = raw.getMarketingPlatforms;
export const getAdvertisingServices = raw.getAdvertisingServices;
export function getMarketingCampaigns() {
  return filterOwned("marketing_campaigns", raw.getMarketingCampaigns());
}
export function getCampaignById(id) {
  return owned("marketing_campaigns", id) ? raw.getCampaignById(id) : null;
}
export function getCampaignMetrics(campaignId) {
  if (!owned("marketing_campaigns", campaignId)) return [];
  return filterOwned("campaign_metrics", raw.getCampaignMetrics(campaignId));
}
export function createMarketingCampaign(input) {
  return scopedCreate(raw.createMarketingCampaign, input);
}
export function saveCampaignMetric(input) {
  const workspaceId = requireWorkspaceId();
  if (!owned("marketing_campaigns", input.campaignId, workspaceId)) {
    throw new Error("Campaign does not belong to the active workspace.");
  }
  return raw.saveCampaignMetric({ ...input, workspaceId });
}
export function getAttributionTouchpoints(filters = {}) {
  return filterOwned(
    "attribution_touchpoints",
    raw.getAttributionTouchpoints(filters)
  );
}
export function createAttributionTouchpoint(input) {
  const workspaceId = requireWorkspaceId();
  for (const [table, id] of [
    ["customers", input.customerId],
    ["leads", input.leadId],
    ["marketing_campaigns", input.campaignId],
  ]) {
    if (id && !owned(table, id, workspaceId)) {
      throw new Error("Attribution reference crosses workspace boundary.");
    }
  }
  return raw.createAttributionTouchpoint({ ...input, workspaceId });
}
export function attributeOrderToCustomerCampaign(input) {
  const workspaceId = requireWorkspaceId();
  if (!owned("customers", input.customerId, workspaceId)) return null;
  return raw.attributeOrderToCustomerCampaign({ ...input, workspaceId });
}
export function getCampaignAttributedPerformance(campaignId) {
  return owned("marketing_campaigns", campaignId)
    ? raw.getCampaignAttributedPerformance(campaignId)
    : null;
}

