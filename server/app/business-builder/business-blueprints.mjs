export const BUSINESS_BLUEPRINTS = Object.freeze({
  crm: {
    id: "crm",
    name: "Sales CRM",
    keywords: ["crm", "lead", "customer", "sales", "فروش", "مشتری", "سرنخ"],
    entities: [
      { id: "customer", name: "Customer", fields: [
        { id: "name", type: "string", required: true },
        { id: "email", type: "email" },
        { id: "phone", type: "phone" },
        { id: "status", type: "enum", options: ["lead", "active", "inactive"] },
      ] },
      { id: "opportunity", name: "Opportunity", fields: [
        { id: "title", type: "string", required: true },
        { id: "customerId", type: "reference", references: "customer" },
        { id: "value", type: "money" },
        { id: "stage", type: "enum", options: ["new", "qualified", "proposal", "won", "lost"] },
      ] },
      { id: "activity", name: "Activity", fields: [
        { id: "customerId", type: "reference", references: "customer" },
        { id: "kind", type: "enum", options: ["call", "meeting", "email", "note"] },
        { id: "dueAt", type: "datetime" },
        { id: "completed", type: "boolean" },
      ] },
    ],
    relationships: [
      { id: "customer-opportunities", from: "customer", to: "opportunity", type: "one-to-many" },
      { id: "customer-activities", from: "customer", to: "activity", type: "one-to-many" },
    ],
    roles: ["admin", "sales_manager", "salesperson"],
    workflows: ["lead_qualification", "opportunity_pipeline", "follow_up"],
    pages: ["dashboard", "customers", "pipeline", "activities", "reports"],
  },
  inventory: {
    id: "inventory",
    name: "Inventory Management",
    keywords: ["inventory", "warehouse", "stock", "انبار", "موجودی", "کالا"],
    entities: [
      { id: "product", name: "Product", fields: [
        { id: "sku", type: "string", required: true },
        { id: "name", type: "string", required: true },
        { id: "price", type: "money" },
      ] },
      { id: "warehouse", name: "Warehouse", fields: [
        { id: "name", type: "string", required: true },
        { id: "location", type: "string" },
      ] },
      { id: "stock", name: "Stock", fields: [
        { id: "productId", type: "reference", references: "product" },
        { id: "warehouseId", type: "reference", references: "warehouse" },
        { id: "quantity", type: "decimal" },
        { id: "reorderPoint", type: "decimal" },
      ] },
    ],
    relationships: [
      { id: "product-stock", from: "product", to: "stock", type: "one-to-many" },
      { id: "warehouse-stock", from: "warehouse", to: "stock", type: "one-to-many" },
    ],
    roles: ["admin", "operations_manager", "warehouse_operator"],
    workflows: ["stock_adjustment", "low_stock_alert"],
    pages: ["inventory_dashboard", "products", "warehouses", "stock_movements"],
  },
  booking: {
    id: "booking",
    name: "Booking & Scheduling",
    keywords: ["booking", "appointment", "reservation", "رزرو", "نوبت", "قرار"],
    entities: [
      { id: "customer", name: "Customer", fields: [
        { id: "name", type: "string", required: true },
        { id: "phone", type: "phone" },
      ] },
      { id: "service", name: "Service", fields: [
        { id: "name", type: "string", required: true },
        { id: "durationMinutes", type: "integer" },
        { id: "price", type: "money" },
      ] },
      { id: "booking", name: "Booking", fields: [
        { id: "customerId", type: "reference", references: "customer" },
        { id: "serviceId", type: "reference", references: "service" },
        { id: "startsAt", type: "datetime", required: true },
        { id: "status", type: "enum", options: ["pending", "confirmed", "completed", "cancelled"] },
      ] },
    ],
    relationships: [
      { id: "customer-bookings", from: "customer", to: "booking", type: "one-to-many" },
      { id: "service-bookings", from: "service", to: "booking", type: "one-to-many" },
    ],
    roles: ["admin", "scheduler", "staff"],
    workflows: ["booking_confirmation", "booking_reminder"],
    pages: ["calendar", "bookings", "customers", "services"],
  },
});

export function rankBlueprints(intentText = "") {
  const normalized = String(intentText).toLowerCase();
  return Object.values(BUSINESS_BLUEPRINTS)
    .map((blueprint) => ({
      blueprint,
      score: blueprint.keywords.reduce((score, keyword) => score + (normalized.includes(keyword.toLowerCase()) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.blueprint.id.localeCompare(b.blueprint.id));
}
