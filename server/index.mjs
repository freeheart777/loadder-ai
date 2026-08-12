import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

import {
  sendMessage,
  getMessagingStatus,
} from "./services/messaging.mjs";

import {
  /* =========================
     AUTOMATION
  ========================= */

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

  /* =========================
     CRM
  ========================= */

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

  /* =========================
     MARKETING ACQUISITION
  ========================= */

  getMarketingChannels,
  getMarketingPlatforms,
  getAdvertisingServices,

  getMarketingCampaigns,
  getCampaignById,

  getCampaignMetrics,
  calculateCampaignKPIs,

  createMarketingCampaign,
  saveCampaignMetric,

  getAttributionTouchpoints,
  createAttributionTouchpoint,

  seedMarketingData,
} from "./db/database.mjs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT =
  process.env.PORT || 3001;

/* =========================================================
   DEFAULT AUTOMATIONS
========================================================= */

const defaultAutomations = [
  {
    id: "abandoned-cart",

    title:
      "بازیابی سبد خرید رهاشده",

    trigger:
      "cart.abandoned",

    enabled: true,

    delayMinutes: 120,

    conditions: [
      {
        field:
          "cartValue",

        operator:
          "gte",

        value: 0,
      },
    ],

    actions: [
      {
        type:
          "send_message",

        channel:
          "sms",

        template:
          "cart_recovery",
      },
    ],
  },

  {
    id:
      "hot-lead",

    title:
      "پیگیری لید داغ",

    trigger:
      "lead.hot",

    enabled:
      true,

    delayMinutes:
      0,

    conditions: [
      {
        field:
          "score",

        operator:
          "gte",

        value:
          80,
      },
    ],

    actions: [
      {
        type:
          "create_task",

        assignee:
          "sales",

        template:
          "hot_lead_followup",
      },
    ],
  },

  {
    id:
      "order-completed",

    title:
      "پیگیری پس از خرید",

    trigger:
      "order.completed",

    enabled:
      true,

    delayMinutes:
      10,

    conditions:
      [],

    actions: [
      {
        type:
          "send_message",

        channel:
          "sms",

        template:
          "purchase_thank_you",
      },
    ],
  },

  {
    id:
      "repeat-purchase",

    title:
      "پیشنهاد مشتری تکرارشونده",

    trigger:
      "customer.repeat_purchase",

    enabled:
      true,

    delayMinutes:
      0,

    conditions: [
      {
        field:
          "orderCount",

        operator:
          "gte",

        value:
          2,
      },
    ],

    actions: [
      {
        type:
          "send_offer",

        channel:
          "sms",

        template:
          "repeat_customer_offer",
      },
    ],
  },

  {
    id:
      "churn-risk",

    title:
      "بازگشت مشتری در معرض ریزش",

    trigger:
      "customer.churn_risk",

    enabled:
      true,

    delayMinutes:
      0,

    conditions: [
      {
        field:
          "riskScore",

        operator:
          "gte",

        value:
          70,
      },
    ],

    actions: [
      {
        type:
          "create_campaign",

        channel:
          "crm",

        template:
          "winback_campaign",
      },
    ],
  },

  {
    id:
      "high-cac",

    title:
      "هشدار هزینه جذب بالا",

    trigger:
      "marketing.cac_high",

    enabled:
      true,

    delayMinutes:
      0,

    conditions: [
      {
        field:
          "cac",

        operator:
          "gte",

        value:
          500000,
      },
    ],

    actions: [
      {
        type:
          "create_alert",

        channel:
          "dashboard",

        template:
          "high_cac_alert",
      },
    ],
  },

  {
    id:
      "conversion-drop",

    title:
      "هشدار افت نرخ تبدیل",

    trigger:
      "website.conversion_drop",

    enabled:
      true,

    delayMinutes:
      0,

    conditions: [
      {
        field:
          "conversionRate",

        operator:
          "lte",

        value:
          5.5,
      },
    ],

    actions: [
      {
        type:
          "create_alert",

        channel:
          "dashboard",

        template:
          "conversion_drop_alert",
      },
    ],
  },
];

/* =========================================================
   SEED
========================================================= */

seedDefaultAutomations(
  defaultAutomations
);

seedCRMData();

seedMarketingData();

/* =========================================================
   AUTOMATION HELPERS
========================================================= */

