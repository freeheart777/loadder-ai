import { createSecretResolver } from "./secret-resolver.mjs";

export function createChainedSecretResolver({backends=[],required=[]}={}){
  const chain=backends.filter(x=>typeof x?.get==="function");
  if(chain.length===0)throw new Error("At least one secret backend is required");
  return createSecretResolver({required,getSecret:async name=>{for(const backend of chain){const value=await backend.get(name);if(value!==undefined&&value!==null&&String(value).length>0)return value;}return null;}});
}

export function createEnvSecretBackend(env=process.env){return Object.freeze({kind:"env",external:false,async get(name){return env[name]??null;}});}
export function createExternalSecretBackend({kind="external",fetchSecret}={}){if(typeof fetchSecret!=="function")throw new Error("fetchSecret(name) is required");if(kind==="env")throw new Error("External secret backend kind cannot be env");return Object.freeze({kind,external:true,async get(name){return fetchSecret(String(name));}});}
export function createProductionSecretResolver({backend,required=[]}={}){if(!backend||backend.external!==true||backend.kind==="env"||typeof backend.get!=="function")throw new Error("Production secrets require an external secret backend");const resolver=createSecretResolver({required,getSecret:name=>backend.get(name)});return Object.freeze({kind:backend.kind,externalized:true,get:resolver.get.bind(resolver),assertRequired:resolver.assertRequired.bind(resolver),async health(){try{const result=await resolver.assertRequired();return{ok:true,externalized:true,backend:backend.kind,count:result.count};}catch(e){return{ok:false,externalized:true,backend:backend.kind,errorCode:"REQUIRED_SECRET_MISSING"};}}});}
