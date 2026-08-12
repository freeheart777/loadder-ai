import { Resend } from "resend";

/* =========================================================
   ENV
========================================================= */

const {
  SMS_PROVIDER = "simulator",
  KAVENEGAR_API_KEY,

  EMAIL_PROVIDER = "simulator",
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  RESEND_FROM_NAME = "Loadder AI",
} = process.env;

/* =========================================================
   HELPERS
========================================================= */

function now() {
  return new Date().toISOString();
}

function safeString(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function normalizeIranPhone(phone) {
  if (!phone) {
    return null;
  }

  let value = String(phone)
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "");

  if (value.startsWith("+98")) {
    value = `0${value.slice(3)}`;
  }

  if (value.startsWith("0098")) {
    value = `0${value.slice(4)}`;
  }

  if (value.startsWith("98") && value.length === 12) {
    value = `0${value.slice(2)}`;
  }

  return value;
}

function htmlEscape(value) {
  return safeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function messageToHtml(message) {
  return htmlEscape(message)
    .replace(/\n/g, "<br />");
}

/* =========================================================
   SIMULATOR
========================================================= */

async function simulateMessage({
  channel,
  recipient,
  message,
  metadata = {},
}) {
  return {
    ok: true,

    provider:
      "loadder-simulator",

    channel,
    recipient,
    message,

    status:
      "simulated",

    sentAt:
      now(),

    metadata,
  };
}

/* =========================================================
   KAVENEGAR SMS
========================================================= */

async function sendKavenegarSMS({
  recipient,
  message,
  metadata = {},
}) {
  if (!KAVENEGAR_API_KEY) {
    throw new Error(
      "KAVENEGAR_API_KEY is not configured."
    );
  }

  const phone =
    normalizeIranPhone(
      recipient
    );

  if (!phone) {
    throw new Error(
      "SMS recipient is missing."
    );
  }

  const url =
    `https://api.kavenegar.com/v1/${encodeURIComponent(
      KAVENEGAR_API_KEY
    )}/sms/send.json`;

  const body =
    new URLSearchParams();

  body.set(
    "receptor",
    phone
  );

  body.set(
    "message",
    message
  );

  const response =
    await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body,
    });

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.return?.message ||
        `Kavenegar HTTP ${response.status}`
    );
  }

  const entry =
    Array.isArray(
      data?.entries
    )
      ? data.entries[0]
      : null;

  return {
    ok: true,

    provider:
      "kavenegar",

    channel:
      "sms",

    recipient:
      phone,

    status:
      "sent",

    sentAt:
      now(),

    providerMessageId:
      entry?.messageid
        ? String(
            entry.messageid
          )
        : null,

    providerStatus:
      entry?.status ?? null,

    providerStatusText:
      entry?.statustext ??
      null,

    cost:
      entry?.cost ?? null,

    metadata,

    raw: data,
  };
}

/* =========================================================
   RESEND EMAIL
========================================================= */

async function sendResendEmail({
  recipient,
  message,
  subject,
  metadata = {},
}) {
  if (!RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not configured."
    );
  }

  if (!RESEND_FROM_EMAIL) {
    throw new Error(
      "RESEND_FROM_EMAIL is not configured."
    );
  }

  if (!recipient) {
    throw new Error(
      "Email recipient is missing."
    );
  }

  const resend =
    new Resend(
      RESEND_API_KEY
    );

  const {
    data,
    error,
  } =
    await resend.emails.send({
      from:
        `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,

      to: [
        recipient,
      ],

      subject:
        subject ||
        "پیام از Loadder",

      html:
        `
          <div
            dir="rtl"
            style="
              font-family: Arial, sans-serif;
              line-height: 2;
              font-size: 15px;
            "
          >
            ${messageToHtml(
              message
            )}
          </div>
        `,
    });

  if (error) {
    throw new Error(
      error.message ||
        "Resend email failed."
    );
  }

  return {
    ok: true,

    provider:
      "resend",

    channel:
      "email",

    recipient,

    status:
      "sent",

    sentAt:
      now(),

    providerMessageId:
      data?.id ??
      null,

    metadata,
  };
}

/* =========================================================
   SMS ROUTER
========================================================= */

async function sendSMS({
  recipient,
  message,
  metadata = {},
}) {
  switch (
    SMS_PROVIDER.toLowerCase()
  ) {
    case "kavenegar":
      return sendKavenegarSMS({
        recipient,
        message,
        metadata,
      });

    case "simulator":
    default:
      return simulateMessage({
        channel: "sms",
        recipient,
        message,
        metadata,
      });
  }
}

/* =========================================================
   EMAIL ROUTER
========================================================= */

async function sendEmail({
  recipient,
  message,
  subject,
  metadata = {},
}) {
  switch (
    EMAIL_PROVIDER.toLowerCase()
  ) {
    case "resend":
      return sendResendEmail({
        recipient,
        message,
        subject,
        metadata,
      });

    case "simulator":
    default:
      return simulateMessage({
        channel:
          "email",

        recipient,

        message,

        metadata,
      });
  }
}

/* =========================================================
   PUBLIC ADAPTER
========================================================= */

export async function sendMessage({
  channel,
  recipient,
  message,
  subject = null,
  metadata = {},
}) {
  if (!channel) {
    throw new Error(
      "Messaging channel is required."
    );
  }

  if (!recipient) {
    throw new Error(
      "Messaging recipient is required."
    );
  }

  if (
    !message ||
    !String(message).trim()
  ) {
    throw new Error(
      "Messaging content is required."
    );
  }

  const normalizedChannel =
    String(channel)
      .toLowerCase()
      .trim();

  if (
    normalizedChannel ===
    "sms"
  ) {
    return sendSMS({
      recipient,
      message:
        String(message).trim(),
      metadata,
    });
  }

  if (
    normalizedChannel ===
    "email"
  ) {
    return sendEmail({
      recipient,
      message:
        String(message).trim(),

      subject:
        subject ||
        "پیام از Loadder",

      metadata,
    });
  }

  throw new Error(
    `Unsupported messaging channel: ${normalizedChannel}`
  );
}

/* =========================================================
   PROVIDER STATUS
========================================================= */

export function getMessagingStatus() {
  return {
    sms: {
      provider:
        SMS_PROVIDER,

      configured:
        SMS_PROVIDER ===
        "simulator"
          ? true
          : SMS_PROVIDER ===
              "kavenegar"
            ? Boolean(
                KAVENEGAR_API_KEY
              )
            : false,
    },

    email: {
      provider:
        EMAIL_PROVIDER,

      configured:
        EMAIL_PROVIDER ===
        "simulator"
          ? true
          : EMAIL_PROVIDER ===
              "resend"
            ? Boolean(
                RESEND_API_KEY &&
                  RESEND_FROM_EMAIL
              )
            : false,
    },
  };
}