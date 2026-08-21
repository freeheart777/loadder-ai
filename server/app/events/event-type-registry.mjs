const scalar = (type, options = {}) => ({ type, ...options });

const definitions = [
  ["customer.created", ["system", "user", "integration"], ["customer"], { name: scalar("string", { maxLength: 200 }) }],
  ["lead.created", ["system", "user", "integration", "customer"], ["lead"], { source: scalar("string", { maxLength: 100 }) }],
  ["lead.converted", ["system", "user"], ["lead"], { customerId: scalar("string", { required: true }) }],
  ["page.viewed", ["customer", "anonymous", "system"], ["page"], { path: scalar("string", { required: true, maxLength: 2000 }), title: scalar("string", { maxLength: 500 }) }],
  ["product.viewed", ["customer", "anonymous", "system"], ["product"], { productId: scalar("string", { required: true }), price: scalar("number", { min: 0 }) }],
  ["cart.created", ["customer", "anonymous", "system"], ["cart"], { cartId: scalar("string", { required: true }), totalAmount: scalar("number", { min: 0 }), currency: scalar("string", { maxLength: 10 }) }],
  ["cart.abandoned", ["customer", "anonymous", "system"], ["cart"], { cartId: scalar("string", { required: true }), totalAmount: scalar("number", { required: true, minExclusive: 0 }), currency: scalar("string", { maxLength: 10 }) }],
  ["checkout.started", ["customer", "anonymous", "system"], ["checkout"], { cartId: scalar("string"), totalAmount: scalar("number", { min: 0 }) }],
  ["order.created", ["customer", "system", "integration"], ["order"], { orderId: scalar("string", { required: true }), totalAmount: scalar("number", { required: true, min: 0 }), currency: scalar("string", { maxLength: 10 }) }],
  ["order.completed", ["customer", "system", "integration"], ["order"], { orderId: scalar("string", { required: true }), totalAmount: scalar("number", { required: true, min: 0 }), currency: scalar("string", { maxLength: 10 }) }],
  ["payment.completed", ["customer", "system", "integration"], ["payment"], { paymentId: scalar("string", { required: true }), amount: scalar("number", { required: true, min: 0 }), currency: scalar("string", { maxLength: 10 }) }],
  ["invoice.issued", ["integration", "system", "user"], ["invoice"], { invoiceId: scalar("string", { required: true }), amount: scalar("number", { required: true }), currency: scalar("string", { required: true, maxLength: 10 }), status: scalar("string", { maxLength: 50 }) }],
  ["refund.issued", ["integration", "system"], ["refund"], { refundId: scalar("string", { required: true }), amount: scalar("number", { required: true, min: 0 }), currency: scalar("string", { required: true, maxLength: 10 }) }],
  ["opportunity.created", ["integration", "system", "user"], ["opportunity"], { opportunityId: scalar("string", { required: true }), stage: scalar("string", { maxLength: 100 }), amount: scalar("number") }],
  ["message.sent", ["customer", "user", "system", "automation"], ["message"], { providerMessageId: scalar("string"), direction: scalar("string", { enum: ["outbound"] }) }],
  ["message.replied", ["customer", "user", "system"], ["message"], { providerMessageId: scalar("string"), direction: scalar("string", { enum: ["inbound"] }) }],
  ["campaign.impression", ["anonymous", "customer", "system", "integration"], ["campaign"], { count: scalar("number", { min: 1 }) }],
  ["campaign.click", ["anonymous", "customer", "system", "integration"], ["campaign"], { destination: scalar("string", { maxLength: 2000 }) }],
  ["campaign.conversion", ["customer", "system", "integration"], ["campaign"], { value: scalar("number", { min: 0 }), currency: scalar("string", { maxLength: 10 }) }],
  ["social.post.published", ["user", "system", "integration"], ["social_post"], { platform: scalar("string", { required: true, maxLength: 50 }), postId: scalar("string") }],
  ["social.engagement", ["customer", "anonymous", "system", "integration"], ["social_post"], { engagementType: scalar("string", { required: true, enum: ["like", "comment", "share", "save", "click"] }), count: scalar("number", { min: 1 }) }],
  ["brand.mentioned", ["integration", "system"], ["listening_record"], { provider: scalar("string", { required: true, maxLength: 100 }), canonicalType: scalar("string", { required: true, maxLength: 50 }) }],
  ["competitor.mentioned", ["integration", "system"], ["listening_record"], { provider: scalar("string", { required: true, maxLength: 100 }), canonicalType: scalar("string", { required: true, maxLength: 50 }) }],
  ["product.mentioned", ["integration", "system"], ["listening_record"], { provider: scalar("string", { required: true, maxLength: 100 }), canonicalType: scalar("string", { required: true, maxLength: 50 }) }],
  ["review.published", ["integration", "system"], ["review"], { rating: scalar("number", { min: 0 }), ratingScale: scalar("number", { minExclusive: 0 }), provider: scalar("string", { required: true, maxLength: 100 }) }],
  ["social.engagement_observed", ["integration", "system"], ["listening_record"], { total: scalar("number", { required: true, min: 0 }), provider: scalar("string", { required: true, maxLength: 100 }) }],
  ["news.reference_observed", ["integration", "system"], ["listening_record"], { provider: scalar("string", { required: true, maxLength: 100 }), canonicalType: scalar("string", { required: true, maxLength: 50 }) }],
  ["automation.executed", ["automation", "system"], ["automation"], { automationId: scalar("string", { required: true }), executionId: scalar("string", { required: true }), result: scalar("string", { enum: ["completed", "failed", "skipped"] }) }],
];

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateProperty(name, value, rule) {
  if (value === undefined) {
    if (rule.required) throw new Error(`Event property ${name} is required.`);
    return;
  }
  if (typeof value !== rule.type || (rule.type === "number" && !Number.isFinite(value))) {
    throw new Error(`Event property ${name} must be ${rule.type}.`);
  }
  if (rule.maxLength && value.length > rule.maxLength) throw new Error(`Event property ${name} is too long.`);
  if (rule.min !== undefined && value < rule.min) throw new Error(`Event property ${name} is below its minimum.`);
  if (rule.minExclusive !== undefined && value <= rule.minExclusive) throw new Error(`Event property ${name} must be greater than ${rule.minExclusive}.`);
  if (rule.enum && !rule.enum.includes(value)) throw new Error(`Event property ${name} is invalid.`);
}

