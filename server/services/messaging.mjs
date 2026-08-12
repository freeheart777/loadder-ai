export async function sendMessage({
  channel,
  recipient,
  message,
  metadata = {},
}) {
  if (!recipient) {
    return {
      ok: false,
      status: "skipped",
      reason: "recipient_missing",
    };
  }

  switch (channel) {
    case "sms":
      return sendSMS({
        recipient,
        message,
        metadata,
      });

    case "email":
      return sendEmail({
        recipient,
        message,
        metadata,
      });

    default:
      return {
        ok: false,
        status: "unsupported",
        reason: `Unsupported channel: ${channel}`,
      };
  }
}

async function sendSMS({
  recipient,
  message,
  metadata,
}) {
  console.log("");
  console.log("========== LOADDER SMS ==========");
  console.log("TO:", recipient);
  console.log("MESSAGE:", message);
  console.log("METADATA:", metadata);
  console.log("=================================");
  console.log("");

  return {
    ok: true,
    provider: "loadder-simulator",
    channel: "sms",
    recipient,
    status: "simulated",
    sentAt: new Date().toISOString(),
  };
}

async function sendEmail({
  recipient,
  message,
  metadata,
}) {
  console.log("");
  console.log("========= LOADDER EMAIL =========");
  console.log("TO:", recipient);
  console.log("MESSAGE:", message);
  console.log("METADATA:", metadata);
  console.log("=================================");
  console.log("");

  return {
    ok: true,
    provider: "loadder-simulator",
    channel: "email",
    recipient,
    status: "simulated",
    sentAt: new Date().toISOString(),
  };
}