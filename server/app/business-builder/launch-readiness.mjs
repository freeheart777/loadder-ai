import{evaluateProductionProfile}from"./production-profile.mjs";
const yes=v=>v===true,knownHealthy=v=>v==="healthy"||v==="attention";
export function evaluateLaunchReadiness(input={}){
  const blockers=[],warnings=[],evidence={};
  const profile=evaluateProductionProfile(input.infrastructure||{});evidence.productionProfile=profile;
  if(!profile.ready)blockers.push(...profile.blockers.map(x=>`infra:${x}`));
  const ci=input.ci||{};for(const gate of["serverTests","frontendBuild","securityGate","fastGate"]){evidence[gate]=ci[gate]??null;if(!yes(ci[gate]))blockers.push(`ci:${gate}`);}
  evidence.releaseSha=String(input.releaseSha||"");if(!/^[0-9a-f]{40}$/i.test(evidence.releaseSha))blockers.push("release:exact-sha-required");
  const recovery=input.recovery||{};if(!yes(recovery.migrationCopyVerified))blockers.push("recovery:migration-copy-unverified");if(!yes(recovery.backupVerified))blockers.push("recovery:backup-unverified");if(!yes(recovery.restoreDrillVerified))blockers.push("recovery:restore-drill-unverified");if(!recovery.rollbackRef)blockers.push("release:rollback-ref-missing");
  const operations=input.operations||{};evidence.adminHealth=operations.adminHealth??"unknown";if(!knownHealthy(operations.adminHealth))blockers.push(`operations:health-${operations.adminHealth||"unknown"}`);if(!yes(operations.syntheticHealth))blockers.push("operations:synthetic-health-failed");if(!yes(operations.canaryVerified))blockers.push("operations:canary-unverified");if(!yes(operations.automaticRollbackVerified))blockers.push("operations:auto-rollback-unverified");
  const security=input.security||{};if(!yes(security.tenantIsolation))blockers.push("security:tenant-isolation-unverified");if(!yes(security.secretsExternalized))blockers.push("security:secrets-not-externalized");if(!yes(security.deterministicRuntimeWithoutAi))blockers.push("security:ai-outage-path-unverified");
  const providers=input.providers||{};if(providers.paymentRequired&&!yes(providers.paymentConfigured))blockers.push("provider:payment-required");if(providers.oauthRequired&&!yes(providers.oauthConfigured))blockers.push("provider:oauth-required");if(providers.gitRequired&&!yes(providers.gitConfigured))blockers.push("provider:git-required");
  const publicApps=input.publicApps||{};if(yes(publicApps.enableAtLaunch)){if(!yes(publicApps.acceptanceVerified))blockers.push("public-app:acceptance-unverified");if(!yes(publicApps.rateLimitReady))blockers.push("public-app:rate-limit-unverified");if(!yes(publicApps.sessionBoundaryVerified))blockers.push("public-app:session-boundary-unverified");}else warnings.push("public-apps-disabled-at-launch");
  if(input.infrastructure?.multiInstance&&!yes(input.infrastructure?.distributedRateLimit))blockers.push("infra:distributed-rate-limit-required");
  return Object.freeze({contract:"loadder.launch-readiness.v1",ready:blockers.length===0,blockers:[...new Set(blockers)],warnings:[...new Set(warnings)],evidence});
}
