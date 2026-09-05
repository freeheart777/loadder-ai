export async function evaluateProductionSmoke({databaseHealth,secretHealth,readiness,backupHealth,latencyBudgetMs=500}={}){
  const checks=[];
  async function run(id,label,fn){try{const value=await fn();const ok=value===true||value?.ok===true;checks.push({id,label,ok,detail:ok?value:null});}catch(error){checks.push({id,label,ok:false,detail:error?.message||String(error)});}}
  await run("database","Database reachable",async()=>{const h=await databaseHealth();return{ok:!!h?.ok&&Number(h.latencyMs||0)<=latencyBudgetMs,latencyMs:h?.latencyMs};});
  await run("secrets","Required secrets available",async()=>secretHealth());
  checks.push({id:"readiness",label:"Application publish readiness",ok:!!readiness?.ready,detail:readiness?.blockers||null});
  await run("backup","Backup/restore health verified",async()=>backupHealth());
  const blockers=checks.filter(x=>!x.ok);
  return{ok:blockers.length===0,status:blockers.length===0?"healthy":"blocked",checks,blockers};
}