function evaluateCondition(
  eventPayload,
  condition
) {
  const actualValue =
    eventPayload[
      condition.field
    ];

  const expectedValue =
    condition.value;

  if (
    actualValue ===
    undefined
  ) {
    return false;
  }

  switch (
    condition.operator
  ) {
    case "eq":
      return (
        actualValue ===
        expectedValue
      );

    case "neq":
      return (
        actualValue !==
        expectedValue
      );

    case "gt":
      return (
        actualValue >
        expectedValue
      );

    case "gte":
      return (
        actualValue >=
        expectedValue
      );

    case "lt":
      return (
        actualValue <
        expectedValue
      );

    case "lte":
      return (
        actualValue <=
        expectedValue
      );

    default:
      return false;
  }
}

function workflowMatches(
  workflow,
  event
) {
  if (
    !workflow.enabled
  ) {
    return false;
  }

  if (
    workflow.trigger !==
    event.type
  ) {
    return false;
  }

  return workflow.conditions.every(
    (condition) =>
      evaluateCondition(
        event.payload,
        condition
      )
  );
}

function buildMessage(
  action,
  event
) {
  const customerName =
    event.payload
      .customerName ||
    "مشتری عزیز";

  switch (
    action.template
  ) {
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

async function executeAction(
  action,
  event,
  workflow
) {
  let executionResult = {
    ok: true,
    status:
      "simulated",
  };

  if (
    action.type ===
      "send_message" ||
    action.type ===
      "send_offer"
  ) {
    const recipient =
      action.channel ===
      "email"
        ? event.payload
            .email ||
          event.payload
            .recipient
        : event.payload
            .phone ||
          event.payload
            .recipient;

    executionResult =
      await sendMessage({
        channel:
          action.channel ||
          "sms",

        recipient,

        message:
          buildMessage(
            action,
            event
          ),

        metadata: {
          eventId:
            event.id,

          eventType:
            event.type,

          workflowId:
            workflow.id,

          workflowTitle:
            workflow.title,

          customerId:
            event.payload
              .customerId ||
            null,

          orderId:
            event.payload
              .orderId ||
            null,
        },
      });
  }

  if (
    action.type ===
    "create_task"
  ) {
    executionResult = {
      ok: true,

      provider:
        "loadder-simulator",

      action:
        "create_task",

      assignee:
        action.assignee ||
        "sales",

      status:
        "simulated",
    };
  }

  if (
    action.type ===
    "create_campaign"
  ) {
    executionResult = {
      ok: true,

      provider:
        "loadder-simulator",

      action:
        "create_campaign",

      status:
        "simulated",
    };
  }

  if (
    action.type ===
    "create_alert"
  ) {
    executionResult = {
      ok: true,

      provider:
        "loadder-simulator",

      action:
        "create_alert",

      status:
        "simulated",
    };
  }

  const execution = {
    id:
      crypto.randomUUID(),

    timestamp:
      new Date()
        .toISOString(),

    eventId:
      event.id,

    eventType:
      event.type,

    workflowId:
      workflow.id,

    workflowTitle:
      workflow.title,

    actionType:
      action.type,

    channel:
      action.channel ||
      null,

    template:
      action.template ||
      null,

    recipient:
      event.payload
        .phone ||
      event.payload
        .email ||
      event.payload
        .recipient ||
      null,

    status:
      executionResult
        .status ||
      "completed",

    result:
      executionResult,
  };

  saveExecution(
    execution
  );

  return execution;
}

async function runWorkflow(
  workflow,
  event
) {
  const executions =
    [];

  for (
    const action
    of workflow.actions
  ) {
    const execution =
      await executeAction(
        action,
        event,
        workflow
      );

    executions.push(
      execution
    );
  }

  return {
    workflowId:
      workflow.id,

    workflowTitle:
      workflow.title,

    delayMinutes:
      workflow.delayMinutes,

    executions,
  };
}

async function processEvent(
  event
) {
  saveEvent(
    event
  );

  if (
    event.payload
      .customerId
  ) {
    createCustomerEvent({
      customerId:
        event.payload
          .customerId,

      type:
        event.type,

      metadata:
        event.payload,
    });
  }

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

  return {
    matchedWorkflows,
    results,
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,

      service:
        "Loadder AI Backend",

      database:
        "SQLite",

      persistence:
        true,

      customer360:
        true,

      directMessaging:
        true,

      marketing:
        true,

      attribution:
        true,

      timestamp:
        new Date()
          .toISOString(),
    });
  }
);

