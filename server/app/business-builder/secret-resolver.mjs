export function createSecretResolver({getSecret,required=[]}={}){
  if(typeof getSecret!=="function")throw new Error("getSecret(name) is required");
  const requiredSet=new Set(required.map(String));
  return Object.freeze({
    async get(name,{required=requiredSet.has(String(name))}={}){const value=await getSecret(String(name));if(required&&(value===undefined||value===null||String(value).length===0))throw new Error(`Required secret missing: ${name}`);return value??null;},
    async assertRequired(){for(const name of requiredSet)await this.get(name,{required:true});return{ok:true,count:requiredSet.size};}
  });
}
export function createEnvSecretResolver({env=process.env,required=[]}={}){return createSecretResolver({required,getSecret:async name=>env[name]});}
