import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databasePath = path.join(__dirname, "loadder.sqlite");

const db = new Database(databasePath);

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
      title,
      trigger,
      enabled,
      delay_minutes,
      conditions_json,
      actions_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
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

  if (!current) {
    return null;
  }

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
  if (automationCount() > 0) {
    return;
  }

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
      type,
      payload_json,
      created_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    event.id,
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    execution.id,
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
      const payload = parseJson(
        row.event_payload_json,
        {}
      );

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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    phone,
    email,
    company,
    source,
    status,
    totalSpent,
    ordersCount,
    lastPurchaseAt,
    lifetimeValue,
    riskScore,
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

export function createLead({
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    phone,
    email,
    company,
    source,
    score,
    status,
    opportunityValue,
    customerId,
    timestamp,
    timestamp
  );

  const row = db
    .prepare(`
      SELECT *
      FROM leads
      WHERE id = ?
    `)
    .get(id);

  return row ? mapLead(row) : null;
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
      customer_id,
      total_amount,
      status,
      source,
      payment_status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    customerId,
    totalAmount,
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
      customer_id,
      total_amount,
      status,
      abandoned_at,
      recovered_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    customerId,
    totalAmount,
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
  id = crypto.randomUUID(),
  customerId = null,
  type,
  metadata = {},
}) {
  const timestamp = now();

  db.prepare(`
    INSERT INTO customer_events (
      id,
      customer_id,
      type,
      metadata_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
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

  if (!customer) {
    return null;
  }

  const orders = getOrdersByCustomerId(customerId);
  const carts = getCartsByCustomerId(customerId);
  const events = getCustomerEvents(customerId);
  const executions = getExecutionsByCustomerId(customerId);

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
    },

    orders,
    carts,
    events,
    executions,
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
      SELECT COALESCE(SUM(total_amount), 0) AS total
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
   SEED CRM / ECOMMERCE
========================================================= */

export function seedCRMData() {
  const customerCount = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM customers
    `)
    .get().count;

  if (customerCount > 0) {
    return;
  }

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

export default db;