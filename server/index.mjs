import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

import { sendMessage } from "./services/messaging.mjs";

import {
  getAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  saveEvent,
  saveExecution,
  getExecutions,
  clearExecutions,
  seedDefaultAutomations,

  getCustomers,
  getCustomerById,
  createCustomer,
  getCustomer360,

  getLeads,
  createLead,

  getOrders,
  createOrder,

  getCarts,
  createCart,

  getCustomerEvents,
  createCustomerEvent,

  getCRMStats,
  seedCRMData,
} from "./db/database.mjs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

/* =========================================================
   DEFAULT AUTOMATIONS
========================================================= */

const defaultAutomations = [
  {
    id: "abandoned-cart",
    title: "بازیابی سبد خرید رهاشده",
    trigger: "cart.abandoned",
    enabled: true,
    delayMinutes: 120,
    conditions: [
      {
        field: "cartValue",
        operator: "gte",
        value: 0,
      },
    ],
    actions: [
      {
        type: "send_message",
        channel: "sms",
        template: "cart_recovery",
      },
    ],
  },

  {
    id: "hot-lead",
    title: "پیگیری لید داغ",
    trigger: "lead.hot",
    enabled: true,
    delayMinutes: 0,
    conditions: [
      {
        field: "score",
        operator: "gte",
        value: 80,
      },
    ],
    actions: [
      {
        type: "create_task",
        assignee: "sales",
        template: "hot_lead_followup",
      },
    ],
  },

  {
    id: "order-completed",
    title: "پیگیری پس از خرید",
    trigger: "order.completed",
    enabled: true,
    delayMinutes: 10,
    conditions: [],
    actions: [
      {
        type: "send_message",
        channel: "sms",
        template: "purchase_thank_you",
      },
    ],
  },

  {
    id: "repeat-purchase",
    title: "پیشنهاد مشتری تکرارشونده",
    trigger: "customer.repeat_purchase",
    enabled: true,
    delayMinutes: 0,
    conditions: [
      {
        field: "orderCount",
        operator: "gte",
        value: 2,
      },
    ],
    actions: [
      {
        type: "send_offer",
        channel: "sms",
        template: "repeat_customer_offer",
      },
    ],
  },

  {
    id: "churn-risk",
    title: "بازگشت مشتری در معرض ریزش",
    trigger: "customer.churn_risk",
    enabled: true,
    delayMinutes: 0,
    conditions: [
      {
        field: "riskScore",
        operator: "gte",
        value: 70,
      },
    ],
    actions: [
      {
        type: "create_campaign",
        channel: "crm",
        template: "winback_campaign",
      },
    ],
  },

  {
    id: "high-cac",
    title: "هشدار هزینه جذب بالا",
    trigger: "marketing.cac_high",
    enabled: true,
    delayMinutes: 0,
    conditions: [
      {
        field: "cac",
        operator: "gte",
        value: 500000,
      },
    ],
    actions: [
      {
        type: "create_alert",
        channel: "dashboard",
        template: "high_cac_alert",
      },
    ],
  },

  {
    id: "conversion-drop",
    title: "هشدار افت نرخ تبدیل",
    trigger: "website.conversion_drop",
    enabled: true,
    delayMinutes: 0,
    conditions: [
      {
        field: "conversionRate",
        operator: "lte",
        value: 5.5,
      },
    ],
    actions: [
      {
        type: "create_alert",
        channel: "dashboard",
        template: "conversion_drop_alert",
      },
    ],
  },
];

/* =========================================================
   SEED
========================================================= */

seedDefaultAutomations(defaultAutomations);
seedCRMData();

/* =========================================================
   HELPERS
========================================================= */

function evaluateCondition(eventPayload, condition) {
  const actualValue = eventPayload[condition.field];
  const expectedValue = condition.value;

  if (actualValue === undefined) {
    return false;
  }

  switch (condition.operator) {
    case "eq":
      return actualValue === expectedValue;

    case "neq":
      return actualValue !== expectedValue;

    case "gt":
      return actualValue > expectedValue;

    case "gte":
      return actualValue >= expectedValue;

    case "lt":
      return actualValue < expectedValue;

    case "lte":
      return actualValue <= expectedValue;

    default:
      return false;
  }
}

