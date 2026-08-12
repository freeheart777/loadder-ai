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
} from "./db/database.mjs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

/* =========================================================
   BUSINESS DATA
   فعلاً داخل حافظه ثابت است.
   بعداً می‌بریم داخل Database.
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
   DEFAULT WORKFLOWS
   فقط در اولین اجرای دیتابیس Seed می‌شوند.
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
   SEED DATABASE
========================================================= */

seedDefaultAutomations(defaultAutomations);

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

/* =========================================================
   MESSAGE BUILDER
========================================================= */

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

/* =========================================================
   ACTION EXECUTOR
========================================================= */

async function executeAction(action, event, workflow) {
  let executionResult = {
    ok: true,
    status: "simulated",
  };

  if (
    action.type === "send_message" ||
    action.type === "send_offer"
  ) {
    let recipient = null;

    if (action.channel === "email") {
      recipient =
        event.payload.email ||
        event.payload.recipient;
    } else {
      recipient =
        event.payload.phone ||
        event.payload.recipient;
    }

    executionResult = await sendMessage({
      channel: action.channel || "sms",

      recipient,

      message: buildMessage(action, event),

      metadata: {
        eventId: event.id,

        eventType: event.type,

        workflowId: workflow.id,

        workflowTitle: workflow.title,

        template: action.template || null,

        customerId:
          event.payload.customerId || null,

        orderId:
          event.payload.orderId || null,
      },
    });
  }

  if (action.type === "create_task") {
    console.log("");
    console.log("========== LOADDER TASK ==========");
    console.log(
      "ASSIGNEE:",
      action.assignee || "sales"
    );
    console.log("EVENT:", event.type);
    console.log("PAYLOAD:", event.payload);
    console.log("===================================");
    console.log("");

    executionResult = {
      ok: true,
      provider: "loadder-simulator",
      action: "create_task",
      status: "simulated",
      assignee: action.assignee || "sales",
    };
  }

  if (action.type === "create_campaign") {
    console.log("");
    console.log("======== LOADDER CAMPAIGN ========");
    console.log("EVENT:", event.type);
    console.log("TEMPLATE:", action.template);
    console.log("===================================");
    console.log("");

    executionResult = {
      ok: true,
      provider: "loadder-simulator",
      action: "create_campaign",
      status: "simulated",
    };
  }

  if (action.type === "create_alert") {
    console.log("");
    console.log("========== LOADDER ALERT ==========");
    console.log("EVENT:", event.type);
    console.log("TEMPLATE:", action.template);
    console.log("====================================");
    console.log("");

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

    status:
      executionResult.status || "completed",

    result: executionResult,
  };

  saveExecution(execution);

  return execution;
}

/* =========================================================
   WORKFLOW RUNNER
========================================================= */

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

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,

    service: "Loadder AI Backend",

    message: "Backend is running successfully",

    database: "sqlite",

    persistence: true,

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
  const automations = getAutomations();

  res.json({
    ok: true,

    count: automations.length,

    data: automations,
  });
});

/* =========================================================
   GET ONE AUTOMATION
========================================================= */

app.get("/api/automations/:id", (req, res) => {
  const automation = getAutomationById(
    req.params.id
  );

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

/* =========================================================
   CREATE AUTOMATION
========================================================= */

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

  if (!Array.isArray(actions)) {
    return res.status(400).json({
      ok: false,
      message: "actions باید آرایه باشد.",
    });
  }

  try {
    const newAutomation =
      createAutomation({
        title,

        trigger,

        enabled,

        delayMinutes:
          Number(delayMinutes) || 0,

        conditions:
          Array.isArray(conditions)
            ? conditions
            : [],

        actions,
      });

    res.status(201).json({
      ok: true,
      data: newAutomation,
    });
  } catch (error) {
    console.error(
      "Create automation error:",
      error
    );

    res.status(500).json({
      ok: false,
      message:
        "خطا در ذخیره اتوماسیون.",
    });
  }
});

/* =========================================================
   UPDATE AUTOMATION
========================================================= */

app.patch(
  "/api/automations/:id",
  (req, res) => {
    try {
      const updated =
        updateAutomation(
          req.params.id,
          req.body
        );

      if (!updated) {
        return res.status(404).json({
          ok: false,
          message:
            "اتوماسیون پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        data: updated,
      });
    } catch (error) {
      console.error(
        "Update automation error:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در ویرایش اتوماسیون.",
      });
    }
  }
);