/* =========================================================
   CRM STATS
========================================================= */

app.get(
  "/api/crm/stats",
  (req, res) => {
    res.json({
      ok: true,
      data:
        getCRMStats(),
    });
  }
);

/* =========================================================
   CUSTOMER 360
========================================================= */

app.get(
  "/api/customers/:id/360",
  (req, res) => {
    try {
      const data =
        getCustomer360(
          req.params.id
        );

      if (!data) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "مشتری پیدا نشد.",
          });
      }

      res.json({
        ok: true,
        data,
      });
    } catch (error) {
      console.error(
        "Customer 360 error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت پروفایل کامل مشتری.",
        });
    }
  }
);

/* =========================================================
   DIRECT CUSTOMER MESSAGE
========================================================= */

app.post(
  "/api/customers/:id/message",
  async (req, res) => {
    const customer =
      getCustomerById(
        req.params.id
      );

    if (!customer) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "مشتری پیدا نشد.",
        });
    }

    const {
      channel = "sms",
      message,
    } = req.body;

    if (
      channel !== "sms" &&
      channel !== "email"
    ) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "کانال پیام باید sms یا email باشد.",
        });
    }

    if (
      !message ||
      typeof message !==
        "string" ||
      !message.trim()
    ) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "متن پیام الزامی است.",
        });
    }

    const recipient =
      channel === "email"
        ? customer.email
        : customer.phone;

    if (!recipient) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            channel ===
            "email"
              ? "برای این مشتری ایمیل ثبت نشده است."
              : "برای این مشتری شماره موبایل ثبت نشده است.",
        });
    }

    const event = {
      id:
        crypto.randomUUID(),

      type:
        "customer.direct_message",

      createdAt:
        new Date()
          .toISOString(),

      payload: {
        customerId:
          customer.id,

        customerName:
          customer.name,

        phone:
          customer.phone,

        email:
          customer.email,

        channel,

        recipient,

        message:
          message.trim(),
      },
    };

    try {
      saveEvent(
        event
      );

      createCustomerEvent({
        customerId:
          customer.id,

        type:
          "customer.direct_message",

        metadata: {
          channel,
          recipient,

          message:
            message.trim(),
        },
      });

      const result =
        await sendMessage({
          channel,

          recipient,

          message:
            message.trim(),

          metadata: {
            customerId:
              customer.id,

            customerName:
              customer.name,

            eventId:
              event.id,

            eventType:
              event.type,

            source:
              "customer_360",
          },
        });

      const execution = {
        id:
          crypto.randomUUID(),

        timestamp:
          new Date()
            .toISOString(),

        eventId:
          event.id,

        eventType:
          event.type,

        workflowId:
          "manual-customer-message",

        workflowTitle:
          "ارسال مستقیم از CRM",

        actionType:
          "send_message",

        channel,

        template:
          "manual_message",

        recipient,

        status:
          result?.status ||
          "completed",

        result: {
          ...result,

          metadata: {
            customerId:
              customer.id,

            customerName:
              customer.name,

            source:
              "customer_360",
          },
        },
      };

      saveExecution(
        execution
      );

      res.json({
        ok: true,

        data: {
          customer: {
            id:
              customer.id,

            name:
              customer.name,
          },

          channel,
          recipient,
          execution,
        },
      });
    } catch (error) {
      console.error(
        "Direct customer message error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ارسال پیام به مشتری.",
        });
    }
  }
);

/* =========================================================
   CUSTOMER EVENTS
========================================================= */

