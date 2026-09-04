import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {migration001Identity} from '../db/migrations/001_identity.mjs';
import {migration042SiteBuilderControlPlane} from '../db/migrations/042_site_builder_control_plane.mjs';
import {migration049EcommerceCore} from '../db/migrations/049_ecommerce_core.mjs';
import {migration072CommerceFinancialLedger} from '../db/migrations/072_commerce_financial_ledger.mjs';
import {getOrderFinancialSummary,reconcileCapturedPayment} from '../app/commerce/v2/financial-ledger.mjs';

function setup(){
  const db=new Database(':memory:');db.pragma('foreign_keys=OFF');migration001Identity.up(db);db.exec('CREATE TABLE IF NOT EXISTS business_context_versions(id TEXT PRIMARY KEY)');migration042SiteBuilderControlPlane.up(db);migration049EcommerceCore.up(db);migration072CommerceFinancialLedger.up(db);db.pragma('foreign_keys=ON');
  const t='2026-09-04T00:00:00.000Z';
  db.prepare('INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('w1','W1','w1','active',t,t);
  db.prepare('INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('s1','w1','Store','STORE','store','PUBLISHED','{}',t,t);
  return db;
}
function insertOrder(db,id='o1',payment='UNPAID',total=2500,currency='USD'){
  const t='2026-09-04T00:01:00.000Z';db.prepare('INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,email,currency,status,payment_status,fulfillment_status,subtotal_minor,discount_minor,shipping_minor,total_minor,shipping_address_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'w1','s1','buyer@example.com',currency,'PENDING',payment,'UNFULFILLED',total,0,0,total,'{}',t,t);
}

test('genuine transition to PAID creates exactly one immutable capture entry',()=>{const db=setup();insertOrder(db);db.prepare("UPDATE ecommerce_orders SET payment_status='PAID',payment_reference='pay-1',updated_at=? WHERE id='o1'").run('2026-09-04T00:02:00.000Z');db.prepare("UPDATE ecommerce_orders SET payment_status='PAID',updated_at=? WHERE id='o1'").run('2026-09-04T00:03:00.000Z');const rows=db.prepare("SELECT * FROM ecommerce_financial_ledger WHERE order_id='o1'").all();assert.equal(rows.length,1);assert.equal(rows[0].id,'ledger:payment-captured:o1');assert.equal(rows[0].amount_minor,2500);assert.equal(rows[0].currency,'USD');assert.throws(()=>db.prepare("UPDATE ecommerce_financial_ledger SET amount_minor=1 WHERE id=?").run(rows[0].id),/immutable/);assert.throws(()=>db.prepare('DELETE FROM ecommerce_financial_ledger WHERE id=?').run(rows[0].id),/immutable/);db.close();});

test('catalog/order mutation after capture does not rewrite historical ledger',()=>{const db=setup();insertOrder(db);db.prepare("UPDATE ecommerce_orders SET payment_status='PAID',updated_at=? WHERE id='o1'").run('2026-09-04T00:02:00.000Z');db.prepare("UPDATE ecommerce_orders SET total_minor=9900,updated_at=? WHERE id='o1'").run('2026-09-04T00:03:00.000Z');const row=db.prepare("SELECT amount_minor FROM ecommerce_financial_ledger WHERE order_id='o1'").get();assert.equal(row.amount_minor,2500);db.close();});

test('rollback removes payment transition and ledger effect together',()=>{const db=setup();insertOrder(db);assert.throws(()=>db.transaction(()=>{db.prepare("UPDATE ecommerce_orders SET payment_status='PAID',updated_at=? WHERE id='o1'").run('2026-09-04T00:02:00.000Z');throw new Error('ROLLBACK');})(),/ROLLBACK/);assert.equal(db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id='o1'").get().payment_status,'UNPAID');assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ecommerce_financial_ledger WHERE order_id='o1'").get().n,0);db.close();});

test('reconciliation repairs a missing capture once and is idempotent',()=>{const db=setup();insertOrder(db,'o1','PAID');const first=reconcileCapturedPayment(db,{workspaceId:'w1',orderId:'o1',now:'2026-09-04T00:04:00.000Z'});const second=reconcileCapturedPayment(db,{workspaceId:'w1',orderId:'o1'});assert.equal(first.status,'repaired');assert.equal(second.status,'already_consistent');assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ecommerce_financial_ledger WHERE order_id='o1'").get().n,1);db.close();});

test('reconciliation flags amount conflict instead of rewriting financial history',()=>{const db=setup();insertOrder(db);db.prepare("UPDATE ecommerce_orders SET payment_status='PAID',updated_at=? WHERE id='o1'").run('2026-09-04T00:02:00.000Z');db.prepare("UPDATE ecommerce_orders SET total_minor=3000 WHERE id='o1'").run();const result=reconcileCapturedPayment(db,{workspaceId:'w1',orderId:'o1'});assert.equal(result.status,'conflict');assert.equal(result.actual.amountMinor,2500);assert.equal(result.expected.amountMinor,3000);assert.equal(db.prepare("SELECT amount_minor FROM ecommerce_financial_ledger WHERE order_id='o1'").get().amount_minor,2500);db.close();});

test('financial summary derives paid/refunded/net from ledger, not mutable order status',()=>{const db=setup();insertOrder(db);db.prepare("UPDATE ecommerce_orders SET payment_status='PAID',updated_at=? WHERE id='o1'").run('2026-09-04T00:02:00.000Z');const summary=getOrderFinancialSummary(db,{workspaceId:'w1',orderId:'o1'});assert.equal(summary.orderTotalMinor,2500);assert.equal(summary.paidMinor,2500);assert.equal(summary.refundedMinor,0);assert.equal(summary.netMinor,2500);db.close();});
