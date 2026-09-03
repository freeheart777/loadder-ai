export const LOADDER_PERFORMANCE_BUDGET=Object.freeze({
  builderCompileMs:150,
  navigatorMs:25,
  runtimeReadP95Ms:250,
  runtimeWriteP95Ms:350,
  publishReadinessMs:100,
  aiTokensForDeterministicBuild:0,
  idleDedicatedComputePerTenant:false,
});
export function evaluatePerformanceBudget(metrics={}){const checks=[
  {id:"compile",ok:Number(metrics.builderCompileMs||0)<=LOADDER_PERFORMANCE_BUDGET.builderCompileMs,actual:Number(metrics.builderCompileMs||0),budget:LOADDER_PERFORMANCE_BUDGET.builderCompileMs},
  {id:"navigator",ok:Number(metrics.navigatorMs||0)<=LOADDER_PERFORMANCE_BUDGET.navigatorMs,actual:Number(metrics.navigatorMs||0),budget:LOADDER_PERFORMANCE_BUDGET.navigatorMs},
  {id:"read-p95",ok:Number(metrics.runtimeReadP95Ms||0)<=LOADDER_PERFORMANCE_BUDGET.runtimeReadP95Ms,actual:Number(metrics.runtimeReadP95Ms||0),budget:LOADDER_PERFORMANCE_BUDGET.runtimeReadP95Ms},
  {id:"write-p95",ok:Number(metrics.runtimeWriteP95Ms||0)<=LOADDER_PERFORMANCE_BUDGET.runtimeWriteP95Ms,actual:Number(metrics.runtimeWriteP95Ms||0),budget:LOADDER_PERFORMANCE_BUDGET.runtimeWriteP95Ms},
  {id:"deterministic-token-cost",ok:Number(metrics.aiTokensForDeterministicBuild||0)===0,actual:Number(metrics.aiTokensForDeterministicBuild||0),budget:0},
];return{pass:checks.every(c=>c.ok),checks,violations:checks.filter(c=>!c.ok)};}
