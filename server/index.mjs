import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

/* =========================================================
   IN-MEMORY DATA
   بعداً این بخش به Database واقعی وصل می‌شود
========================================================= */

const business = {
  name: "کسب‌وکار من",
  healthScore: 86,
  growthReadiness: 81,
  riskScore: 18,
  dataQuality: 78,

  crm: {
    totalCustomers: 1248,
    newLeads: 213,
    hotLeads: 32,
    activeCustomers: 986,
    retentionRate: 72,
    churnRate: 4.5,
  },

  ecommerce: {
    onlineRevenue: 384000000,
    completedPurchases: 186,
    abandonedCarts: 46,
    repeatCustomers: 58,
    repeatCustomerRate: 31.2,
  },

  marketing: {
    cac: 480000,
    roas: 4.8,
  },

  website: {
    conversionRate: 6.8,
  },
};

/* =========================================================
   WORKFLOWS
========================================================= */

let automations = [
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
   EXECUTION LOG
========================================================= */

let executionLog = [];

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

function simulateAction(action, event) {
  const execution = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    eventType: event.type,
    actionType: action.type,
    channel: action.channel || null,
    template: action.template || null,
    status: "simulated",
  };

  executionLog.unshift(execution);

  return execution;
}

function runWorkflow(workflow, event) {
  const executions = workflow.actions.map((action) =>
    simulateAction(action, event)
  );

  return {
    workflowId: workflow.id,
    workflowTitle: workflow.title,
    delayMinutes: workflow.delayMinutes,
    executions,
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Loadder AI Backend",
    message: "Backend is running successfully",
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   BUSINESS DATA
========================================================= */

app.get("/api/business", (req, res) => {
  res.json({
    ok: true,
    data: business,
  });
});

/* =========================================================
   AUTOMATIONS
========================================================= */

app.get("/api/automations", (req, res) => {
  res.json({
    ok: true,
    count: automations.length,
    data: automations,
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
      message: "title و trigger الزامی هستند.",
    });
  }

  const newAutomation = {
    id: crypto.randomUUID(),
    title,
    trigger,
    enabled,
    delayMinutes,
    conditions,
    actions,
  };

  automations.unshift(newAutomation);

  res.status(201).json({
    ok: true,
    data: newAutomation,
  });
});

app.patch("/api/automations/:id", (req, res) => {
  const automation = automations.find(
    (item) => item.id === req.params.id
  );

  if (!automation) {
    return res.status(404).json({
      ok: false,
      message: "اتوماسیون پیدا نشد.",
    });
  }

  Object.assign(automation, req.body);

  res.json({
    ok: true,
    data: automation,
  });
});

app.delete("/api/automations/:id", (req, res) => {
  const before = automations.length;

  automations = automations.filter(
    (item) => item.id !== req.params.id
  );

  if (automations.length === before) {
    return res.status(404).json({
      ok: false,
      message: "اتوماسیون پیدا نشد.",
    });
  }

  res.json({
    ok: true,
    message: "اتوماسیون حذف شد.",
  });
});

/* =========================================================
   MANUAL WORKFLOW RUN
========================================================= */

app.post("/api/automations/:id/run", (req, res) => {
  const workflow = automations.find(
    (item) => item.id === req.params.id
  );

  if (!workflow) {
    return res.status(404).json({
      ok: false,
      message: "اتوماسیون پیدا نشد.",
    });
  }

  const event = {
    id: crypto.randomUUID(),
    type: workflow.trigger,
    createdAt: new Date().toISOString(),
    payload: req.body?.payload || {},
  };

  const result = runWorkflow(workflow, event);

  res.json({
    ok: true,
    event,
    result,
  });
});

/* =========================================================
   EVENT BUS
========================================================= */

app.post("/api/events", (req, res) => {
  const { type, payload = {} } = req.body;

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

  const matchedWorkflows = automations.filter((workflow) =>
    workflowMatches(workflow, event)
  );

  const results = matchedWorkflows.map((workflow) =>
    runWorkflow(workflow, event)
  );

  res.json({
    ok: true,
    event,
    matchedWorkflows: matchedWorkflows.length,
    results,
  });
});

/* =========================================================
   EXECUTION LOG
========================================================= */

app.get("/api/executions", (req, res) => {
  res.json({
    ok: true,
    count: executionLog.length,
    data: executionLog,
  });
});

/* =========================================================
   SUPPORTED EVENT TYPES
========================================================= */

app.get("/api/event-types", (req, res) => {
  res.json({
    ok: true,
    data: [
      "cart.abandoned",
      "checkout.started",
      "order.completed",
      "customer.repeat_purchase",
      "lead.hot",
      "customer.churn_risk",
      "marketing.cac_high",
      "website.conversion_drop",
    ],
  });
});

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
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log("==========================================");
  console.log("Loadder AI Backend");
  console.log(`http://localhost:${PORT}`);
  console.log("==========================================");
  console.log("");
});