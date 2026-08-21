import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { LEGACY_WORKSPACE_ID } from "./migrations/002_tenant_domain_data.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, "loadder.sqlite");

export const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* =========================================================
   TABLES
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    trigger TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    conditions_json TEXT NOT NULL DEFAULT '[]',
    actions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    event_type TEXT NOT NULL,
    workflow_id TEXT,
    workflow_title TEXT,
    action_type TEXT NOT NULL,
    channel TEXT,
    template TEXT,
    recipient TEXT,
    status TEXT NOT NULL,
    result_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    company TEXT,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    total_spent INTEGER NOT NULL DEFAULT 0,
    orders_count INTEGER NOT NULL DEFAULT 0,
    last_purchase_at TEXT,
    lifetime_value INTEGER NOT NULL DEFAULT 0,
    risk_score REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    company TEXT,
    source TEXT,
    score REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    opportunity_value INTEGER NOT NULL DEFAULT 0,
    customer_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    total_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    source TEXT,
    payment_status TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    total_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    abandoned_at TEXT,
    recovered_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS customer_events (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    type TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS marketing_channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_fa TEXT NOT NULL,
    type TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS marketing_platforms (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    name_fa TEXT NOT NULL,
    provider_key TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES marketing_channels(id)
  );

  CREATE TABLE IF NOT EXISTS advertising_services (
    id TEXT PRIMARY KEY,
    platform_id TEXT NOT NULL,
    name TEXT NOT NULL,
    name_fa TEXT NOT NULL,
    service_type TEXT NOT NULL,
    format TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (platform_id) REFERENCES marketing_platforms(id)
  );

  CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    platform_id TEXT NOT NULL,
    service_id TEXT,
    name TEXT NOT NULL,
    strategy TEXT NOT NULL DEFAULT 'acquisition',
    objective TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    budget INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'IRR',
    external_id TEXT,
    started_at TEXT,
    ended_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES marketing_channels(id),
    FOREIGN KEY (platform_id) REFERENCES marketing_platforms(id),
    FOREIGN KEY (service_id) REFERENCES advertising_services(id)
  );

  CREATE TABLE IF NOT EXISTS campaign_metrics (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,

    spend INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    sessions INTEGER NOT NULL DEFAULT 0,
    leads INTEGER NOT NULL DEFAULT 0,
    orders INTEGER NOT NULL DEFAULT 0,
    customers INTEGER NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    revenue INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS attribution_touchpoints (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    lead_id TEXT,
    campaign_id TEXT,
    channel_id TEXT,
    platform_id TEXT,
    service_id TEXT,

    touch_type TEXT NOT NULL,
    session_id TEXT,
    external_click_id TEXT,

    metadata_json TEXT NOT NULL DEFAULT '{}',

    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL,

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id),
    FOREIGN KEY (channel_id) REFERENCES marketing_channels(id),
    FOREIGN KEY (platform_id) REFERENCES marketing_platforms(id),
    FOREIGN KEY (service_id) REFERENCES advertising_services(id)
  );
`);

/* =========================================================
   HELPERS
========================================================= */

function now() {
  return new Date().toISOString();
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeDivide(a, b) {
  if (!b) return 0;
  return a / b;
}

/* =========================================================
   MAPPERS
========================================================= */

function mapAutomation(row) {
  return {
    id: row.id,
    title: row.title,
    trigger: row.trigger,
    enabled: Boolean(row.enabled),
    delayMinutes: row.delay_minutes,
    conditions: parseJson(row.conditions_json, []),
    actions: parseJson(row.actions_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExecution(row) {
  return {
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
    result: parseJson(row.result_json, {}),
  };
}

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    source: row.source,
    status: row.status,
    totalSpent: row.total_spent,
    ordersCount: row.orders_count,
    lastPurchaseAt: row.last_purchase_at,
    lifetimeValue: row.lifetime_value,
    riskScore: row.risk_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLead(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    source: row.source,
    score: row.score,
    status: row.status,
    opportunityValue: row.opportunity_value,
    customerId: row.customer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    totalAmount: row.total_amount,
    status: row.status,
    source: row.source,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCart(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    totalAmount: row.total_amount,
    status: row.status,
    abandonedAt: row.abandoned_at,
    recoveredAt: row.recovered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCustomerEvent(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.type,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
  };
}

function mapMarketingChannel(row) {
  return {
    id: row.id,
    name: row.name,
    nameFa: row.name_fa,
    type: row.type,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMarketingPlatform(row) {
  return {
    id: row.id,
    channelId: row.channel_id,
    name: row.name,
    nameFa: row.name_fa,
    providerKey: row.provider_key,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAdvertisingService(row) {
  return {
    id: row.id,
    platformId: row.platform_id,
    name: row.name,
    nameFa: row.name_fa,
    serviceType: row.service_type,
    format: row.format,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMarketingCampaign(row) {
  return {
    id: row.id,
    channelId: row.channel_id,
    platformId: row.platform_id,
    serviceId: row.service_id,
    name: row.name,
    strategy: row.strategy,
    objective: row.objective,
    status: row.status,
    budget: row.budget,
    currency: row.currency,
    externalId: row.external_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCampaignMetric(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    metricDate: row.metric_date,
    spend: row.spend,
    impressions: row.impressions,
    views: row.views,
    clicks: row.clicks,
    sessions: row.sessions,
    leads: row.leads,
    orders: row.orders,
    customers: row.customers,
    conversions: row.conversions,
    revenue: row.revenue,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttributionTouchpoint(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    leadId: row.lead_id,
    campaignId: row.campaign_id,
    channelId: row.channel_id,
    platformId: row.platform_id,
    serviceId: row.service_id,
    touchType: row.touch_type,
    sessionId: row.session_id,
    externalClickId: row.external_click_id,
    metadata: parseJson(row.metadata_json, {}),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

/* =========================================================
   AUTOMATIONS
========================================================= */

export function getAutomations() {
  return db
    .prepare(`
      SELECT *
      FROM automations
      ORDER BY created_at DESC
    `)
    .all()
    .map(mapAutomation);
}

export function getAutomationById(id) {
  const row = db
    .prepare(`
      SELECT *
      FROM automations
      WHERE id = ?
    `)
    .get(id);

  return row ? mapAutomation(row) : null;
}

export function createAutomation({
  workspaceId = LEGACY_WORKSPACE_ID,
  id = crypto.randomUUID(),
  title,
  trigger,
  enabled = true,
  delayMinutes = 0,
  conditions = [],
  actions = [],
}) {
  const timestamp = now();

  db.prepare(`
    INSERT INTO automations (
      id,
      workspace_id,
      title,
      trigger,
      enabled,
      delay_minutes,
      conditions_json,
      actions_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    title,
    trigger,
    enabled ? 1 : 0,
    Number(delayMinutes) || 0,
    JSON.stringify(conditions),
    JSON.stringify(actions),
    timestamp,
    timestamp
  );

  return getAutomationById(id);
}

