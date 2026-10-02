import { getMessagingStatus, sendMessage } from "../../services/messaging.mjs";

// Production must fail closed: the messaging layer reports the simulator as
// "configured" everywhere, which is acceptable for development only.
export function otpDeliveryConfigured({ nodeEnv = "development", status = getMessagingStatus() } = {}) {
  const sms = status?.sms || {};
  if (nodeEnv === "production") return sms.provider !== "simulator" && sms.configured === true;
  return sms.configured === true;
}

export const smsOtpDelivery = async ({ mobile, code }) => {
  await sendMessage({ channel: "sms", recipient: mobile, message: `کد ورود شما: ${code}` });
};