app.get(
  "/api/customers/:id/events",
  (req, res) => {
    try {
      const customer =
        getCustomerById(
          req.params.id
        );

      if (!customer) {
        return res
          .status(404)
          .json({
            ok: false,
            message:
              "مشتری پیدا نشد.",
          });
      }

      const data =
        getCustomerEvents(
          req.params.id
        );

      res.json({
        ok: true,
        count:
          data.length,
        data,
      });
    } catch (error) {
      console.error(
        "Customer events error:",
        error
      );

      res
        .status(500)
        .json({
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

app.get(
  "/api/customers",
  (req, res) => {
    const data =
      getCustomers();

    res.json({
      ok: true,
      count:
        data.length,
      data,
    });
  }
);

app.get(
  "/api/customers/:id",
  (req, res) => {
    const customer =
      getCustomerById(
        req.params.id
      );

    if (!customer) {
      return res
        .status(404)
        .json({
          ok: false,
          message:
            "مشتری پیدا نشد.",
        });
    }

    res.json({
      ok: true,
      data:
        customer,
    });
  }
);

app.post(
  "/api/customers",
  (req, res) => {
    const {
      name,
      phone,
      email,
      company,
      source,
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "نام مشتری الزامی است.",
        });
    }

    try {
      const customer =
        createCustomer({
          name,
          phone,
          email,
          company,
          source,
        });

      res
        .status(201)
        .json({
          ok: true,
          data:
            customer,
        });
    } catch (error) {
      console.error(
        "Create customer error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,
          message:
            "خطا در ساخت مشتری.",
        });
    }
  }
);

/* =========================================================
   LEADS
========================================================= */

app.get(
  "/api/leads",
  (req, res) => {
    const data =
      getLeads();

    res.json({
      ok: true,
      count:
        data.length,
      data,
    });
  }
);

app.post(
  "/api/leads",
  async (req, res) => {
    const {
      name,
      phone,
      email,
      company,
      source,

      score = 0,

      status =
        "new",

      opportunityValue =
        0,
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({
          ok: false,
          message:
            "نام لید الزامی است.",
        });
    }

    try {
      const lead =
        createLead({
          name,
          phone,
          email,
          company,
          source,

          score,

          status,

          opportunityValue,
        });

      if (
        Number(
          score
        ) >= 80
      ) {
        const event = {
          id:
            crypto.randomUUID(),

          type:
            "lead.hot",

          createdAt:
            new Date()
              .toISOString(),

          payload: {
            leadId:
              lead.id,

            leadName:
              name,

            phone,
            email,

            score:
              Number(
                score
              ),
          },
        };

        await processEvent(
          event
        );
      }

      res
        .status(201)
        .json({
          ok: true,
          data:
            lead,
        });
    } catch (error) {
      console.error(
        "Create lead error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,
          message:
            "خطا در ساخت لید.",
        });
    }
  }
);

/* =========================================================
   ORDERS
========================================================= */

app.get(
  "/api/orders",
  (req, res) => {
    const data =
      getOrders();

    res.json({
      ok: true,
      count:
        data.length,
      data,
    });
  }
);

app.post(
  "/api/orders",
  async (req, res) => {
    const {
      customerId,

      totalAmount,

      status =
        "completed",

      source =
        "website",

      paymentStatus =
        "paid",
    } = req.body;

    if (
      !customerId ||
      totalAmount ===
        undefined
    ) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "customerId و totalAmount الزامی هستند.",
        });
    }

    const customer =
      getCustomerById(
        customerId
      );

    if (!customer) {
      return res
        .status(404)
        .json({
          ok: false,
          message:
            "مشتری پیدا نشد.",
        });
    }

    try {
      const order =
        createOrder({
          customerId,

          totalAmount:
            Number(
              totalAmount
            ),

          status,

          source,

          paymentStatus,
        });

      if (
        status ===
        "completed"
      ) {
        const event = {
          id:
            crypto.randomUUID(),

          type:
            "order.completed",

          createdAt:
            new Date()
              .toISOString(),

          payload: {
            customerId,

            customerName:
              customer.name,

            phone:
              customer.phone,

            email:
              customer.email,

            orderId:
              order.id,

            amount:
              Number(
                totalAmount
              ),
          },
        };

        await processEvent(
          event
        );
      }

      res
        .status(201)
        .json({
          ok: true,
          data:
            order,
        });
    } catch (error) {
      console.error(
        "Create order error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,
          message:
            "خطا در ساخت سفارش.",
        });
    }
  }
);

/* =========================================================
   CARTS
========================================================= */

app.get(
  "/api/carts",
  (req, res) => {
    const data =
      getCarts();

    res.json({
      ok: true,
      count:
        data.length,
      data,
    });
  }
);