function workflowMatches(workflow, event) {
  if (!workflow.enabled) {
    return false;
  }

  if (workflow.trigger !== event.type) {
    return false;
  }

  return workflow.conditions.every((condition) =>
    evaluateCondition(event.payload, condition)
  );
}

function buildMessage(action, event) {
  const customerName =
    event.payload.customerName || "مشتری عزیز";

  switch (action.template) {
    case "cart_recovery":
      return `${customerName}، سبد خرید شما هنوز منتظر شماست. برای تکمیل خرید به فروشگاه برگردید.`;

    case "purchase_thank_you":
      return `${customerName}، از خرید شما متشکریم. سفارش شما با موفقیت ثبت شد.`;

    case "repeat_customer_offer":
      return `${customerName}، از اینکه دوباره ما را انتخاب کردید متشکریم. یک پیشنهاد ویژه برای شما داریم.`;

    case "custom_message":
      return `${customerName}، یک پیام خودکار از Loadder برای شما ارسال شده است.`;

    case "custom_offer":
      return `${customerName}، یک پیشنهاد ویژه برای شما آماده شده است.`;

    default:
      return `${customerName}، پیام خودکار Loadder`;
  }
}

async function executeAction(action, event, workflow) {
  let executionResult = {
    ok: true,
    status: "simulated",
  };

  if (
    action.type === "send_message" ||
    action.type === "send_offer"
  ) {
    const recipient =
      action.channel === "email"
        ? event.payload.email || event.payload.recipient
        : event.payload.phone || event.payload.recipient;

    executionResult = await sendMessage({
      channel: action.channel || "sms",
      recipient,
      message: buildMessage(action, event),
      metadata: {
        eventId: event.id,
        eventType: event.type,
        workflowId: workflow.id,
        workflowTitle: workflow.title,
        customerId: event.payload.customerId || null,
        orderId: event.payload.orderId || null,
      },
    });
  }

  if (action.type === "create_task") {
    executionResult = {
      ok: true,
      provider: "loadder-simulator",
      action: "create_task",
      assignee: action.assignee || "sales",
      status: "simulated",
    };
  }

  if (action.type === "create_campaign") {
    executionResult = {
      ok: true,
      provider: "loadder-simulator",
      action: "create_campaign",
      status: "simulated",
    };
  }

  if (action.type === "create_alert") {
    executionResult = {
      ok: true,
      provider: "loadder-simulator",
      action: "create_alert",
      status: "simulated",
    };
  }

  const execution = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    eventId: event.id,
    eventType: event.type,
    workflowId: workflow.id,
    workflowTitle: workflow.title,
    actionType: action.type,
    channel: action.channel || null,
    template: action.template || null,
    recipient:
      event.payload.phone ||
      event.payload.email ||
      event.payload.recipient ||
      null,
    status: executionResult.status || "completed",
    result: executionResult,
  };

  saveExecution(execution);

  return execution;
}

async function runWorkflow(workflow, event) {
  const executions = [];

  for (const action of workflow.actions) {
    const execution = await executeAction(
      action,
      event,
      workflow
    );

    executions.push(execution);
  }

  return {
    workflowId: workflow.id,
    workflowTitle: workflow.title,
    delayMinutes: workflow.delayMinutes,
    executions,
  };
}

