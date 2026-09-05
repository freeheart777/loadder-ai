const requiredProviders=["postgres","externalSecrets","objectStorage","oauth"];
const requiredUx=["dashboardEntry","builderOnboarding","previewQuality","publicApp"];
const requiredStaging=["stagingEnvironment","monitoring","rollback"];
const bool=v=>v===true;
export function evaluateBetaReadiness({providers={},ux={},acceptance={},staging={}}={}){
  const sections={
    providers:{label:"Production providers",checks:requiredProviders.map(id=>({id,passed:bool(providers[id])}))},
    ux:{label:"Onboarding and product UX",checks:requiredUx.map(id=>({id,passed:bool(ux[id])}))},
    acceptance:{label:"Real business acceptance",checks:[{id:"crm",passed:bool(acceptance.crm)},{id:"booking",passed:bool(acceptance.booking)},{id:"customerPortal",passed:bool(acceptance.customerPortal)}]},
    staging:{label:"Beta staging operations",checks:requiredStaging.map(id=>({id,passed:bool(staging[id])}))},
  };
  const blockers=[];let passed=0,total=0;
  for(const [section,data] of Object.entries(sections))for(const check of data.checks){total++;if(check.passed)passed++;else blockers.push(`${section}.${check.id}`);}
  return Object.freeze({ready:blockers.length===0,stage:blockers.length===0?"beta-ready":"beta-blocked",passed,total,progress:Math.round((passed/total)*100),blockers,sections});
}
export function betaReadinessFromEnvironment(env=process.env){
  const on=name=>String(env[name]||"").toLowerCase()==="true";
  return evaluateBetaReadiness({
    providers:{postgres:on("BETA_POSTGRES_READY"),externalSecrets:on("BETA_EXTERNAL_SECRETS_READY"),objectStorage:on("BETA_OBJECT_STORAGE_READY"),oauth:on("BETA_OAUTH_READY")},
    ux:{dashboardEntry:true,builderOnboarding:true,previewQuality:true,publicApp:true},
    acceptance:{crm:true,booking:true,customerPortal:true},
    staging:{stagingEnvironment:on("BETA_STAGING_READY"),monitoring:on("BETA_MONITORING_READY"),rollback:on("BETA_ROLLBACK_READY")},
  });
}
