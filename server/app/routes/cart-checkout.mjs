import express from"express";
import{CartCheckoutError}from"../services/cart-checkout-service.mjs";
export function createCartCheckoutRouter({service}){const r=express.Router(),token=q=>q.headers["x-cart-token"],key=q=>q.headers["idempotency-key"],run=(s,fn,status=200)=>{try{const x=fn();
return s.status(x.reusedResult?200:status).json({success:true,...x});
}catch(e){const status=e instanceof CartCheckoutError?e.status:500,code=e instanceof CartCheckoutError?e.code:"CHECKOUT_INVALID";
return s.status(status).json({success:false,code,message:"Commerce checkout operation could not be completed."});
}},bounded=(q,s,n)=>JSON.stringify(q.body||{}).length>16384?s.status(413).json({success:false,code:"COMMERCE_BODY_TOO_LARGE",message:"Commerce checkout operation could not be completed."}):n();
const windows=new Map(),limited=(q,s,n)=>{const now=Date.now(),id=String(q.ip||q.socket.remoteAddress||"unknown"),prior=windows.get(id);if(!prior||prior.until<=now)windows.set(id,{count:1,until:now+60000});else if(++prior.count>120)return s.status(429).json({success:false,code:"COMMERCE_RATE_LIMITED",message:"Commerce checkout operation could not be completed."});if(windows.size>10000)for(const[k,v]of windows)if(v.until<=now)windows.delete(k);return n();};
r.use((q,s,n)=>limited(q,s,n));

r.get("/api/public/commerce/shipping",(_q,s)=>run(s,()=>service.shipping()));
r.post("/api/public/commerce/cart",(q,s)=>bounded(q,s,()=>run(s,()=>service.createCart(q.body),201)));
r.get("/api/public/commerce/cart",(q,s)=>run(s,()=>service.getCart(token(q))));
r.post("/api/public/commerce/cart/items",(q,s)=>bounded(q,s,()=>run(s,()=>service.addItem(token(q),q.body),201)));
r.patch("/api/public/commerce/cart/items/:id",(q,s)=>bounded(q,s,()=>run(s,()=>service.updateItem(token(q),q.params.id,q.body))));
r.post("/api/public/commerce/checkouts",(q,s)=>bounded(q,s,()=>run(s,()=>service.createCheckout(token(q),q.body,key(q)),201)));
r.patch("/api/public/commerce/checkouts/:id",(q,s)=>bounded(q,s,()=>run(s,()=>service.updateCheckout(token(q),q.params.id,q.body))));
r.post("/api/public/commerce/checkouts/:id/confirm",(q,s)=>bounded(q,s,()=>run(s,()=>service.confirm(token(q),q.params.id,q.body,key(q)),201)));
r.get("/api/public/commerce/orders/:ref",(q,s)=>run(s,()=>service.getOrder(token(q),q.params.ref)));
return r;
}