async function processEvent(event) {
  saveEvent(event);

  if (event.payload.customerId) {
    createCustomerEvent({
      customerId: event.payload.customerId,
      type: event.type,
      metadata: event.payload,
    });
  }

  const automations = getAutomations();

  const matchedWorkflows = automations.filter((workflow) =>
    workflowMatches(workflow, event)
  );

  const results = await Promise.all(
    matchedWorkflows.map((workflow) =>
      runWorkflow(workflow, event)
    )
  );

  return {
    matchedWorkflows,
    results,
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Loadder AI Backend",
    database: "SQLite",
    persistence: true,
    customer360: true,
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   CRM STATS
========================================================= */

app.get("/api/crm/stats", (req, res) => {
  res.json({
    ok: true,
    data: getCRMStats(),
  });
});

/* =========================================================
   CUSTOMER 360
   مهم: این Route باید قبل از /api/customers/:id باشد
========================================================= */

app.get("/api/customers/:id/360", (req, res) => {
  try {
    const data = getCustomer360(req.params.id);

    if (!data) {
      return res.status(404).json({
        ok: false,
        message: "مشتری پیدا نشد.",
      });
    }

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("Customer 360 error:", error);

    res.status(500).json({
      ok: false,
      message:
        "خطا در دریافت پروفایل کامل مشتری.",
    });
  }
});

/* =========================================================
   CUSTOMER EVENTS
========================================================= */

app.get(
  "/api/customers/:id/events",
  (req, res) => {
    try {
      const customer = getCustomerById(req.params.id);

      if (!customer) {
        return res.status(404).json({
          ok: false,
          message: "مشتری پیدا نشد.",
        });
      }

      const data = getCustomerEvents(req.params.id);

      res.json({
        ok: true,
        count: data.length,
        data,
      });
    } catch (error) {
      console.error("Customer events error:", error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت رویدادهای مشتری.",
      });
    }
  }
);

/* =========================================================
   CUSTOMERS
========================================================= */

app.get("/api/customers", (req, res) => {
  const data = getCustomers();

  res.json({
    ok: true,
    count: data.length,
    data,
  });
});

app.get("/api/customers/:id", (req, res) => {
  const customer = getCustomerById(req.params.id);

  if (!customer) {
    return res.status(404).json({
      ok: false,
      message: "مشتری پیدا نشد.",
    });
  }

  res.json({
    ok: true,
    data: customer,
  });
});

app.post("/api/customers", (req, res) => {
  const {
    name,
    phone,
    email,
    company,
    source,
  } = req.body;

  if (!name) {
    return res.status(400).json({
      ok: false,
      message: "نام مشتری الزامی است.",
    });
  }

  try {
    const customer = createCustomer({
      name,
      phone,
      email,
      company,
      source,
    });

    res.status(201).json({
      ok: true,
      data: customer,
    });
  } catch (error) {
    console.error("Create customer error:", error);

    res.status(500).json({
      ok: false,
      message: "خطا در ساخت مشتری.",
    });
  }
});

/* =========================================================
   LEADS
========================================================= */

app.get("/api/leads", (req, res) => {
  const data = getLeads();

  res.json({
    ok: true,
    count: data.length,
    data,
  });
});

app.post("/api/leads", async (req, res) => {
  const {
    name,
    phone,
    email,
    company,
    source,
    score = 0,
    status = "new",
    opportunityValue = 0,
  } = req.body;

  if (!name) {
    return res.status(400).json({
      ok: false,
      message: "نام لید الزامی است.",
    });
  }

  try {
    const lead = createLead({
      name,
      phone,
      email,
      company,
      source,
      score,
      status,
      opportunityValue,
    });

    if (Number(score) >= 80) {
      const event = {
        id: crypto.randomUUID(),
        type: "lead.hot",
        createdAt: new Date().toISOString(),
        payload: {
          leadId: lead.id,
          leadName: name,
          phone,
          email,
          score: Number(score),
        },
      };

      await processEvent(event);
    }

    res.status(201).json({
      ok: true,
      data: lead,
    });
  } catch (error) {
    console.error("Create lead error:", error);

    res.status(500).json({
      ok: false,
      message: "خطا در ساخت لید.",
    });
  }
});

/* =========================================================
   ORDERS
========================================================= */

app.get("/api/orders", (req, res) => {
  const data = getOrders();

  res.json({
    ok: true,
    count: data.length,
    data,
  });
});

app.post("/api/orders", async (req, res) => {
  const {
    customerId,
    totalAmount,
    status = "completed",
    source = "website",
    paymentStatus = "paid",
  } = req.body;

  if (!customerId || totalAmount === undefined) {
    return res.status(400).json({
      ok: false,
      message:
        "customerId و totalAmount الزامی هستند.",
    });
  }

  const customer = getCustomerById(customerId);

  if (!customer) {
    return res.status(404).json({
      ok: false,
      message: "مشتری پیدا نشد.",
    });
  }

  try {
    const order = createOrder({
      customerId,
      totalAmount: Number(totalAmount),
      status,
      source,
      paymentStatus,
    });

    if (status === "completed") {
      const event = {
        id: crypto.randomUUID(),
        type: "order.completed",
        createdAt: new Date().toISOString(),
        payload: {
          customerId,
          customerName: customer.name,
          phone: customer.phone,
          email: customer.email,
          orderId: order.id,
          amount: Number(totalAmount),
        },
      };

      await processEvent(event);
    }

    res.status(201).json({
      ok: true,
      data: order,
    });
  } catch (error) {
    console.error("Create order error:", error);

    res.status(500).json({
      ok: false,
      message: "خطا در ساخت سفارش.",
    });
  }
});

/* =========================================================
   CARTS
========================================================= */

app.get("/api/carts", (req, res) => {
  const data = getCarts();

  res.json({
    ok: true,
    count: data.length,
    data,
  });
});

app.post("/api/carts", async (req, res) => {
  const {
    customerId = null,
    totalAmount = 0,
    status = "active",
  } = req.body;

  try {
    const cart = createCart({
      customerId,
      totalAmount: Number(totalAmount),
      status,
      abandonedAt:
        status === "abandoned"
          ? new Date().toISOString()
          : null,
    });

    if (status === "abandoned") {
      const customer = customerId
        ? getCustomerById(customerId)
        : null;

      const event = {
        id: crypto.randomUUID(),
        type: "cart.abandoned",
        createdAt: new Date().toISOString(),
        payload: {
          customerId,
          customerName: customer?.name || null,
          phone: customer?.phone || null,
          email: customer?.email || null,
          cartId: cart.id,
          cartValue: Number(totalAmount),
        },
      };

      await processEvent(event);
    }

    res.status(201).json({
      ok: true,
      data: cart,
    });
  } catch (error) {
    console.error("Create cart error:", error);

    res.status(500).json({
      ok: false,
      message: "خطا در ساخت سبد خرید.",
    });
  }
});

/* =========================================================
   AUTOMATIONS
========================================================= */

app.get("/api/automations", (req, res) => {
  const data = getAutomations();

  res.json({
    ok: true,
    count: data.length,
    data,
  });
});

app.get("/api/automations/:id", (req, res) => {
  const automation = getAutomationById(req.params.id);

  if (!automation) {
    return res.status(404).json({
      ok: false,
      message: "اتوماسیون پیدا نشد.",
    });
  }

  res.json({
    ok: true,
    data: automation,
  });
});

app.post("/api/automations", (req, res) => {
  const {
    title,
    trigger,
    enabled = true,
    delayMinutes = 0,
    conditions = [],
    actions = [],
  } = req.body;

  if (!title || !trigger) {
    return res.status(400).json({
      ok: false,
      message:
        "title و trigger الزامی هستند.",
    });
  }

  try {
    const automation = createAutomation({
      title,
      trigger,
      enabled,
      delayMinutes,
      conditions,
      actions,
    });

    res.status(201).json({
      ok: true,
      data: automation,
    });
  } catch (error) {
    console.error("Create automation error:", error);

    res.status(500).json({
      ok: false,
      message:
        "خطا در ساخت اتوماسیون.",
    });
  }
});

app.patch("/api/automations/:id", (req, res) => {
  try {
    const automation = updateAutomation(
      req.params.id,
      req.body
    );

    if (!automation) {
      return res.status(404).json({
        ok: false,
        message:
          "اتوماسیون پیدا نشد.",
      });
    }

    res.json({
      ok: true,
      data: automation,
    });
  } catch (error) {
    console.error("Update automation error:", error);

    res.status(500).json({
      ok: false,
      message:
        "خطا در ویرایش اتوماسیون.",
    });
  }
});

app.delete("/api/automations/:id", (req, res) => {
  try {
    const deleted = deleteAutomation(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        message:
          "اتوماسیون پیدا نشد.",
      });
    }

    res.json({
      ok: true,
    });
  } catch (error) {
    console.error("Delete automation error:", error);

    res.status(500).json({
      ok: false,
      message:
        "خطا در حذف اتوماسیون.",
    });
  }
});

