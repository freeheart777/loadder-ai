const reasons=["DAMAGED","WRONG_ITEM","NOT_AS_DESCRIBED","SIZE_OR_FIT","CHANGED_MIND","QUALITY_ISSUE","INVENTORY_UNAVAILABLE","OTHER"];
export const returnReasonRegistry=Object.freeze({version:1,list:()=>Object.freeze([...reasons]),has:value=>reasons.includes(value),returnWindowDays:30});