app.post(
  "/api/carts",
  async (req, res) => {
    const {
      customerId =
        null,

      totalAmount =
        0,

      status =
        "active",
    } = req.body;

    try {
      const cart =
        createCart({
          customerId,

          totalAmount:
            Number(
              totalAmount
            ),

          status,

          abandonedAt:
            status ===
            "abandoned"
              ? new Date()
                  .toISOString()
              : null,
        });

      if (
        status ===
        "abandoned"
      ) {
        const customer =
          customerId
            ? getCustomerById(
                customerId
              )
            : null;

        const event = {
          id:
            crypto.randomUUID(),

          type:
            "cart.abandoned",

          createdAt:
            new Date()
              .toISOString(),

          payload: {
            customerId,

            customerName:
              customer?.name ||
              null,

            phone:
              customer?.phone ||
              null,

            email:
              customer?.email ||
              null,

            cartId:
              cart.id,

            cartValue:
              Number(
                totalAmount
              ),
          },
        };

        await processEvent(
          event
        );
      }

      res
        .status(201)
        .json({
          ok: true,
          data:
            cart,
        });
    } catch (error) {
      console.error(
        "Create cart error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ساخت سبد خرید.",
        });
    }
  }
);

/* =========================================================
   AUTOMATIONS
========================================================= */

app.get(
  "/api/automations",
  (req, res) => {
    const data =
      getAutomations();

    res.json({
      ok: true,
      count:
        data.length,
      data,
    });
  }
);

app.get(
  "/api/automations/:id",
  (req, res) => {
    const automation =
      getAutomationById(
        req.params.id
      );

    if (!automation) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "اتوماسیون پیدا نشد.",
        });
    }

    res.json({
      ok: true,
      data:
        automation,
    });
  }
);

app.post(
  "/api/automations",
  (req, res) => {
    const {
      title,
      trigger,

      enabled =
        true,

      delayMinutes =
        0,

      conditions =
        [],

      actions =
        [],
    } = req.body;

    if (
      !title ||
      !trigger
    ) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "title و trigger الزامی هستند.",
        });
    }

    try {
      const automation =
        createAutomation({
          title,
          trigger,
          enabled,
          delayMinutes,
          conditions,
          actions,
        });

      res
        .status(201)
        .json({
          ok: true,
          data:
            automation,
        });
    } catch (error) {
      console.error(
        "Create automation error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,
          message:
            "خطا در ساخت اتوماسیون.",
        });
    }
  }
);

app.patch(
  "/api/automations/:id",
  (req, res) => {
    try {
      const automation =
        updateAutomation(
          req.params.id,
          req.body
        );

      if (!automation) {
        return res
          .status(404)
          .json({
            ok: false,
            message:
              "اتوماسیون پیدا نشد.",
          });
      }

      res.json({
        ok: true,
        data:
          automation,
      });
    } catch (error) {
      console.error(
        "Update automation error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,
          message:
            "خطا در ویرایش اتوماسیون.",
        });
    }
  }
);

app.delete(
  "/api/automations/:id",
  (req, res) => {
    try {
      const deleted =
        deleteAutomation(
          req.params.id
        );

      if (!deleted) {
        return res
          .status(404)
          .json({
            ok: false,
            message:
              "اتوماسیون پیدا نشد.",
          });
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "Delete automation error:",
        error
      );

      res
        .status(500)
        .json({
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
      return res
        .status(404)
        .json({
          ok: false,
          message:
            "اتوماسیون پیدا نشد.",
        });
    }

    if (
      !workflow.enabled
    ) {
      return res
        .status(400)
        .json({
          ok: false,
          message:
            "این Workflow متوقف است.",
        });
    }

    const event = {
      id:
        crypto.randomUUID(),

      type:
        workflow.trigger,

      createdAt:
        new Date()
          .toISOString(),

      payload:
        req.body?.payload ||
        {},
    };

    try {
      saveEvent(
        event
      );

      if (
        event.payload
          .customerId
      ) {
        createCustomerEvent({
          customerId:
            event.payload
              .customerId,

          type:
            event.type,

          metadata:
            event.payload,
        });
      }

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
        "Manual workflow execution error:",
        error
      );

      res
        .status(500)
        .json({
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

app.post(
  "/api/events",
  async (req, res) => {
    const {
      type,

      payload =
        {},
    } = req.body;

    if (!type) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "نوع Event الزامی است.",
        });
    }

    const event = {
      id:
        crypto.randomUUID(),

      type,

      payload,

      createdAt:
        new Date()
          .toISOString(),
    };

    try {
      const {
        matchedWorkflows,
        results,
      } =
        await processEvent(
          event
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
        "Process event error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در پردازش Event.",
        });
    }
  }
);

/* =========================================================
   EXECUTIONS
========================================================= */

app.get(
  "/api/executions",
  (req, res) => {
    const limit =
      Number(
        req.query.limit
      ) || 100;

    const data =
      getExecutions(
        limit
      );

    res.json({
      ok: true,
      count:
        data.length,
      data,
    });
  }
);

app.delete(
  "/api/executions",
  (req, res) => {
    try {
      clearExecutions();

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "Clear executions error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در پاک‌کردن تاریخچه.",
        });
    }
  }
);

