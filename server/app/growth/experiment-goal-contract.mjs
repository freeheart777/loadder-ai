export class ExperimentAuthoringError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const invalid = () => { throw new ExperimentAuthoringError("EXPERIMENT_GOAL_INVALID"); };
const fields = (v, names) => { if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some(k => !names.includes(k))) invalid(); };
const text = (v, max=200) => typeof v === "string" && v.trim() && v.length<=max ? v.trim() : invalid();
const amount = v => Number.isSafeInteger(v) && v>=0 ? v : invalid();
const timestamp = v => {
  if (typeof v!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString()!==v) invalid();
  return v;
};
export function normalizeExperimentGoal(input) {
  fields(input,["decisionId","contextVersionId","goalRef","goalContractVersion","goalContract","hypothesis","treatment","supersedesExperimentId"]);
  if(input.goalContractVersion!==1 || typeof input.goalRef!=="string" || !/^\/strategy\/goals\/(0|[1-9]\d{0,3})$/.test(input.goalRef)) invalid();
  const g=input.goalContract;
  fields(g,["metric","direction","target","unit","measurementWindow","baseline"]);
  if(!["lead_count","order_count","revenue_minor"].includes(g.metric) || !["INCREASE","DECREASE"].includes(g.direction)) invalid();
  if(g.metric==="revenue_minor" ? typeof g.unit!=="string" || !/^[A-Z]{3}$/.test(g.unit) : g.unit!=="COUNT") invalid();
  fields(g.measurementWindow,["start","end"]);
  const start=timestamp(g.measurementWindow.start),end=timestamp(g.measurementWindow.end);
  if(end<=start || Date.parse(end)-Date.parse(start)>366*86400000) invalid();
  fields(g.baseline,["state","value","provenance"]);
  let baseline;
  if(g.baseline.state==="UNKNOWN") {
    if(Object.keys(g.baseline).length!==1) invalid();
    baseline={state:"UNKNOWN"};
  } else if(g.baseline.state==="EVIDENCED") {
    fields(g.baseline.provenance,["evidenceLinkId"]);
    baseline={state:"EVIDENCED",value:amount(g.baseline.value),provenance:{evidenceLinkId:text(g.baseline.provenance.evidenceLinkId)}};
  } else invalid();
  return {decisionId:text(input.decisionId),contextVersionId:text(input.contextVersionId),goalRef:input.goalRef,
    goalContract:{metric:g.metric,direction:g.direction,target:amount(g.target),unit:g.unit,measurementWindow:{start,end},baseline},
    hypothesis:text(input.hypothesis,4000),treatment:text(input.treatment,8000),supersedesExperimentId:input.supersedesExperimentId==null?null:text(input.supersedesExperimentId)};
}
