const IDENTIFIER=/^[a-z][a-z0-9_.-]{0,99}$/;
const SECRET_NAMES=new Set(["password","apikey","api_key","token","accesstoken","refreshtoken","secret","credential","privatekey","authorizationheader"]);
const TYPES=new Set(["string","number","integer","boolean","timestamp","array"]);
const SENSITIVITY=new Set(["PUBLIC","INTERNAL","CONFIDENTIAL","SENSITIVE_PII"]);
const STORAGE=new Set(["TEST_MEMORY","EXTERNAL_ENCRYPTED"]);
const allowed=new Set(["schemaId","schemaVersion","actionType","actionVersion","canonicalizationVersion","allowedFields","requiredFields","fieldTypes","fieldBounds","arrayBounds","normalizationRules","maxSerializedBytes","sensitivityClass","storagePolicy","confirmationRendererId"]);
const plain=value=>value&&typeof value==="object"&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const fail=message=>{throw new ActionInputSchemaError(message);};
export class ActionInputSchemaError extends Error{constructor(message,code="ACTION_INPUT_SCHEMA_INVALID"){super(message);this.name="ActionInputSchemaError";this.code=code;}}
function descriptor(entry){
 if(!plain(entry)||Object.keys(entry).some(key=>!allowed.has(key)))fail("Action input schema contains unsupported fields.");
 for(const key of ["schemaId","actionType","confirmationRendererId"])if(typeof entry[key]!=="string"||!IDENTIFIER.test(entry[key]))fail(`${key} is invalid.`);
 for(const key of ["schemaVersion","actionVersion","canonicalizationVersion"])if(!Number.isInteger(entry[key])||entry[key]<1)fail(`${key} is invalid.`);
 if(!Array.isArray(entry.allowedFields)||!entry.allowedFields.length||new Set(entry.allowedFields).size!==entry.allowedFields.length||entry.allowedFields.some(key=>typeof key!=="string"||!IDENTIFIER.test(key)||SECRET_NAMES.has(key.toLowerCase())))fail("allowedFields are invalid or credential-like.");
 if(!Array.isArray(entry.requiredFields)||entry.requiredFields.some(key=>!entry.allowedFields.includes(key)))fail("requiredFields are invalid.");
 if(!plain(entry.fieldTypes)||Object.keys(entry.fieldTypes).length!==entry.allowedFields.length||entry.allowedFields.some(key=>!TYPES.has(entry.fieldTypes[key])))fail("fieldTypes must explicitly type every safe field.");
 for(const objectName of ["fieldBounds","arrayBounds","normalizationRules"])if(!plain(entry[objectName]))fail(`${objectName} is invalid.`);
 for(const key of entry.allowedFields){const type=entry.fieldTypes[key],bounds=entry.fieldBounds[key],array=entry.arrayBounds[key];if(type==="string"||type==="timestamp"){if(!plain(bounds)||!Number.isInteger(bounds.maxLength)||bounds.maxLength<1||bounds.maxLength>65536)fail(`${key} is unbounded.`);}if(type==="array"){if(!plain(array)||!Number.isInteger(array.maxItems)||array.maxItems<0||array.maxItems>1000||!new Set(["string","number","integer","boolean","timestamp"]).has(array.itemType))fail(`${key} array is unbounded.`);if((array.itemType==="string"||array.itemType==="timestamp")&&(!Number.isInteger(array.maxItemLength)||array.maxItemLength<1))fail(`${key} items are unbounded.`);}}
 if(!Number.isInteger(entry.maxSerializedBytes)||entry.maxSerializedBytes<1||entry.maxSerializedBytes>65536)fail("maxSerializedBytes is invalid.");
 if(!SENSITIVITY.has(entry.sensitivityClass))throw new ActionInputSchemaError("Sensitivity is unsupported.","ACTION_INPUT_SENSITIVITY_UNSUPPORTED");
 if(!STORAGE.has(entry.storagePolicy))fail("Storage policy is unsupported.");
 const ceiling=["PUBLIC","INTERNAL"].includes(entry.sensitivityClass)&&entry.storagePolicy!=="EXTERNAL_ENCRYPTED"?8192:65536;if(entry.maxSerializedBytes>ceiling)fail("Schema exceeds its sensitivity size ceiling.");
 return Object.freeze({...entry,allowedFields:Object.freeze([...entry.allowedFields]),requiredFields:Object.freeze([...entry.requiredFields]),fieldTypes:Object.freeze({...entry.fieldTypes}),fieldBounds:Object.freeze({...entry.fieldBounds}),arrayBounds:Object.freeze({...entry.arrayBounds}),normalizationRules:Object.freeze({...entry.normalizationRules})});
}
export function createActionInputSchemaRegistry(entries=[]){const map=new Map();for(const item of entries.map(descriptor)){const key=`${item.schemaId}@${item.schemaVersion}`;if(map.has(key))fail(`Duplicate schema: ${key}`);map.set(key,item);}return Object.freeze({resolve:(id,version)=>map.get(`${id}@${version}`)||null,list:()=>[...map.values()]});}
export const actionInputSchemaRegistry=createActionInputSchemaRegistry();