/* =========================================================
   DELETE AUTOMATION
========================================================= */

app.delete(
  "/api/automations/:id",
  (req, res) => {
    try {
      const deleted =
        deleteAutomation(
          req.params.id
        );

      if (!deleted) {
        return res.status(404).json({
          ok: false,
          message:
            "اتوماسیون پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        message:
          "اتوماسیون حذف شد.",
      });
    } catch (error) {
      console.error(
        "Delete automation error:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در حذف اتوماسیون.",
      });
    }
  }
);

/* =========================================================
   MANUAL WORKFLOW RUN
========================================================= */

app.post(
  "/api/automations/:id/run",
  async (req, res) => {
    const workflow =
      getAutomationById(
        req.params.id
      );

    if (!workflow) {
      return res.status(404).json({
        ok: false,
        message:
          "اتوماسیون پیدا نشد.",
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

      createdAt:
        new Date().toISOString(),

      payload:
        req.body?.payload || {},
    };

    try {
      saveEvent(event);

      const result =
        await runWorkflow(
          workflow,
          event
        );

      res.json({
        ok: true,
        event,
        result,
      });
    } catch (error) {
      console.error(
        "Workflow execution error:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در اجرای Workflow",
      });
    }
  }
);

/* =========================================================
   EVENT BUS
========================================================= */

app.post(
  "/api/events",
  async (req, res) => {
    const {
      type,
      payload = {},
    } = req.body;

    if (!type) {
      return res.status(400).json({
        ok: false,
        message:
          "نوع Event الزامی است.",
      });
    }

    const event = {
      id: crypto.randomUUID(),

      type,

      payload,

      createdAt:
        new Date().toISOString(),
    };

    try {
      saveEvent(event);

      const automations =
        getAutomations();

      const matchedWorkflows =
        automations.filter(
          (workflow) =>
            workflowMatches(
              workflow,
              event
            )
        );

      const results =
        await Promise.all(
          matchedWorkflows.map(
            (workflow) =>
              runWorkflow(
                workflow,
                event
              )
          )
        );

      res.json({
        ok: true,

        event,

        matchedWorkflows:
          matchedWorkflows.length,

        results,
      });
    } catch (error) {
      console.error(
        "Event execution error:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در پردازش Event",
      });
    }
  }
);

/* =========================================================
   EXECUTION HISTORY
========================================================= */

app.get("/api/executions", (req, res) => {
  const limit =
    Number(req.query.limit) || 100;

  const executions =
    getExecutions(limit);

  res.json({
    ok: true,

    count:
      executions.length,

    data:
      executions,
  });
});

/* =========================================================
   CLEAR EXECUTION HISTORY
========================================================= */

app.delete(
  "/api/executions",
  (req, res) => {
    try {
      clearExecutions();

      res.json({
        ok: true,

        message:
          "Execution history cleared.",
      });
    } catch (error) {
      console.error(
        "Clear executions error:",
        error
      );

      res.status(500).json({
        ok: false,

        message:
          "خطا در پاک‌کردن تاریخچه.",
      });
    }
  }
);

/* =========================================================
   EVENT TYPES
========================================================= */

app.get(
  "/api/event-types",
  (req, res) => {
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
  }
);

/* =========================================================
   DATABASE INFO
========================================================= */

app.get(
  "/api/database/status",
  (req, res) => {
    const automations =
      getAutomations();

    const executions =
      getExecutions(1000);

    res.json({
      ok: true,

      database:
        "SQLite",

      persistent:
        true,

      automations:
        automations.length,

      executions:
        executions.length,

      message:
        "Loadder persistent database is active.",
    });
  }
);

/* =========================================================
   404
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    ok: false,

    message:
      "API route not found",
  });
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log("");

  console.log(
    "=========================================="
  );

  console.log(
    "Loadder AI Backend"
  );

  console.log(
    `http://localhost:${PORT}`
  );

  console.log(
    "Database: SQLite"
  );

  console.log(
    "Persistence: ENABLED"
  );

  console.log(
    "Messaging Adapter: READY"
  );

  console.log(
    "SMS Provider: SIMULATOR"
  );

  console.log(
    "Email Provider: SIMULATOR"
  );

  console.log(
    "=========================================="
  );

  console.log("");
});