/* =========================================================
   MANUAL WORKFLOW RUN
========================================================= */

app.post(
  "/api/automations/:id/run",
  async (req, res) => {
    const workflow = getAutomationById(req.params.id);

    if (!workflow) {
      return res.status(404).json({
        ok: false,
        message: "اتوماسیون پیدا نشد.",
      });
    }

    if (!workflow.enabled) {
      return res.status(400).json({
        ok: false,
        message:
          "این Workflow متوقف است.",
      });
    }

    const event = {
      id: crypto.randomUUID(),
      type: workflow.trigger,
      createdAt: new Date().toISOString(),
      payload: req.body?.payload || {},
    };

    try {
      const result = await runWorkflow(
        workflow,
        event
      );

      saveEvent(event);

      if (event.payload.customerId) {
        createCustomerEvent({
          customerId: event.payload.customerId,
          type: event.type,
          metadata: event.payload,
        });
      }

      res.json({
        ok: true,
        event,
        result,
      });
    } catch (error) {
      console.error(
        "Manual workflow execution error:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در اجرای Workflow.",
      });
    }
  }
);

/* =========================================================
   EVENTS
========================================================= */

app.post("/api/events", async (req, res) => {
  const {
    type,
    payload = {},
  } = req.body;

  if (!type) {
    return res.status(400).json({
      ok: false,
      message: "نوع Event الزامی است.",
    });
  }

  const event = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };

  try {
    const {
      matchedWorkflows,
      results,
    } = await processEvent(event);

    res.json({
      ok: true,
      event,
      matchedWorkflows:
        matchedWorkflows.length,
      results,
    });
  } catch (error) {
    console.error("Process event error:", error);

    res.status(500).json({
      ok: false,
      message:
        "خطا در پردازش Event.",
    });
  }
});

