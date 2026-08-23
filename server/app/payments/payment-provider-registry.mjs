const blocked="BLOCKED_EXTERNAL_VALIDATION";
const providers=[
 {provider:"TEST",version:1,production:false,availability:"AVAILABLE",liveValidationStatus:null},
 {provider:"ZARINPAL",version:1,production:true,availability:"UNAVAILABLE",liveValidationStatus:null},
 {provider:"DIRECT_PSP",version:1,production:true,availability:"UNAVAILABLE",liveValidationStatus:null},
 {provider:"OTHER_IRANIAN_GATEWAY",version:1,production:true,availability:"UNAVAILABLE",liveValidationStatus:null},
 {provider:"TOROB_PAY",version:1,production:true,availability:blocked,liveValidationStatus:"TOROB_PAY_LIVE_VALIDATION_BLOCKED_EXTERNAL"},
 {provider:"SNAPP_PAY",version:1,production:true,availability:blocked,liveValidationStatus:"SNAPP_PAY_LIVE_VALIDATION_BLOCKED_EXTERNAL"},
 {provider:"DIGIPAY",version:1,production:true,availability:blocked,liveValidationStatus:"DIGIPAY_LIVE_VALIDATION_BLOCKED_EXTERNAL"},
].map(Object.freeze);
export const paymentProviderRegistry=Object.freeze({version:1,list:()=>Object.freeze(providers),get:id=>providers.find(x=>x.provider===id)||null});
