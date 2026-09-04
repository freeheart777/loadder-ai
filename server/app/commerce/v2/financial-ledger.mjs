const required=(value,name)=>{const v=String(value??'').trim();if(!v)throw new TypeError(`${name} is required`);return v};

export function listLedgerEntries(db,{workspaceId,orderId=null,entryType=null,limit=100}={}){
  const workspace=required(workspaceId,'workspaceId');
  const safeLimit=Math.max(1,Math.min(Number(limit)||100,500));
  const where=['workspace_id=?'];const args=[workspace];
  if(orderId){where.push('order_id=?');args.push(required(orderId,'orderId'));}
  if(entryType){where.push('entry_type=?');args.push(required(entryType,'entryType').toUpperCase());}
  return db.prepare(`SELECT id,workspace_id AS workspaceId,site_project_id AS siteProjectId,order_id AS orderId,source_type AS sourceType,source_id AS sourceId,entry_type AS entryType,amount_minor AS amountMinor,currency,occurred_at AS occurredAt,metadata_json AS metadataJson,created_at AS createdAt FROM ecommerce_financial_ledger WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC,id DESC LIMIT ?`).all(...args,safeLimit).map(row=>({...row,metadata:JSON.parse(row.metadataJson||'{}')}));
}

export function getOrderFinancialSummary(db,{workspaceId,orderId}={}){
  const workspace=required(workspaceId,'workspaceId');const order=required(orderId,'orderId');
  const source=db.prepare(`SELECT id,workspace_id AS workspaceId,site_project_id AS siteProjectId,currency,total_minor AS orderTotalMinor,payment_status AS paymentStatus FROM ecommerce_orders WHERE workspace_id=? AND id=?`).get(workspace,order);
  if(!source)return null;
  const sums=db.prepare(`SELECT COALESCE(SUM(CASE WHEN entry_type='PAYMENT_CAPTURED' THEN amount_minor ELSE 0 END),0) AS paidMinor,COALESCE(SUM(CASE WHEN entry_type='REFUND' THEN ABS(amount_minor) ELSE 0 END),0) AS refundedMinor FROM ecommerce_financial_ledger WHERE workspace_id=? AND order_id=?`).get(workspace,order);
  return {...source,paidMinor:sums.paidMinor,refundedMinor:sums.refundedMinor,netMinor:sums.paidMinor-sums.refundedMinor};
}

export function reconcileCapturedPayment(db,{workspaceId,orderId,now=new Date().toISOString()}={}){
  const workspace=required(workspaceId,'workspaceId');const order=required(orderId,'orderId');
  const source=db.prepare(`SELECT id,workspace_id,site_project_id,currency,total_minor,payment_status,payment_reference,payment_provider,subtotal_minor,discount_minor,shipping_minor,updated_at FROM ecommerce_orders WHERE workspace_id=? AND id=?`).get(workspace,order);
  if(!source)return {status:'missing_order'};
  if(source.payment_status!=='PAID')return {status:'not_paid'};
  const existing=db.prepare(`SELECT id,amount_minor,currency FROM ecommerce_financial_ledger WHERE workspace_id=? AND source_type='ORDER_PAYMENT' AND source_id=? AND entry_type='PAYMENT_CAPTURED'`).get(workspace,order);
  if(existing){
    if(existing.amount_minor!==source.total_minor||existing.currency!==source.currency)return {status:'conflict',entryId:existing.id,expected:{amountMinor:source.total_minor,currency:source.currency},actual:{amountMinor:existing.amount_minor,currency:existing.currency}};
    return {status:'already_consistent',entryId:existing.id};
  }
  const id=`ledger:payment-captured:${order}`;
  db.prepare(`INSERT OR IGNORE INTO ecommerce_financial_ledger(id,workspace_id,site_project_id,order_id,source_type,source_id,entry_type,amount_minor,currency,occurred_at,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,workspace,source.site_project_id,order,'ORDER_PAYMENT',order,'PAYMENT_CAPTURED',source.total_minor,source.currency,source.updated_at||now,JSON.stringify({paymentReference:source.payment_reference,paymentProvider:source.payment_provider,subtotalMinor:source.subtotal_minor,discountMinor:source.discount_minor,shippingMinor:source.shipping_minor,totalMinor:source.total_minor,paymentStatus:source.payment_status,reconciled:true}),now);
  const inserted=db.prepare(`SELECT id,amount_minor,currency FROM ecommerce_financial_ledger WHERE workspace_id=? AND source_type='ORDER_PAYMENT' AND source_id=? AND entry_type='PAYMENT_CAPTURED'`).get(workspace,order);
  return {status:'repaired',entryId:inserted.id};
}
