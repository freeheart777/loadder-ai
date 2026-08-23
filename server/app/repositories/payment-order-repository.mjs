import crypto from"node:crypto";
const id=()=>crypto.randomUUID(),map=r=>r&&Object.freeze(Object.fromEntries(Object.entries(r).map(([k,v])=>[k.replace(/_([a-z])/g,(_,x)=>x.toUpperCase()),v])));

export function createPaymentOrderRepository(db){const attempt=x=>map(db.prepare("SELECT * FROM commerce_payment_attempts WHERE public_id=?").get(x)),pending=(ref,tokenHash)=>map(db.prepare("SELECT o.* FROM commerce_pending_orders o JOIN commerce_carts c ON c.id=o.cart_id WHERE o.public_reference=? AND c.token_hash=?").get(ref,tokenHash)),verified=pendingId=>map(db.prepare("SELECT * FROM commerce_verified_payments WHERE pending_order_id=?").get(pendingId)),orderByPending=pendingId=>map(db.prepare("SELECT * FROM commerce_orders WHERE pending_order_id=?").get(pendingId));

 function createAttempt(x){try{const aid=id(),publicId=crypto.randomBytes(18).toString("base64url");
db.prepare("INSERT INTO commerce_payment_attempts(id,public_id,workspace_id,pending_order_id,provider,provider_binding_version,status,requested_amount,currency,idempotency_key,request_hash,created_at,updated_at)VALUES(?,?,?,?,?,?,'CREATED',?,?,?,?,?,?)").run(aid,publicId,x.workspaceId,x.pendingOrderId,x.provider,x.providerVersion,x.amount,x.currency,x.key,x.requestHash,x.now,x.now);
return{value:attempt(publicId),created:true};
}catch(e){const prior=map(db.prepare("SELECT * FROM commerce_payment_attempts WHERE workspace_id=? AND pending_order_id=? AND idempotency_key=?").get(x.workspaceId,x.pendingOrderId,x.key));
if(prior)return{value:prior,created:false};
throw e;
}}
 const authorizationPending=x=>db.prepare("UPDATE commerce_payment_attempts SET status='AUTHORIZATION_PENDING',updated_at=? WHERE id=? AND status='CREATED'").run(x.now,x.id).changes===1,authorizationReady=x=>{db.prepare("UPDATE commerce_payment_attempts SET status='REDIRECT_READY',provider_attempt_reference=?,redirect_url=?,redirect_expires_at=?,updated_at=? WHERE id=? AND status='AUTHORIZATION_PENDING'").run(x.reference,x.redirectUrl,x.expiresAt,x.now,x.id);
return attempt(x.publicId);
},authorizationFailed=x=>{db.prepare("UPDATE commerce_payment_attempts SET status='FAILED',failure_code=?,failed_at=?,updated_at=? WHERE id=? AND status IN('CREATED','AUTHORIZATION_PENDING')").run(x.code,x.now,x.now,x.id);
return attempt(x.publicId);
};

 function returned(x){db.prepare("UPDATE commerce_payment_attempts SET status='RETURNED',updated_at=? WHERE public_id=? AND status IN('REDIRECT_READY','RETURNED')").run(x.now,x.publicId);
return attempt(x.publicId);
}
 function claim(x){const r=db.prepare("UPDATE commerce_payment_attempts SET status='VERIFYING',verification_started_at=?,updated_at=? WHERE public_id=? AND status IN('REDIRECT_READY','RETURNED')").run(x.now,x.now,x.publicId);
return r.changes?attempt(x.publicId):attempt(x.publicId);
}
 function inconclusive(x){db.prepare("UPDATE commerce_payment_attempts SET status=?,failure_code=?,failed_at=?,updated_at=? WHERE id=? AND status='VERIFYING'").run(x.status,x.code,x.status==='FAILED'?x.now:null,x.now,x.id);
return attempt(x.publicId);
}
 function finalize(x){return db.transaction(()=>{const prior=verified(x.pendingOrderId),existingOrder=orderByPending(x.pendingOrderId);
if(prior&&existingOrder)return{payment:prior,order:existingOrder,created:false};
const paymentId=id(),orderId=id();
db.prepare("INSERT INTO commerce_verified_payments(id,workspace_id,payment_attempt_id,pending_order_id,provider,provider_transaction_reference,verified_amount,currency,verified_at,verification_method,verification_version,evidence_fingerprint,provider_result_code,created_at)VALUES(?,?,?,?,?,?,?,?,?,'SERVER_PROVIDER_VERIFY',1,?,?,?)").run(paymentId,x.workspaceId,x.attemptId,x.pendingOrderId,x.provider,x.transactionReference,x.amount,x.currency,x.verifiedAt,x.fingerprint,x.providerCode,x.now);
db.prepare(`INSERT INTO commerce_orders(id,workspace_id,catalog_id,pending_order_id,verified_payment_id,public_reference,status,contact_name,contact_mobile,contact_email,fulfillment_mode,shipping_method,recipient_name,recipient_mobile,province,city,postal_address,postal_code,subtotal,shipping_amount,discount_amount,tax_amount,grand_total,currency,confirmed_at,created_at) SELECT ?,workspace_id,catalog_id,id,?,public_reference,'CONFIRMED',contact_name,contact_mobile,contact_email,fulfillment_mode,shipping_method,recipient_name,recipient_mobile,province,city,postal_address,postal_code,subtotal,shipping_amount,discount_amount,tax_amount,grand_total,currency,?,? FROM commerce_pending_orders WHERE id=?`).run(orderId,paymentId,x.verifiedAt,x.now,x.pendingOrderId);
db.prepare(`INSERT INTO commerce_order_items(id,workspace_id,order_id,source_pending_order_item_id,source_product_id,source_variant_id,product_name,variant_title,sku,variant_attributes_json,unit_price,compare_at_price,quantity,line_total,asset_id,currency,created_at) SELECT lower(hex(randomblob(16))),workspace_id,?,id,source_product_id,source_variant_id,product_name,variant_title,sku,variant_attributes_json,unit_price,compare_at_price,quantity,line_total,asset_id,currency,? FROM commerce_pending_order_items WHERE pending_order_id=?`).run(orderId,x.now,x.pendingOrderId);
db.prepare("UPDATE commerce_payment_attempts SET status='VERIFIED',provider_transaction_reference=?,verified_at=?,failure_code=NULL,updated_at=? WHERE id=? AND status='VERIFYING'").run(x.transactionReference,x.verifiedAt,x.now,x.attemptId);
return{payment:map(db.prepare("SELECT * FROM commerce_verified_payments WHERE id=?").get(paymentId)),order:map(db.prepare("SELECT * FROM commerce_orders WHERE id=?").get(orderId)),created:true};
})();
}
 return Object.freeze({attempt,pending,verified,orderByPending,createAttempt,authorizationPending,authorizationReady,authorizationFailed,returned,claim,inconclusive,finalize,attemptByKey:(workspaceId,pendingOrderId,key)=>map(db.prepare("SELECT * FROM commerce_payment_attempts WHERE workspace_id=? AND pending_order_id=? AND idempotency_key=?").get(workspaceId,pendingOrderId,key)),ownsAttempt:(publicId,tokenHash)=>Boolean(db.prepare("SELECT 1 FROM commerce_payment_attempts a JOIN commerce_pending_orders o ON o.id=a.pending_order_id JOIN commerce_carts c ON c.id=o.cart_id WHERE a.public_id=? AND c.token_hash=?").get(publicId,tokenHash)),eligible:oid=>!db.prepare("SELECT 1 FROM commerce_pending_order_items i LEFT JOIN commerce_products p ON p.id=i.source_product_id LEFT JOIN commerce_product_variants v ON v.id=i.source_variant_id WHERE i.pending_order_id=? AND (p.id IS NULL OR p.status<>'ACTIVE' OR p.availability_status NOT IN('IN_STOCK','PREORDER') OR (i.source_variant_id IS NOT NULL AND (v.id IS NULL OR v.status<>'ACTIVE' OR v.availability_status NOT IN('IN_STOCK','PREORDER')))) LIMIT 1").get(oid),activeAttempts:oid=>db.prepare("SELECT COUNT(*) n FROM commerce_payment_attempts WHERE pending_order_id=? AND status IN('CREATED','AUTHORIZATION_PENDING','REDIRECT_READY','RETURNED','VERIFYING')").get(oid).n,order:ref=>map(db.prepare("SELECT * FROM commerce_orders WHERE public_reference=?").get(ref)),orderItems:oid=>db.prepare("SELECT * FROM commerce_order_items WHERE order_id=? ORDER BY id").all(oid).map(map)});
}
