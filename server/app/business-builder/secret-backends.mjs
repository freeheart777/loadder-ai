import { createSecretResolver } from "./secret-resolver.mjs";

export function createChainedSecretResolver({backends=[],required=[]}={}){
  const chain=backends.filter(x=>typeof x?.get==="function");
  if(chain.length===0)throw new Error("At least one secret backend is required");
  return createSecretResolver({required,getSecret:async name=>{for(const backend of chain){const value=await backend.get(name);if(value!==undefined&&value!==null&&String(value).length>0)return value;}return null;}});
}

export function createEnvSecretBackend(env=process.env){return Object.freeze({kind:"env",async get(name){return env[name]??null;}});}
export function createExternalSecretBackend({kind="external",fetchSecret}={}){if(typeof fetchSecret!=="function")throw new Error("fetchSecret(name) is required");return Object.freeze({kind,async get(name){return fetchSecret(String(name));}});}
