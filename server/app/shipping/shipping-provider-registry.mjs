const entries=[
 {id:"MANUAL",adapterVersion:1,capabilities:["CREATE","TRACK"],configurationRequirements:[],availability:"AVAILABLE"},
 {id:"TEST",adapterVersion:1,capabilities:["CREATE","TRACK"],configurationRequirements:[],availability:"TEST_ONLY"},
 {id:"TIPAX",adapterVersion:1,capabilities:["CREATE","TRACK"],configurationRequirements:["APPROVED_CURRENT_API_CONTRACT","MANAGED_CREDENTIALS"],availability:"BLOCKED_EXTERNAL_VALIDATION"},
 {id:"IRAN_POST",adapterVersion:1,capabilities:[],configurationRequirements:["APPROVED_CURRENT_API_CONTRACT","MANAGED_CREDENTIALS"],availability:"UNAVAILABLE"},
 {id:"TAPIN",adapterVersion:1,capabilities:[],configurationRequirements:["APPROVED_CURRENT_API_CONTRACT","MANAGED_CREDENTIALS"],availability:"UNAVAILABLE"},
].map((entry)=>Object.freeze({...entry,capabilities:Object.freeze(entry.capabilities),configurationRequirements:Object.freeze(entry.configurationRequirements)}));
export const shippingProviderRegistry=Object.freeze({version:1,list:()=>Object.freeze([...entries]),get:id=>entries.find(entry=>entry.id===id)||null,supports:(id,capability)=>Boolean(entries.find(entry=>entry.id===id)?.capabilities.includes(capability))});