/* =========================================================
   MARKETING CHANNELS
========================================================= */

app.get(
  "/api/marketing/channels",
  (req, res) => {
    try {
      const data =
        getMarketingChannels();

      res.json({
        ok: true,
        count:
          data.length,
        data,
      });
    } catch (error) {
      console.error(
        "Marketing channels error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت کانال‌های مارکتینگ.",
        });
    }
  }
);

/* =========================================================
   MARKETING PLATFORMS
========================================================= */

app.get(
  "/api/marketing/platforms",
  (req, res) => {
    try {
      const channelId =
        req.query
          .channelId ||
        null;

      const data =
        getMarketingPlatforms(
          channelId
        );

      res.json({
        ok: true,

        count:
          data.length,

        data,
      });
    } catch (error) {
      console.error(
        "Marketing platforms error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت پلتفرم‌های تبلیغاتی.",
        });
    }
  }
);

/* =========================================================
   ADVERTISING SERVICES
========================================================= */

app.get(
  "/api/marketing/services",
  (req, res) => {
    try {
      const platformId =
        req.query
          .platformId ||
        null;

      const data =
        getAdvertisingServices(
          platformId
        );

      res.json({
        ok: true,

        count:
          data.length,

        data,
      });
    } catch (error) {
      console.error(
        "Advertising services error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت سرویس‌های تبلیغاتی.",
        });
    }
  }
);

/* =========================================================
   MARKETING STRUCTURE
========================================================= */

app.get(
  "/api/marketing/structure",
  (req, res) => {
    try {
      const channels =
        getMarketingChannels();

      const platforms =
        getMarketingPlatforms();

      const services =
        getAdvertisingServices();

      const data =
        channels.map(
          (channel) => ({
            ...channel,

            platforms:
              platforms
                .filter(
                  (platform) =>
                    platform.channelId ===
                    channel.id
                )
                .map(
                  (platform) => ({
                    ...platform,

                    services:
                      services.filter(
                        (service) =>
                          service.platformId ===
                          platform.id
                      ),
                  })
                ),
          })
        );

      res.json({
        ok: true,

        count:
          data.length,

        data,
      });
    } catch (error) {
      console.error(
        "Marketing structure error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت ساختار تبلیغات.",
        });
    }
  }
);

/* =========================================================
   MARKETING CAMPAIGNS
========================================================= */

app.get(
  "/api/marketing/campaigns",
  (req, res) => {
    try {
      const data =
        getMarketingCampaigns();

      res.json({
        ok: true,

        count:
          data.length,

        data,
      });
    } catch (error) {
      console.error(
        "Marketing campaigns error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت کمپین‌ها.",
        });
    }
  }
);

/* =========================================================
   CREATE MARKETING CAMPAIGN
========================================================= */

app.post(
  "/api/marketing/campaigns",
  (req, res) => {
    const {
      channelId,
      platformId,

      serviceId =
        null,

      name,

      strategy =
        "acquisition",

      objective =
        null,

      status =
        "draft",

      budget =
        0,

      currency =
        "IRR",

      externalId =
        null,

      startedAt =
        null,

      endedAt =
        null,
    } = req.body;

    if (
      !channelId ||
      !platformId ||
      !name
    ) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "channelId، platformId و name الزامی هستند.",
        });
    }

    try {
      const channels =
        getMarketingChannels();

      const channel =
        channels.find(
          (item) =>
            item.id ===
            channelId
        );

      if (!channel) {
        return res
          .status(400)
          .json({
            ok: false,

            message:
              "کانال تبلیغاتی معتبر نیست.",
          });
      }

      const platforms =
        getMarketingPlatforms(
          channelId
        );

      const platform =
        platforms.find(
          (item) =>
            item.id ===
            platformId
        );

      if (!platform) {
        return res
          .status(400)
          .json({
            ok: false,

            message:
              "پلتفرم انتخاب‌شده متعلق به این کانال نیست.",
          });
      }

      if (
        serviceId
      ) {
        const services =
          getAdvertisingServices(
            platformId
          );

        const service =
          services.find(
            (item) =>
              item.id ===
              serviceId
          );

        if (!service) {
          return res
            .status(400)
            .json({
              ok: false,

              message:
                "سرویس انتخاب‌شده متعلق به این پلتفرم نیست.",
            });
        }
      }

      const campaign =
        createMarketingCampaign({
          channelId,
          platformId,
          serviceId,
          name,
          strategy,
          objective,
          status,

          budget:
            Number(
              budget
            ) || 0,

          currency,
          externalId,
          startedAt,
          endedAt,
        });

      res
        .status(201)
        .json({
          ok: true,
          data:
            campaign,
        });
    } catch (error) {
      console.error(
        "Create marketing campaign error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ساخت کمپین.",
        });
    }
  }
);

