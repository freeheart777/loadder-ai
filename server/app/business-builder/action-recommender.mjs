export function recommendLoadderActions({intelligence}){
  const actions=[];
  for(const alert of intelligence?.alerts||[]){
    if(intelligence.kind==="inventory"&&alert.entityId==="stock")actions.push({id:`reorder-${alert.recordId}`,kind:"draft",title:"پیشنهاد سفارش مجدد",description:"برای این موجودی یک پیش‌نویس اقدام خرید بساز.",risk:"medium",requiresApproval:true,target:{entityId:alert.entityId,recordId:alert.recordId},executor:"procurement-draft"});
    if(intelligence.kind==="crm"&&alert.entityId==="activity")actions.push({id:`followup-${alert.recordId}`,kind:"draft",title:"آماده‌سازی پیگیری فروش",description:"برای پیگیری عقب‌افتاده متن و اقدام بعدی پیشنهاد بده.",risk:"low",requiresApproval:true,target:{entityId:alert.entityId,recordId:alert.recordId},executor:"sales-followup-draft"});
    if(intelligence.kind==="booking"&&alert.entityId==="booking")actions.push({id:`reminder-${alert.recordId}`,kind:"draft",title:"یادآوری رزرو",description:"یادآوری رزرو را آماده کن؛ ارسال بدون تایید انجام نمی‌شود.",risk:"low",requiresApproval:true,target:{entityId:alert.entityId,recordId:alert.recordId},executor:"booking-reminder-draft"});
  }
  return actions.slice(0,8);
}
export function executeOwnedActionDraft({action,record}){
  if(!action?.requiresApproval)throw new Error("Only governed draft actions are supported.");
  if(action.executor==="procurement-draft")return {status:"draft",title:"پیش‌نویس سفارش مجدد",payload:{stockId:record?.id,quantity:record?.reorderPoint||null},next:"human-approval"};
  if(action.executor==="sales-followup-draft")return {status:"draft",title:"پیش‌نویس پیگیری فروش",payload:{activityId:record?.id,message:"پیگیری این فعالیت عقب‌افتاده است؛ لطفاً وضعیت مشتری و اقدام بعدی را بررسی کنید."},next:"human-approval"};
  if(action.executor==="booking-reminder-draft")return {status:"draft",title:"پیش‌نویس یادآوری رزرو",payload:{bookingId:record?.id,startsAt:record?.startsAt||null,message:"یادآوری رزرو شما آماده ارسال است."},next:"human-approval"};
  throw new Error("Unsupported action executor.");
}