export function createEventTypeRegistry(entries = definitions) {
  const registry = new Map(entries.map(([eventType, actorTypes, subjectTypes, properties]) => [eventType, Object.freeze({
    eventType,
    eventVersion: 1,
    requiredFields: Object.freeze(["occurredAt", "sourceType", "subjectType", "subjectId", "properties"]),
    optionalFields: Object.freeze(["actorType", "actorId", "sourceId", "channel", "campaignId", "customerId", "sessionId", "correlationId", "causationId", "idempotencyKey", "metadata"]),
    allowedActorTypes: Object.freeze(actorTypes),
    allowedSubjectTypes: Object.freeze(subjectTypes),
    properties: Object.freeze(properties),
  })]));
  return Object.freeze({
    get(eventType) { return registry.get(eventType) || null; },
    list() { return [...registry.values()]; },
    validate(eventType, input) {
      const definition = registry.get(eventType);
      if (!definition) throw new Error("Unknown canonical event type.");
      if (!plainObject(input.properties)) throw new Error("Event properties must be an object.");
      if (!plainObject(input.metadata ?? {})) throw new Error("Event metadata must be an object.");
      if (input.actorType && !definition.allowedActorTypes.includes(input.actorType)) throw new Error("Actor type is not allowed for this event.");
      if (!definition.allowedSubjectTypes.includes(input.subjectType)) throw new Error("Subject type is not allowed for this event.");
      const unknown = Object.keys(input.properties).filter((key) => !Object.hasOwn(definition.properties, key));
      if (unknown.length) throw new Error(`Unknown event properties: ${unknown.join(", ")}.`);
      for (const [name, rule] of Object.entries(definition.properties)) validateProperty(name, input.properties[name], rule);
      if (JSON.stringify(input.properties).length > 32_000 || JSON.stringify(input.metadata ?? {}).length > 16_000) {
        throw new Error("Event payload is too large.");
      }
      return definition;
    },
  });
}

export const eventTypeRegistry = createEventTypeRegistry();
