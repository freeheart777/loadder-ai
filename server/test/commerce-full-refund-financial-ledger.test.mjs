import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration042SiteBuilderControlPlane } from "../db/migrations/042_site_builder_control_plane.mjs";
import { migration049EcommerceCore } from "../db/migrations/049_ecommerce_core.mjs";
import { migration072CommerceFinancialLedger } from "../db/migrations/072_commerce_financial_ledger.mjs";
import { migration078CommerceFullRefundFinancialLedger } from "../db/migrations/078_commerce_full_refund_financial_ledger.mjs";
import { getOrderFinancialSummary } from "../app/commerce/v2/financial-ledger.mjs";

function setup() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=OFF");
  migration001Identity.up(db);
  db.exec("CREATE TABLE IF NOT EXISTS business_context_versions(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY)");
  migration042SiteBuilderControlPlane.up(db);
  migration049EcommerceCore.up(db);
  migration072CommerceFinancialLedger.up(db);
  migration078CommerceFullRefundFinancialLedger.up(db);
  db.pragma("foreign_keys=ON");
  const t = "2026-09-05T00:00:00.000Z";
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("w1","W1","w1","active",t,t);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run("s1","w1","Store","STORE","store","PUBLISHED","{}",t,t);
  db.prepare("INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,email,currency,status,payment_status,fulfillment_status,subtotal_minor,discount_minor,shipping_minor,total_minor,shipping_address_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("o1","w1","s1","buyer@example.com","USD","CONFIRMED","UNPAID","UNFULFILLED",2500,0,0,2500,"{}",t,t);
  return db;
}

test("full refund transition records an immutable reversing ledger entry exactly once", () => {
  const db = setup();
  db.prepare("UPDATE ecommerce_orders SET payment_status='PAID',payment_reference='pay-1',updated_at=? WHERE id='o1'").run("2026-09-05T00:01:00.000Z");
  db.prepare("UPDATE ecommerce_orders SET payment_status='REFUNDED',updated_at=? WHERE id='o1'").run("2026-09-05T00:02:00.000Z");
  db.prepare("UPDATE ecommerce_orders SET payment_status='REFUNDED',updated_at=? WHERE id='o1'").run("2026-09-05T00:03:00.000Z");

  const rows = db.prepare("SELECT id,entry_type,amount_minor FROM ecommerce_financial_ledger WHERE order_id='o1' ORDER BY occurred_at").all();
  assert.deepEqual(rows.map(({ id, entry_type, amount_minor }) => ({ id, entry_type, amount_minor })), [
    { id: "ledger:payment-captured:o1", entry_type: "PAYMENT_CAPTURED", amount_minor: 2500 },
    { id: "ledger:payment-refunded:o1", entry_type: "REFUND", amount_minor: -2500 },
  ]);
  const summary = getOrderFinancialSummary(db, { workspaceId: "w1", orderId: "o1" });
  assert.equal(summary.paidMinor, 2500);
  assert.equal(summary.refundedMinor, 2500);
  assert.equal(summary.netMinor, 0);
  assert.throws(() => db.prepare("UPDATE ecommerce_financial_ledger SET amount_minor=0 WHERE id='ledger:payment-refunded:o1'").run(), /immutable/);
  db.close();
});

test("refund ledger effect rolls back with the payment transition", () => {
  const db = setup();
  db.prepare("UPDATE ecommerce_orders SET payment_status='PAID',updated_at=? WHERE id='o1'").run("2026-09-05T00:01:00.000Z");
  assert.throws(() => db.transaction(() => {
    db.prepare("UPDATE ecommerce_orders SET payment_status='REFUNDED',updated_at=? WHERE id='o1'").run("2026-09-05T00:02:00.000Z");
    throw new Error("ROLLBACK_REFUND");
  })(), /ROLLBACK_REFUND/);
  assert.equal(db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id='o1'").get().payment_status, "PAID");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ecommerce_financial_ledger WHERE order_id='o1' AND entry_type='REFUND'").get().n, 0);
  db.close();
});