export function updateAutomation(id, updates) {
  const current = getAutomationById(id);
  if (!current) return null;

  const next = {
    ...current,
    ...updates,
  };

  db.prepare(`
    UPDATE automations
    SET
      title = ?,
      trigger = ?,
      enabled = ?,
      delay_minutes = ?,
      conditions_json = ?,
      actions_json = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    next.title,
    next.trigger,
    next.enabled ? 1 : 0,
    Number(next.delayMinutes) || 0,
    JSON.stringify(next.conditions ?? []),
    JSON.stringify(next.actions ?? []),
    now(),
    id
  );

  return getAutomationById(id);
}

export function deleteAutomation(id) {
  const result = db
    .prepare(`
      DELETE FROM automations
      WHERE id = ?
    `)
    .run(id);

  return result.changes > 0;
}

export function automationCount() {
  return db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM automations
    `)
    .get().count;
}

export function seedDefaultAutomations(automations) {
  if (automationCount() > 0) return;

  db.transaction(() => {
    for (const automation of automations) {
      createAutomation(automation);
    }
  })();
}

/* =========================================================
   EVENTS + EXECUTIONS
========================================================= */

export function saveEvent(event) {
  db.prepare(`
    INSERT INTO events (
      id,
      workspace_id,
      type,
      payload_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.workspaceId || LEGACY_WORKSPACE_ID,
    event.type,
    JSON.stringify(event.payload ?? {}),
    event.createdAt
  );

  return event;
}

export function saveExecution(execution) {
  db.prepare(`
    INSERT INTO executions (
      id,
      workspace_id,
      event_id,
      event_type,
      workflow_id,
      workflow_title,
      action_type,
      channel,
      template,
      recipient,
      status,
      result_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    execution.id,
    execution.workspaceId || LEGACY_WORKSPACE_ID,
    execution.eventId ?? null,
    execution.eventType,
    execution.workflowId ?? null,
    execution.workflowTitle ?? null,
    execution.actionType,
    execution.channel ?? null,
    execution.template ?? null,
    execution.recipient ?? null,
    execution.status,
    JSON.stringify(execution.result ?? {}),
    execution.timestamp
  );

  return execution;
}

export function getExecutions(limit = 100) {
  return db
    .prepare(`
      SELECT *
      FROM executions
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(limit)
    .map(mapExecution);
}

export function getExecutionsByCustomerId(customerId) {
  const rows = db
    .prepare(`
      SELECT
        executions.*,
        events.payload_json AS event_payload_json
      FROM executions
      LEFT JOIN events
        ON events.id = executions.event_id
      ORDER BY executions.created_at DESC
    `)
    .all();

  return rows
    .filter((row) => {
      const payload = parseJson(row.event_payload_json, {});
      return payload.customerId === customerId;
    })
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
      result: parseJson(row.result_json, {}),
    }));
}

export function clearExecutions() {
  db.prepare(`
    DELETE FROM executions
  `).run();
}

/* =========================================================
   CUSTOMERS
========================================================= */

export function getCustomers() {
  return db
    .prepare(`
      SELECT *
      FROM customers
      ORDER BY created_at DESC
    `)
    .all()
    .map(mapCustomer);
}

export function getCustomerById(id) {
  const row = db
    .prepare(`
      SELECT *
      FROM customers
      WHERE id = ?
    `)
    .get(id);

  return row ? mapCustomer(row) : null;
}

export function createCustomer({
  workspaceId = LEGACY_WORKSPACE_ID,
  id = crypto.randomUUID(),
  name,
  phone = null,
  email = null,
  company = null,
  source = null,
  status = "active",
  totalSpent = 0,
  ordersCount = 0,
  lastPurchaseAt = null,
  lifetimeValue = 0,
  riskScore = 0,
}) {
  const timestamp = now();

  db.prepare(`
    INSERT INTO customers (
      id,
      workspace_id,
      name,
      phone,
      email,
      company,
      source,
      status,
      total_spent,
      orders_count,
      last_purchase_at,
      lifetime_value,
      risk_score,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    name,
    phone,
    email,
    company,
    source,
    status,
    Number(totalSpent) || 0,
    Number(ordersCount) || 0,
    lastPurchaseAt,
    Number(lifetimeValue) || 0,
    Number(riskScore) || 0,
    timestamp,
    timestamp
  );

  return getCustomerById(id);
}

/* =========================================================
   LEADS
========================================================= */

export function getLeads() {
  return db
    .prepare(`
      SELECT *
      FROM leads
      ORDER BY score DESC, created_at DESC
    `)
    .all()
    .map(mapLead);
}

export function getLeadById(id) {
  const row = db
    .prepare(`
      SELECT *
      FROM leads
      WHERE id = ?
    `)
    .get(id);

  return row ? mapLead(row) : null;
}

export function createLead({
  workspaceId = LEGACY_WORKSPACE_ID,
  id = crypto.randomUUID(),
  name,
  phone = null,
  email = null,
  company = null,
  source = null,
  score = 0,
  status = "new",
  opportunityValue = 0,
  customerId = null,
}) {
  const timestamp = now();

  db.prepare(`
    INSERT INTO leads (
      id,
      workspace_id,
      name,
      phone,
      email,
      company,
      source,
      score,
      status,
      opportunity_value,
      customer_id,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    name,
    phone,
    email,
    company,
    source,
    Number(score) || 0,
    status,
    Number(opportunityValue) || 0,
    customerId,
    timestamp,
    timestamp
  );

  return getLeadById(id);
}

export function updateLead(id, updates = {}) {
  const current = getLeadById(id);
  if (!current) return null;

  const next = {
    ...current,
    ...updates,
  };

  db.prepare(`
    UPDATE leads
    SET
      name = ?,
      phone = ?,
      email = ?,
      company = ?,
      source = ?,
      score = ?,
      status = ?,
      opportunity_value = ?,
      customer_id = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    next.name,
    next.phone ?? null,
    next.email ?? null,
    next.company ?? null,
    next.source ?? null,
    Number(next.score) || 0,
    next.status || "new",
    Number(next.opportunityValue) || 0,
    next.customerId ?? null,
    now(),
    id
  );

  return getLeadById(id);
}

export function convertLeadToCustomer(
  leadId,
  overrides = {},
  workspaceId = LEGACY_WORKSPACE_ID
) {
  const lead = getLeadById(leadId);

  if (!lead) return null;

  if (lead.customerId) {
    return {
      lead,
      customer: getCustomerById(lead.customerId),
      alreadyConverted: true,
    };
  }

  const customer = createCustomer({
    workspaceId,
    name: overrides.name ?? lead.name,
    phone: overrides.phone ?? lead.phone,
    email: overrides.email ?? lead.email,
    company: overrides.company ?? lead.company,
    source: overrides.source ?? lead.source,
    status: overrides.status ?? "active",
    lifetimeValue: Number(overrides.lifetimeValue) || 0,
    riskScore: Number(overrides.riskScore) || 0,
  });

  const updatedLead = updateLead(leadId, {
    customerId: customer.id,
    status: "converted",
  });

  return {
    lead: updatedLead,
    customer,
    alreadyConverted: false,
  };
}

/* =========================================================
   ORDERS
========================================================= */

export function getOrders() {
  return db
    .prepare(`
      SELECT *
      FROM orders
      ORDER BY created_at DESC
    `)
    .all()
    .map(mapOrder);
}

export function getOrdersByCustomerId(customerId) {
  return db
    .prepare(`
      SELECT *
      FROM orders
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `)
    .all(customerId)
    .map(mapOrder);
}

export function createOrder({
  workspaceId = LEGACY_WORKSPACE_ID,
  id = crypto.randomUUID(),
  customerId,
  totalAmount,
  status = "completed",
  source = "website",
  paymentStatus = "paid",
}) {
  const timestamp = now();

  db.prepare(`
    INSERT INTO orders (
      id,
      workspace_id,
      customer_id,
      total_amount,
      status,
      source,
      payment_status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    customerId,
    Number(totalAmount) || 0,
    status,
    source,
    paymentStatus,
    timestamp,
    timestamp
  );

  const row = db
    .prepare(`
      SELECT *
      FROM orders
      WHERE id = ?
    `)
    .get(id);

  return row ? mapOrder(row) : null;
}

/* =========================================================
   CARTS
========================================================= */

export function getCarts() {
  return db
    .prepare(`
      SELECT *
      FROM carts
      ORDER BY created_at DESC
    `)
    .all()
    .map(mapCart);
}

export function getCartsByCustomerId(customerId) {
  return db
    .prepare(`
      SELECT *
      FROM carts
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `)
    .all(customerId)
    .map(mapCart);
}

export function createCart({
  workspaceId = LEGACY_WORKSPACE_ID,
  id = crypto.randomUUID(),
  customerId = null,
  totalAmount = 0,
  status = "active",
  abandonedAt = null,
  recoveredAt = null,
}) {
  const timestamp = now();

  db.prepare(`
    INSERT INTO carts (
      id,
      workspace_id,
      customer_id,
      total_amount,
      status,
      abandoned_at,
      recovered_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    customerId,
    Number(totalAmount) || 0,
    status,
    abandonedAt,
    recoveredAt,
    timestamp,
    timestamp
  );

  const row = db
    .prepare(`
      SELECT *
      FROM carts
      WHERE id = ?
    `)
    .get(id);

  return row ? mapCart(row) : null;
}

/* =========================================================
   CUSTOMER EVENTS
========================================================= */

export function getCustomerEvents(customerId) {
  return db
    .prepare(`
      SELECT *
      FROM customer_events
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `)
    .all(customerId)
    .map(mapCustomerEvent);
}

export function createCustomerEvent({
  workspaceId = LEGACY_WORKSPACE_ID,
  id = crypto.randomUUID(),
  customerId = null,
  type,
  metadata = {},
}) {
  const timestamp = now();

  db.prepare(`
    INSERT INTO customer_events (
      id,
      workspace_id,
      customer_id,
      type,
      metadata_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    customerId,
    type,
    JSON.stringify(metadata),
    timestamp
  );

  return {
    id,
    customerId,
    type,
    metadata,
    createdAt: timestamp,
  };
}

/* =========================================================
   CUSTOMER 360
========================================================= */

export function getCustomer360(customerId) {
  const customer = getCustomerById(customerId);

  if (!customer) return null;

  const orders = getOrdersByCustomerId(customerId);
  const carts = getCartsByCustomerId(customerId);
  const events = getCustomerEvents(customerId);
  const executions = getExecutionsByCustomerId(customerId);
  const attribution = getAttributionTouchpoints({
    customerId,
  });

  const completedOrders = orders.filter(
    (order) => order.status === "completed"
  );

  const totalRevenue = completedOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const abandonedCarts = carts.filter(
    (cart) => cart.status === "abandoned"
  );

  const activeCarts = carts.filter(
    (cart) => cart.status === "active"
  );

  return {
    customer,

    summary: {
      ordersCount: orders.length,
      completedOrders: completedOrders.length,
      totalRevenue,
      abandonedCarts: abandonedCarts.length,
      activeCarts: activeCarts.length,
      lifetimeValue: customer.lifetimeValue,
      riskScore: customer.riskScore,
      workflowExecutions: executions.length,
      attributionTouchpoints: attribution.length,
    },

    orders,
    carts,
    events,
    executions,
    attribution,
  };
}

/* =========================================================
   CRM STATS
========================================================= */

export function getCRMStats() {
  const totalCustomers = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM customers
    `)
    .get().count;

  const totalLeads = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM leads
    `)
    .get().count;

  const hotLeads = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM leads
      WHERE score >= 80
    `)
    .get().count;

  const completedOrders = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM orders
      WHERE status = 'completed'
    `)
    .get().count;

  const onlineRevenue = db
    .prepare(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total
      FROM orders
      WHERE status = 'completed'
    `)
    .get().total;

  const abandonedCarts = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM carts
      WHERE status = 'abandoned'
    `)
    .get().count;

  return {
    totalCustomers,
    totalLeads,
    hotLeads,
    completedOrders,
    onlineRevenue,
    abandonedCarts,
  };
}

/* =========================================================
   MARKETING READ
========================================================= */

export function getMarketingChannels() {
  return db
    .prepare(`
      SELECT *
      FROM marketing_channels
      ORDER BY name_fa
    `)
    .all()
    .map(mapMarketingChannel);
}

export function getMarketingPlatforms(channelId = null) {
  if (channelId) {
    return db
      .prepare(`
        SELECT *
        FROM marketing_platforms
        WHERE channel_id = ?
        ORDER BY name_fa
      `)
      .all(channelId)
      .map(mapMarketingPlatform);
  }

  return db
    .prepare(`
      SELECT *
      FROM marketing_platforms
      ORDER BY name_fa
    `)
    .all()
    .map(mapMarketingPlatform);
}

export function getAdvertisingServices(platformId = null) {
  if (platformId) {
    return db
      .prepare(`
        SELECT *
        FROM advertising_services
        WHERE platform_id = ?
        ORDER BY name_fa
      `)
      .all(platformId)
      .map(mapAdvertisingService);
  }

  return db
    .prepare(`
      SELECT *
      FROM advertising_services
      ORDER BY name_fa
    `)
    .all()
    .map(mapAdvertisingService);
}

export function getMarketingCampaigns() {
  return db
    .prepare(`
      SELECT *
      FROM marketing_campaigns
      ORDER BY created_at DESC
    `)
    .all()
    .map(mapMarketingCampaign);
}

export function getCampaignById(id) {
  const row = db
    .prepare(`
      SELECT *
      FROM marketing_campaigns
      WHERE id = ?
    `)
    .get(id);

  return row ? mapMarketingCampaign(row) : null;
}

export function getCampaignMetrics(campaignId) {
  return db
    .prepare(`
      SELECT *
      FROM campaign_metrics
      WHERE campaign_id = ?
      ORDER BY metric_date DESC
    `)
    .all(campaignId)
    .map(mapCampaignMetric);
}

export function getAttributionTouchpoints({
  customerId = null,
  leadId = null,
  campaignId = null,
} = {}) {
  let sql = `
    SELECT *
    FROM attribution_touchpoints
    WHERE 1 = 1
  `;

  const params = [];

  if (customerId) {
    sql += ` AND customer_id = ?`;
    params.push(customerId);
  }

  if (leadId) {
    sql += ` AND lead_id = ?`;
    params.push(leadId);
  }

  if (campaignId) {
    sql += ` AND campaign_id = ?`;
    params.push(campaignId);
  }

  sql += ` ORDER BY occurred_at DESC`;

  return db
    .prepare(sql)
    .all(...params)
    .map(mapAttributionTouchpoint);
}

/* =========================================================
   MARKETING WRITE
========================================================= */

export function createMarketingCampaign({
  workspaceId = LEGACY_WORKSPACE_ID,
  id = crypto.randomUUID(),
  channelId,
  platformId,
  serviceId = null,
  name,
  strategy = "acquisition",
  objective = null,
  status = "draft",
  budget = 0,
  currency = "IRR",
  externalId = null,
  startedAt = null,
  endedAt = null,
}) {
  const timestamp = now();

  db.prepare(`
    INSERT INTO marketing_campaigns (
      id,
      workspace_id,
      channel_id,
      platform_id,
      service_id,
      name,
      strategy,
      objective,
      status,
      budget,
      currency,
      external_id,
      started_at,
      ended_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    channelId,
    platformId,
    serviceId,
    name,
    strategy,
    objective,
    status,
    Number(budget) || 0,
    currency,
    externalId,
    startedAt,
    endedAt,
    timestamp,
    timestamp
  );

  return getCampaignById(id);
}

export function saveCampaignMetric({
  workspaceId = LEGACY_WORKSPACE_ID,
  id = crypto.randomUUID(),
  campaignId,
  metricDate = new Date().toISOString().slice(0, 10),
  spend = 0,
  impressions = 0,
  views = 0,
  clicks = 0,
  sessions = 0,
  leads = 0,
  orders = 0,
  customers = 0,
  conversions = 0,
  revenue = 0,
}) {
  const timestamp = now();

  db.prepare(`
    INSERT INTO campaign_metrics (
      id,
      workspace_id,
      campaign_id,
      metric_date,
      spend,
      impressions,
      views,
      clicks,
      sessions,
      leads,
      orders,
      customers,
      conversions,
      revenue,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    campaignId,
    metricDate,
    Number(spend) || 0,
    Number(impressions) || 0,
    Number(views) || 0,
    Number(clicks) || 0,
    Number(sessions) || 0,
    Number(leads) || 0,
    Number(orders) || 0,
    Number(customers) || 0,
    Number(conversions) || 0,
    Number(revenue) || 0,
    timestamp,
    timestamp
  );

  const row = db
    .prepare(`
      SELECT *
      FROM campaign_metrics
      WHERE id = ?
    `)
    .get(id);

  return row ? mapCampaignMetric(row) : null;
}

export function createAttributionTouchpoint({
  id = crypto.randomUUID(),
  workspaceId = LEGACY_WORKSPACE_ID,

  customerId = null,
  leadId = null,

  campaignId = null,
  channelId = null,
  platformId = null,
  serviceId = null,

  touchType,

  sessionId = null,
  externalClickId = null,

  metadata = {},

  occurredAt = now(),
}) {
  const createdAt = now();

  db.prepare(`
    INSERT INTO attribution_touchpoints (
      id,
      workspace_id,
      customer_id,
      lead_id,
      campaign_id,
      channel_id,
      platform_id,
      service_id,
      touch_type,
      session_id,
      external_click_id,
      metadata_json,
      occurred_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    customerId,
    leadId,
    campaignId,
    channelId,
    platformId,
    serviceId,
    touchType,
    sessionId,
    externalClickId,
    JSON.stringify(metadata),
    occurredAt,
    createdAt
  );

  const row = db
    .prepare(`
      SELECT *
      FROM attribution_touchpoints
      WHERE id = ?
    `)
    .get(id);

  return row ? mapAttributionTouchpoint(row) : null;
}

export function transferLeadAttributionToCustomer(
  leadId,
  customerId,
  workspaceId = LEGACY_WORKSPACE_ID
) {
  const touchpoints = getAttributionTouchpoints({
    leadId,
  });

  const created = [];

  for (const touchpoint of touchpoints) {
    if (touchpoint.touchType === "lead_converted") {
      continue;
    }

    const cloned = createAttributionTouchpoint({
      workspaceId,
      customerId,
      leadId,

      campaignId: touchpoint.campaignId,
      channelId: touchpoint.channelId,
      platformId: touchpoint.platformId,
      serviceId: touchpoint.serviceId,

      touchType: "lead_converted",

      sessionId: touchpoint.sessionId,
      externalClickId: touchpoint.externalClickId,

      metadata: {
        ...touchpoint.metadata,
        sourceTouchpointId: touchpoint.id,
        convertedFromLeadId: leadId,
      },

      occurredAt: now(),
    });

    created.push(cloned);
  }

  return created;
}

/* =========================================================
   KPI ENGINE
========================================================= */

export function calculateCampaignKPIs(metrics) {
  const totals = metrics.reduce(
    (acc, item) => {
      acc.spend += item.spend;
      acc.impressions += item.impressions;
      acc.views += item.views;
      acc.clicks += item.clicks;
      acc.sessions += item.sessions;
      acc.leads += item.leads;
      acc.orders += item.orders;
      acc.customers += item.customers;
      acc.conversions += item.conversions;
      acc.revenue += item.revenue;

      return acc;
    },
    {
      spend: 0,
      impressions: 0,
      views: 0,
      clicks: 0,
      sessions: 0,
      leads: 0,
      orders: 0,
      customers: 0,
      conversions: 0,
      revenue: 0,
    }
  );

  return {
    ...totals,

    cpm:
      safeDivide(
        totals.spend,
        totals.impressions
      ) * 1000,

    cpv:
      safeDivide(
        totals.spend,
        totals.views
      ),

    cpc:
      safeDivide(
        totals.spend,
        totals.clicks
      ),

    // CPS = Cost Per Session
    cps:
      safeDivide(
        totals.spend,
        totals.sessions
      ),

    cpl:
      safeDivide(
        totals.spend,
        totals.leads
      ),

    cpo:
      safeDivide(
        totals.spend,
        totals.orders
      ),

    cac:
      safeDivide(
        totals.spend,
        totals.customers
      ),

    cpa:
      safeDivide(
        totals.spend,
        totals.conversions
      ),

    ctr:
      safeDivide(
        totals.clicks,
        totals.impressions
      ) * 100,

    viewRate:
      safeDivide(
        totals.views,
        totals.impressions
      ) * 100,

    sessionRate:
      safeDivide(
        totals.sessions,
        totals.clicks
      ) * 100,

    leadRate:
      safeDivide(
        totals.leads,
        totals.sessions
      ) * 100,

    orderRate:
      safeDivide(
        totals.orders,
        totals.leads
      ) * 100,

    customerRate:
      safeDivide(
        totals.customers,
        totals.orders
      ) * 100,

    conversionRate:
      safeDivide(
        totals.conversions,
        totals.clicks
      ) * 100,

    roas:
      safeDivide(
        totals.revenue,
        totals.spend
      ),
  };
}

/* =========================================================
   SEED CRM / ECOMMERCE
========================================================= */

export function seedCRMData() {
  const customerCount = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM customers
    `)
    .get().count;

  if (customerCount > 0) return;

  db.transaction(() => {
    createCustomer({
      id: "customer-001",
      name: "مریم احمدی",
      phone: "09121111111",
      email: "maryam@example.com",
      company: "کلینیک ویستا",
      source: "website",
      totalSpent: 9200000,
      ordersCount: 3,
      lifetimeValue: 12500000,
      riskScore: 12,
      lastPurchaseAt: now(),
    });

    createCustomer({
      id: "customer-002",
      name: "رضا مرادی",
      phone: "09122222222",
      email: "reza@example.com",
      company: "مدیا پلاس",
      source: "referral",
      totalSpent: 23500000,
      ordersCount: 6,
      lifetimeValue: 31000000,
      riskScore: 7,
      lastPurchaseAt: now(),
    });

    createLead({
      id: "lead-001",
      name: "علی رضایی",
      phone: "09123333333",
      company: "فروشگاه آریا",
      source: "google_ads",
      score: 92,
      status: "hot",
      opportunityValue: 18000000,
    });

    createLead({
      id: "lead-002",
      name: "سارا کریمی",
      phone: "09124444444",
      company: "استودیو هشت",
      source: "instagram",
      score: 84,
      status: "qualified",
      opportunityValue: 12000000,
    });

    createOrder({
      id: "order-001",
      customerId: "customer-001",
      totalAmount: 3200000,
      status: "completed",
      source: "website",
      paymentStatus: "paid",
    });

    createOrder({
      id: "order-002",
      customerId: "customer-002",
      totalAmount: 5100000,
      status: "completed",
      source: "website",
      paymentStatus: "paid",
    });

    createCart({
      id: "cart-001",
      customerId: "customer-001",
      totalAmount: 4500000,
      status: "abandoned",
      abandonedAt: now(),
    });

    createCart({
      id: "cart-002",
      customerId: "customer-002",
      totalAmount: 2800000,
      status: "active",
    });

    createCustomerEvent({
      customerId: "customer-001",
      type: "order.completed",
      metadata: {
        orderId: "order-001",
        amount: 3200000,
      },
    });

    createCustomerEvent({
      customerId: "customer-001",
      type: "cart.abandoned",
      metadata: {
        cartId: "cart-001",
        amount: 4500000,
      },
    });
  })();
}

/* =========================================================
   MARKETING SEED
========================================================= */

export function seedMarketingData() {
  const existing = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM marketing_channels
    `)
    .get().count;

  if (existing > 0) return;

  const timestamp = now();

  const insertChannel = db.prepare(`
    INSERT INTO marketing_channels (
      id,
      name,
      name_fa,
      type,
      enabled,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `);

  const insertPlatform = db.prepare(`
    INSERT INTO marketing_platforms (
      id,
      channel_id,
      name,
      name_fa,
      provider_key,
      enabled,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const insertService = db.prepare(`
    INSERT INTO advertising_services (
      id,
      platform_id,
      name,
      name_fa,
      service_type,
      format,
      enabled,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  db.transaction(() => {
    insertChannel.run(
      "google_ads",
      "Google Ads",
      "گوگل ادز",
      "paid_search",
      timestamp,
      timestamp
    );

    insertChannel.run(
      "iranian_ads",
      "Iranian Ads",
      "تبلیغات ایران",
      "ad_network",
      timestamp,
      timestamp
    );

    insertChannel.run(
      "social_ads",
      "Social Ads",
      "تبلیغات شبکه‌های اجتماعی",
      "social",
      timestamp,
      timestamp
    );

    insertChannel.run(
      "app_ads",
      "App Ads",
      "تبلیغات اپلیکیشن",
      "app",
      timestamp,
      timestamp
    );

    insertChannel.run(
      "sms_marketing",
      "SMS Marketing",
      "اس‌ام‌اس مارکتینگ",
      "direct",
      timestamp,
      timestamp
    );

    insertChannel.run(
      "affiliate",
      "Affiliate",
      "افیلیت مارکتینگ",
      "affiliate",
      timestamp,
      timestamp
    );

    insertPlatform.run(
      "google",
      "google_ads",
      "Google",
      "گوگل",
      "google_ads",
      timestamp,
      timestamp
    );

    insertPlatform.run(
      "taavous",
      "iranian_ads",
      "Taavous",
      "طاووس",
      "taavous",
      timestamp,
      timestamp
    );

    insertPlatform.run(
      "yektanet",
      "iranian_ads",
      "Yektanet",
      "یکتانت",
      "yektanet",
      timestamp,
      timestamp
    );

    insertPlatform.run(
      "tapsell",
      "iranian_ads",
      "Tapsell",
      "تپسل",
      "tapsell",
      timestamp,
      timestamp
    );

    insertPlatform.run(
      "instagram",
      "social_ads",
      "Instagram",
      "اینستاگرام",
      "instagram",
      timestamp,
      timestamp
    );

    insertPlatform.run(
      "meta",
      "social_ads",
      "Meta",
      "متا",
      "meta",
      timestamp,
      timestamp
    );

    insertPlatform.run(
      "smsir",
      "sms_marketing",
      "SMS.ir",
      "اس‌ام‌اس دات آی‌آر",
      "smsir",
      timestamp,
      timestamp
    );

    insertPlatform.run(
      "affiliate-network",
      "affiliate",
      "Affiliate Network",
      "شبکه افیلیت",
      "affiliate",
      timestamp,
      timestamp
    );

    insertService.run(
      "google-search",
      "google",
      "Search",
      "جستجو",
      "search",
      "text",
      timestamp,
      timestamp
    );

    insertService.run(
      "google-display",
      "google",
      "Display",
      "بنری",
      "display",
      "banner",
      timestamp,
      timestamp
    );

    insertService.run(
      "google-video",
      "google",
      "Video",
      "ویدئویی",
      "video",
      "video",
      timestamp,
      timestamp
    );

    insertService.run(
      "google-shopping",
      "google",
      "Shopping",
      "شاپینگ",
      "shopping",
      "product",
      timestamp,
      timestamp
    );

    insertService.run(
      "google-performance-max",
      "google",
      "Performance Max",
      "پرفورمنس مکس",
      "performance_max",
      "mixed",
      timestamp,
      timestamp
    );

    insertService.run(
      "google-app",
      "google",
      "App Campaign",
      "کمپین اپلیکیشن",
      "app_install",
      "app",
      timestamp,
      timestamp
    );

    insertService.run(
      "taavous-native",
      "taavous",
      "Native",
      "نیتیو",
      "native",
      "native",
      timestamp,
      timestamp
    );

    insertService.run(
      "taavous-banner",
      "taavous",
      "Banner",
      "بنری",
      "display",
      "banner",
      timestamp,
      timestamp
    );

    insertService.run(
      "taavous-video",
      "taavous",
      "Video",
      "ویدئویی",
      "video",
      "video",
      timestamp,
      timestamp
    );

    insertService.run(
      "yektanet-native",
      "yektanet",
      "Native",
      "نیتیو",
      "native",
      "native",
      timestamp,
      timestamp
    );

    insertService.run(
      "yektanet-banner",
      "yektanet",
      "Banner",
      "بنری",
      "display",
      "banner",
      timestamp,
      timestamp
    );

    insertService.run(
      "yektanet-push",
      "yektanet",
      "Push",
      "پوش",
      "push",
      "push",
      timestamp,
      timestamp
    );

    insertService.run(
      "tapsell-preroll",
      "tapsell",
      "Pre-roll",
      "پری‌رول",
      "video",
      "preroll",
      timestamp,
      timestamp
    );

    insertService.run(
      "tapsell-app-install",
      "tapsell",
      "App Install",
      "نصب اپلیکیشن",
      "app_install",
      "app",
      timestamp,
      timestamp
    );

    insertService.run(
      "tapsell-banner",
      "tapsell",
      "Banner",
      "بنری",
      "display",
      "banner",
      timestamp,
      timestamp
    );

    insertService.run(
      "instagram-feed",
      "instagram",
      "Feed Ads",
      "تبلیغات فید",
      "social",
      "feed",
      timestamp,
      timestamp
    );

    insertService.run(
      "instagram-story",
      "instagram",
      "Story Ads",
      "تبلیغات استوری",
      "social",
      "story",
      timestamp,
      timestamp
    );

    insertService.run(
      "instagram-reels",
      "instagram",
      "Reels Ads",
      "تبلیغات ریلز",
      "video",
      "reels",
      timestamp,
      timestamp
    );

    insertService.run(
      "instagram-lead",
      "instagram",
      "Lead Ads",
      "تبلیغات لید",
      "lead_generation",
      "lead_form",
      timestamp,
      timestamp
    );

    insertService.run(
      "sms-bulk",
      "smsir",
      "Bulk SMS",
      "پیامک انبوه",
      "sms",
      "bulk",
      timestamp,
      timestamp
    );

    insertService.run(
      "sms-segmented",
      "smsir",
      "Segmented SMS",
      "پیامک سگمنت‌شده",
      "sms",
      "segmented",
      timestamp,
      timestamp
    );

    insertService.run(
      "sms-triggered",
      "smsir",
      "Triggered SMS",
      "پیامک اتوماتیک",
      "sms",
      "triggered",
      timestamp,
      timestamp
    );

    insertService.run(
      "affiliate-publisher",
      "affiliate-network",
      "Publisher",
      "ناشر",
      "affiliate",
      "publisher",
      timestamp,
      timestamp
    );

    insertService.run(
      "affiliate-influencer",
      "affiliate-network",
      "Influencer",
      "اینفلوئنسر",
      "affiliate",
      "influencer",
      timestamp,
      timestamp
    );

    insertService.run(
      "affiliate-referral",
      "affiliate-network",
      "Referral Partner",
      "همکار فروش",
      "affiliate",
      "referral",
      timestamp,
      timestamp
    );
  })();
}
/* =========================================================
   ORDER + REVENUE ATTRIBUTION
========================================================= */

export function attributeOrderToCustomerCampaign({
  workspaceId = LEGACY_WORKSPACE_ID,
  customerId,
  orderId,
  revenue = 0,
}) {
  const customerTouchpoints =
    getAttributionTouchpoints({
      customerId,
    });

  if (
    customerTouchpoints.length === 0
  ) {
    return {
      attributed: false,
      reason:
        "customer_has_no_marketing_attribution",
      touchpoint: null,
    };
  }

  /*
   * فعلاً مدل Attribution:
   * Last Marketing Touch
   *
   * چون getAttributionTouchpoints بر اساس
   * occurred_at DESC مرتب می‌شود،
   * اولین Touchpoint جدیدترین Touch است.
   *
   * بعداً First Touch / Linear /
   * Position Based / Data Driven
   * را اضافه می‌کنیم.
   */

  const sourceTouchpoint =
    customerTouchpoints.find(
      (touchpoint) =>
        touchpoint.campaignId
    );

  if (!sourceTouchpoint) {
    return {
      attributed: false,
      reason:
        "customer_has_no_campaign_attribution",
      touchpoint: null,
    };
  }

  const touchpoint =
    createAttributionTouchpoint({
      workspaceId,
      customerId,

      leadId:
        sourceTouchpoint.leadId,

      campaignId:
        sourceTouchpoint.campaignId,

      channelId:
        sourceTouchpoint.channelId,

      platformId:
        sourceTouchpoint.platformId,

      serviceId:
        sourceTouchpoint.serviceId,

      touchType:
        "order_completed",

      sessionId:
        sourceTouchpoint.sessionId,

      externalClickId:
        sourceTouchpoint.externalClickId,

      metadata: {
        orderId,

        revenue:
          Number(revenue) || 0,

        attributionModel:
          "last_marketing_touch",

        sourceTouchpointId:
          sourceTouchpoint.id,
      },

      occurredAt:
        now(),
    });

  return {
    attributed: true,

    campaignId:
      sourceTouchpoint.campaignId,

    touchpoint,
  };
}

/* =========================================================
   ATTRIBUTED CAMPAIGN PERFORMANCE
========================================================= */

export function getCampaignAttributedPerformance(
  campaignId
) {
  const touchpoints =
    getAttributionTouchpoints({
      campaignId,
    });

  const leadIds =
    new Set();

  const customerIds =
    new Set();

  const orderIds =
    new Set();

  let attributedRevenue = 0;

  for (
    const touchpoint
    of touchpoints
  ) {
    if (
      touchpoint.leadId
    ) {
      leadIds.add(
        touchpoint.leadId
      );
    }

    if (
      touchpoint.customerId
    ) {
      customerIds.add(
        touchpoint.customerId
      );
    }

    if (
      touchpoint.touchType ===
      "order_completed"
    ) {
      const orderId =
        touchpoint.metadata
          ?.orderId;

      if (
        orderId &&
        !orderIds.has(orderId)
      ) {
        orderIds.add(
          orderId
        );

        attributedRevenue +=
          Number(
            touchpoint.metadata
              ?.revenue
          ) || 0;
      }
    }
  }

  const metrics =
    getCampaignMetrics(
      campaignId
    );

  const providerKPIs =
    calculateCampaignKPIs(
      metrics
    );

  return {
    campaignId,

    attributionModel:
      "last_marketing_touch",

    attributed: {
      leads:
        leadIds.size,

      customers:
        customerIds.size,

      orders:
        orderIds.size,

      revenue:
        attributedRevenue,
    },

    media: {
      spend:
        providerKPIs.spend,

      impressions:
        providerKPIs.impressions,

      views:
        providerKPIs.views,

      clicks:
        providerKPIs.clicks,

      sessions:
        providerKPIs.sessions,
    },

    kpis: {
      cpm:
        providerKPIs.cpm,

      cpv:
        providerKPIs.cpv,

      cpc:
        providerKPIs.cpc,

      cps:
        providerKPIs.cps,

      cpl:
        leadIds.size > 0
          ? providerKPIs.spend /
            leadIds.size
          : 0,

      cpo:
        orderIds.size > 0
          ? providerKPIs.spend /
            orderIds.size
          : 0,

      cac:
        customerIds.size > 0
          ? providerKPIs.spend /
            customerIds.size
          : 0,

      roas:
        providerKPIs.spend > 0
          ? attributedRevenue /
            providerKPIs.spend
          : 0,
    },
  };
}
export default db;