/* =========================================================
   CAMPAIGN DETAIL
========================================================= */

app.get(
  "/api/marketing/campaigns/:id",
  (req, res) => {
    try {
      const campaign =
        getCampaignById(
          req.params.id
        );

      if (!campaign) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "کمپین پیدا نشد.",
          });
      }

      const metrics =
        getCampaignMetrics(
          campaign.id
        );

      const kpis =
        calculateCampaignKPIs(
          metrics
        );

      const touchpoints =
        getAttributionTouchpoints({
          campaignId:
            campaign.id,
        });

      res.json({
        ok: true,

        data: {
          campaign,
          metrics,
          kpis,

          attribution: {
            count:
              touchpoints.length,

            touchpoints,
          },
        },
      });
    } catch (error) {
      console.error(
        "Campaign detail error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت جزئیات کمپین.",
        });
    }
  }
);

/* =========================================================
   CAMPAIGN METRICS
========================================================= */

app.get(
  "/api/marketing/campaigns/:id/metrics",
  (req, res) => {
    try {
      const campaign =
        getCampaignById(
          req.params.id
        );

      if (!campaign) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "کمپین پیدا نشد.",
          });
      }

      const data =
        getCampaignMetrics(
          campaign.id
        );

      res.json({
        ok: true,
        count:
          data.length,
        data,
      });
    } catch (error) {
      console.error(
        "Campaign metrics error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت داده کمپین.",
        });
    }
  }
);

app.post(
  "/api/marketing/campaigns/:id/metrics",
  (req, res) => {
    const campaign =
      getCampaignById(
        req.params.id
      );

    if (!campaign) {
      return res
        .status(404)
        .json({
          ok: false,

          message:
            "کمپین پیدا نشد.",
        });
    }

    const {
      metricDate,

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
    } = req.body;

    try {
      const metric =
        saveCampaignMetric({
          campaignId:
            campaign.id,

          metricDate,

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
        });

      const metrics =
        getCampaignMetrics(
          campaign.id
        );

      const kpis =
        calculateCampaignKPIs(
          metrics
        );

      res
        .status(201)
        .json({
          ok: true,

          data: {
            metric,
            kpis,
          },
        });
    } catch (error) {
      console.error(
        "Save campaign metric error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ذخیره متریک‌های کمپین.",
        });
    }
  }
);

/* =========================================================
   CAMPAIGN KPI
========================================================= */

app.get(
  "/api/marketing/campaigns/:id/kpis",
  (req, res) => {
    try {
      const campaign =
        getCampaignById(
          req.params.id
        );

      if (!campaign) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "کمپین پیدا نشد.",
          });
      }

      const metrics =
        getCampaignMetrics(
          campaign.id
        );

      const data =
        calculateCampaignKPIs(
          metrics
        );

      res.json({
        ok: true,
        data,
      });
    } catch (error) {
      console.error(
        "Campaign KPI error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در محاسبه KPI کمپین.",
        });
    }
  }
);

/* =========================================================
   ATTRIBUTION
========================================================= */

app.get(
  "/api/marketing/attribution",
  (req, res) => {
    try {
      const {
        customerId =
          null,

        leadId =
          null,

        campaignId =
          null,
      } = req.query;

      const data =
        getAttributionTouchpoints({
          customerId,
          leadId,
          campaignId,
        });

      res.json({
        ok: true,

        count:
          data.length,

        data,
      });
    } catch (error) {
      console.error(
        "Attribution read error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت Attribution.",
        });
    }
  }
);