/* =========================================================
   EXECUTIONS
========================================================= */

app.get("/api/executions", (req, res) => {
  const limit =
    Number(req.query.limit) || 100;

  const data = getExecutions(limit);

  res.json({
    ok: true,
    count: data.length,
    data,
  });
});

app.delete("/api/executions", (req, res) => {
  try {
    clearExecutions();

    res.json({
      ok: true,
    });
  } catch (error) {
    console.error("Clear executions error:", error);

    res.status(500).json({
      ok: false,
      message:
        "خطا در پاک‌کردن تاریخچه.",
    });
  }
});

/* =========================================================
   DATABASE STATUS
========================================================= */

app.get(
  "/api/database/status",
  (req, res) => {
    const crm = getCRMStats();

    res.json({
      ok: true,
      database: "SQLite",
      persistent: true,
      customer360: true,
      crm,
      automations: getAutomations().length,
      executions: getExecutions(1000).length,
    });
  }
);

/* =========================================================
   404
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "API route not found",
  });
});

/* =========================================================
   START
========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log(
    "=========================================="
  );
  console.log("Loadder AI Backend");
  console.log(`http://localhost:${PORT}`);
  console.log("Database: SQLite");
  console.log("Persistence: ENABLED");
  console.log("Customer 360: READY");
  console.log("CRM Data Layer: READY");
  console.log("E-commerce Data Layer: READY");
  console.log("Workflow Engine: READY");
  console.log("Messaging Adapter: READY");
  console.log(
    "=========================================="
  );
  console.log("");
});