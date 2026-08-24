const dimensions=[
 {id:"QUALITY",version:1,label:"کیفیت",direction:"INCREASE",metricSources:["BENCHMARK_LAB"],requiredEvidence:["compatibleBenchmark","humanEvaluation"],guardrailRole:"HARD",availability:"LIMITED"},
 {id:"RELIABILITY",version:1,label:"پایداری",direction:"INCREASE",metricSources:["AI_ECONOMY"],requiredEvidence:["successRate","failureTaxonomy"],guardrailRole:"HARD",availability:"LIMITED"},
 {id:"COST",version:1,label:"هزینه",direction:"DECREASE",metricSources:["AI_ECONOMY"],requiredEvidence:["tokens","providerCalls"],guardrailRole:"BALANCE",availability:"AVAILABLE"},
 {id:"LATENCY",version:1,label:"سرعت",direction:"DECREASE",metricSources:["AI_ECONOMY"],requiredEvidence:["boundedLatency"],guardrailRole:"BALANCE",availability:"LIMITED"},
 {id:"SECURITY",version:1,label:"امنیت",direction:"DECREASE",metricSources:["SECURITY_GATES"],requiredEvidence:["critical","high","tenantIsolation","secretScan","authorityTests"],guardrailRole:"STOP_LINE",availability:"LIMITED"},
 {id:"STORAGE",version:1,label:"حجم داده",direction:"DECREASE",metricSources:["DATABASE_STATUS"],requiredEvidence:["bytes","pages","integrity","retention"],guardrailRole:"BALANCE",availability:"AVAILABLE"},
 {id:"USER_OUTCOME",version:1,label:"نتیجه واقعی کاربر",direction:"INCREASE",metricSources:["WORKFLOW_OUTCOMES"],requiredEvidence:["taskCompletion","timeToValue"],guardrailRole:"BALANCE",availability:"UNAVAILABLE"}
];
export const qualityDimensionRegistry=Object.freeze(dimensions.map(Object.freeze));
export const getQualityDimension=id=>qualityDimensionRegistry.find(x=>x.id===id)||null;
