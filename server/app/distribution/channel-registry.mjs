const FAMILIES = new Set(["SEARCH","SOCIAL","MARKETPLACE","CLASSIFIED","MESSAGING","REFERRAL","DIRECT","OWNED_WEB"]);
const MODES = new Set(["PAID","ORGANIC","OWNED","EARNED","REFERRAL","DIRECT"]);
const DEFAULT = [
  ["search", "SEARCH", ["PAID","ORGANIC"]],
  ["social", "SOCIAL", ["PAID","ORGANIC","EARNED"]],
  ["marketplace", "MARKETPLACE", ["PAID","ORGANIC","REFERRAL"]],
  ["classified", "CLASSIFIED", ["PAID","ORGANIC"]],
  ["messaging", "MESSAGING", ["PAID","OWNED"]],
  ["referral", "REFERRAL", ["REFERRAL","EARNED"]],
  ["direct", "DIRECT", ["DIRECT"]],
  ["owned_web", "OWNED_WEB", ["OWNED","ORGANIC"]],
].map(([channelId,channelFamily,allowedAcquisitionModes])=>({channelId,channelVersion:1,channelFamily,allowedAcquisitionModes}));

function definition(input){
  if(!input||Object.keys(input).some(k=>!["channelId","channelVersion","channelFamily","allowedAcquisitionModes"].includes(k))||
    typeof input.channelId!=="string"||!/^[a-z][a-z0-9_]{0,79}$/.test(input.channelId)||!Number.isInteger(input.channelVersion)||input.channelVersion<1||
    !FAMILIES.has(input.channelFamily)||!Array.isArray(input.allowedAcquisitionModes)||!input.allowedAcquisitionModes.length||
    input.allowedAcquisitionModes.some(mode=>!MODES.has(mode))||new Set(input.allowedAcquisitionModes).size!==input.allowedAcquisitionModes.length) throw new Error("Channel definition is invalid.");
  return Object.freeze({...input,allowedAcquisitionModes:Object.freeze([...input.allowedAcquisitionModes])});
}
export function createChannelRegistry(entries=DEFAULT){const items=entries.map(definition),map=new Map(items.map(item=>[`${item.channelId}@${item.channelVersion}`,item]));if(map.size!==items.length)throw new Error("Duplicate channel definition.");return Object.freeze({get:(id,version)=>map.get(`${id}@${version}`)||null,list:()=>Object.freeze([...items])});}
export const channelRegistry=createChannelRegistry();
export const DISTRIBUTION_ACQUISITION_MODES=Object.freeze([...MODES]);
