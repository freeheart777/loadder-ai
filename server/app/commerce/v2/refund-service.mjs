import crypto from "node:crypto";
import { requireWorkspaceId } from "../../tenant-context.mjs";

export class RefundPersistenceError extends Error {
  constructor(message, code = "REFUND_PERSISTENCE_ERROR", status = 400) {
    super(message);
    this.name = "RefundPersistenceError";
    this.code = code;
    this.status = status;
  }
}

const statuses = new Set(["REQUESTED","APPROVED","REJECTED","PROCESSING","SUCCEEDED","FAILED","CANCELLED"]);
const transitions = Object.freeze({
  REQUESTED: new Set(["APPROVED","REJECTED","CANCELLED"]),
  APPROVED: new Set(["PROCESSING","CANCELLED"]),
  PROCESSING: new Set(["SUCCEEDED","FAILED"]),
  FAILED: new Set(["PROCESSING","CANCELLED"]),
  REJECTED: new Set(),
  CANCELLED: new Set(),
  SUCCEEDED: new Set(),
});
const positiveInt=(value,name)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw new RefundPersistenceError(`${name} must be a positive integer.`,"REFUND_AMOUNT_INVALID");return n;};
const text=(value,max=500)=>String(value??"").trim().slice(0,max);
const parse=(value)=>{try{return JSON.parse(value||"{}");}catch{return{};}};

function map(row){return row?{
  id:row.id,workspaceId:row.workspace_id,siteProjectId:row.site_project_id,orderId:row.order_id,returnId:row.return_id,
  status:row.status,amountMinor:row.amount_minor,currency:row.currency,provider:row.provider,providerReference:row.provider_reference,
  reason:row.reason,metadata:parse(row.metadata_json),createdAt:row.created_at,updatedAt:row.updated_at,succeededAt:row.succeeded_at,failedAt:row.failed_at,
}:null;}

export function createRefundService({db,clock=()=>new Date().toISOString()}={}){
  if(!db)throw new RefundPersistenceError("Database is required.","REFUND_DATABASE_REQUIRED",500);
  const workspaceId=()=>requireWorkspaceId();
  const getOrder=(orderId)=>db.prepare("SELECT * FROM ecommerce_orders WHERE id=? AND workspace_id=?").get(orderId,workspaceId())||null;
  const getRow=(refundId)=>db.prepare("SELECT * FROM ecommerce_refunds WHERE id=? AND workspace_id=?").get(refundId,workspaceId())||null;
  const requireRefund=(refundId)=>{const row=getRow(refundId);if(!row)throw new RefundPersistenceError("Refund not found.","REFUND_NOT_FOUND",404);return row;};
  const reserved=(orderId)=>Number(db.prepare("SELECT COALESCE(SUM(amount_minor),0) total FROM ecommerce_refunds WHERE workspace_id=? AND order_id=? AND status IN('REQUESTED','APPROVED','PROCESSING','SUCCEEDED')").get(workspaceId(),orderId)?.total||0);

  return Object.freeze({
    list(orderId){
      if(!getOrder(orderId))throw new RefundPersistenceError("Order not found.","REFUND_ORDER_NOT_FOUND",404);
      return db.prepare("SELECT * FROM ecommerce_refunds WHERE workspace_id=? AND order_id=? ORDER BY created_at DESC,id DESC").all(workspaceId(),orderId).map(map);
    },
    get(refundId){return map(requireRefund(refundId));},
    create(orderId,input={}){
      const order=getOrder(orderId);if(!order)throw new RefundPersistenceError("Order not found.","REFUND_ORDER_NOT_FOUND",404);
      const amount=positiveInt(input.amountMinor,"amountMinor");
      if(order.payment_status!=="PAID"&&order.payment_status!=="PARTIALLY_REFUNDED")throw new RefundPersistenceError("Only paid orders can be refunded.","REFUND_ORDER_NOT_PAID",409);
      if(reserved(orderId)+amount>Number(order.total_minor))throw new RefundPersistenceError("Refund amount exceeds remaining captured amount.","REFUND_AMOUNT_EXCEEDS_REMAINING",409);
      const at=clock(),refundId=`refund_${crypto.randomUUID()}`;
      db.prepare(`INSERT INTO ecommerce_refunds(id,workspace_id,site_project_id,order_id,return_id,status,amount_minor,currency,provider,provider_reference,reason,metadata_json,created_at,updated_at)
        VALUES(?,?,?,?,?,'REQUESTED',?,?,?,?,?,?,?,?)`).run(refundId,workspaceId(),order.site_project_id,order.id,input.returnId||null,amount,order.currency,text(input.provider,100)||order.payment_provider||null,null,text(input.reason,1000)||null,JSON.stringify(input.metadata&&typeof input.metadata==="object"?input.metadata:{}),at,at);
      return map(getRow(refundId));
    },
    transition(refundId,nextStatus,input={}){
      const row=requireRefund(refundId),next=text(nextStatus,40).toUpperCase();
      if(!statuses.has(next))throw new RefundPersistenceError("Unsupported refund status.","REFUND_STATUS_INVALID");
      if(!transitions[row.status]?.has(next))throw new RefundPersistenceError(`Refund cannot transition from ${row.status} to ${next}.`,"REFUND_TRANSITION_INVALID",409);
      const at=clock(),providerReference=next==="SUCCEEDED"?text(input.providerReference,300):row.provider_reference;
      if(next==="SUCCEEDED"&&!providerReference)throw new RefundPersistenceError("providerReference is required for a succeeded refund.","REFUND_PROVIDER_REFERENCE_REQUIRED");
      db.prepare(`UPDATE ecommerce_refunds SET status=?,provider=COALESCE(?,provider),provider_reference=COALESCE(?,provider_reference),updated_at=?,succeeded_at=CASE WHEN ?='SUCCEEDED' THEN ? ELSE succeeded_at END,failed_at=CASE WHEN ?='FAILED' THEN ? ELSE failed_at END WHERE id=? AND workspace_id=?`)
        .run(next,text(input.provider,100)||null,providerReference||null,at,next,at,next,at,refundId,workspaceId());
      const updated=map(getRow(refundId));
      if(next==="SUCCEEDED"){
        const totals=db.prepare("SELECT COALESCE(SUM(amount_minor),0) refunded FROM ecommerce_refunds WHERE workspace_id=? AND order_id=? AND status='SUCCEEDED'").get(workspaceId(),row.order_id);
        const order=getOrder(row.order_id);const refunded=Number(totals?.refunded||0);const paymentStatus=refunded>=Number(order.total_minor)?"REFUNDED":"PARTIALLY_REFUNDED";
        db.prepare("UPDATE ecommerce_orders SET payment_status=?,updated_at=? WHERE id=? AND workspace_id=?").run(paymentStatus,at,row.order_id,workspaceId());
      }
      return updated;
    },
  });
}