app.post(
  "/api/marketing/attribution",
  (req, res) => {
    const {
      customerId =
        null,

      leadId =
        null,

      campaignId =
        null,

      channelId =
        null,

      platformId =
        null,

      serviceId =
        null,

      touchType,

      sessionId =
        null,

      externalClickId =
        null,

      metadata =
        {},

      occurredAt =
        null,
    } = req.body;

    if (!touchType) {
      return res
        .status(400)
        .json({
          ok: false,

          message:
            "touchType الزامی است.",
        });
    }

    try {
      const data =
        createAttributionTouchpoint({
          customerId,
          leadId,
          campaignId,
          channelId,
          platformId,
          serviceId,

          touchType,

          sessionId,

          externalClickId,

          metadata,

          occurredAt:
            occurredAt ||
            new Date()
              .toISOString(),
        });

      res
        .status(201)
        .json({
          ok: true,
          data,
        });
    } catch (error) {
      console.error(
        "Create attribution error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در ثبت Attribution.",
        });
    }
  }
);

/* =========================================================
   MARKETING OVERVIEW
========================================================= */

app.get(
  "/api/marketing/overview",
  (req, res) => {
    try {
      const campaigns =
        getMarketingCampaigns();

      const campaignData =
        campaigns.map(
          (campaign) => {
            const metrics =
              getCampaignMetrics(
                campaign.id
              );

            const kpis =
              calculateCampaignKPIs(
                metrics
              );

            return {
              campaign,
              kpis,
            };
          }
        );

      const totals =
        calculateCampaignKPIs(
          campaignData.map(
            (item) => ({
              spend:
                item.kpis.spend,

              impressions:
                item.kpis.impressions,

              views:
                item.kpis.views,

              clicks:
                item.kpis.clicks,

              sessions:
                item.kpis.sessions,

              leads:
                item.kpis.leads,

              orders:
                item.kpis.orders,

              customers:
                item.kpis.customers,

              conversions:
                item.kpis.conversions,

              revenue:
                item.kpis.revenue,
            })
          )
        );

      res.json({
        ok: true,

        data: {
          campaignsCount:
            campaigns.length,

          totals,

          campaigns:
            campaignData,
        },
      });
    } catch (error) {
      console.error(
        "Marketing overview error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت داشبورد مارکتینگ.",
        });
    }
  }
);

/* =========================================================
   DATABASE STATUS
========================================================= */

app.get(
  "/api/database/status",
  (req, res) => {
    const crm =
      getCRMStats();

    res.json({
      ok: true,

      database:
        "SQLite",

      persistent:
        true,

      customer360:
        true,

      directMessaging:
        true,

      marketing:
        true,

      attribution:
        true,

      crm,

      marketingChannels:
        getMarketingChannels()
          .length,

      marketingPlatforms:
        getMarketingPlatforms()
          .length,

      marketingCampaigns:
        getMarketingCampaigns()
          .length,

      automations:
        getAutomations()
          .length,

      executions:
        getExecutions(
          1000
        ).length,
    });
  }
);

/* =========================================================
   MESSAGING STATUS
========================================================= */

app.get(
  "/api/messaging/status",
  (req, res) => {
    try {
      res.json({
        ok: true,

        data:
          getMessagingStatus(),
      });
    } catch (error) {
      console.error(
        "Messaging status error:",
        error
      );

      res
        .status(500)
        .json({
          ok: false,

          message:
            "خطا در دریافت وضعیت سرویس پیام‌رسانی.",
        });
    }
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res
      .status(404)
      .json({
        ok: false,

        message:
          "API route not found",
      });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  () => {
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
      "Customer 360: READY"
    );

    console.log(
      "Direct Messaging: READY"
    );

    console.log(
      "Marketing Acquisition: READY"
    );

    console.log(
      "Marketing KPI Engine: READY"
    );

    console.log(
      "Attribution Engine: READY"
    );

    console.log(
      "CRM Data Layer: READY"
    );

    console.log(
      "E-commerce Data Layer: READY"
    );

    console.log(
      "Workflow Engine: READY"
    );

    console.log(
      "Messaging Adapter: READY"
    );

    console.log(
      "=========================================="
    );

    console.log("");
  }
);