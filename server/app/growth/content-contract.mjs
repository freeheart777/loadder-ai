import { createHash } from 'node:crypto';
export class GrowthContentError extends Error {
  constructor(code, status=400) { super(code); this.code=code; this.status=status; }
}
export const fail = (code, status=400) => { throw new GrowthContentError(code,status); };
export function fields(value, allowed) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k))) fail('CONTENT_CONTRACT_INVALID');
}
export const text = (v,max=200) => typeof v==='string' && v.trim() && v.length<=max ? v.trim() : fail('CONTENT_CONTRACT_INVALID');
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function briefInput(input) {
  fields(input,['experimentId','contextVersionId','goalRef','audience','message','channel','contentType','constraints','offer','predecessorId','idempotencyKey']);
  const constraints=input.constraints ?? [];
  if (!Array.isArray(constraints) || constraints.length>10) fail('CONTENT_CONTRACT_INVALID');
  if (!['instagram','reel','blog','banner','story','sms'].includes(input.contentType)) fail('CONTENT_CONTRACT_INVALID');
  let offer=null;
  if(input.offer!=null) { fields(input.offer,['type','index']); if(input.offer.type!=='CONTEXT_OFFERING' || !Number.isSafeInteger(input.offer.index) || input.offer.index<0 || input.offer.index>999) fail('CONTENT_OFFER_INVALID'); offer={type:input.offer.type,index:input.offer.index}; }
  return {experimentId:text(input.experimentId),contextVersionId:text(input.contextVersionId),goalRef:text(input.goalRef),audience:text(input.audience,1000),message:text(input.message,2000),channel:text(input.channel,80),contentType:input.contentType,constraints:constraints.map(x=>text(x,300)),offer,predecessorId:input.predecessorId==null?null:text(input.predecessorId),idempotencyKey:text(input.idempotencyKey)};
}
export function pageInput(input={}) {
  fields(input,['page','pageSize']);
  const page=Number(input.page??1),pageSize=Number(input.pageSize??25);
  if(!Number.isSafeInteger(page)||page<1||page>10000||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100) fail('CONTENT_PAGE_INVALID');
  return {page,pageSize};
}
