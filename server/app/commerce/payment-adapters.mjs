import { zarinpalPaymentProvider } from "./zarinpal-payment-provider.mjs";

// Gateway adapters by ecommerce_payment_providers.provider_key. Shared by checkout and activation.
export const paymentAdapters = Object.freeze({ ZARINPAL: zarinpalPaymentProvider });
