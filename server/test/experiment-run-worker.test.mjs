import test from "node:test";
import assert from "node:assert/strict";
import { createExperimentRunWorker } from "../app/workers/experiment-run-worker.mjs";

test("worker claims a run and completes it", async () => {
  const calls=[];
  const run={id:"run-1",status:"RUNNING"};
  const runService={claim(id,o){calls.push(["claim",id,o]);return run;},complete(id,o){calls.push(["complete",id,o]);return {...run,status:"COMPLETED",outcome:o.outcome};},fail(){throw new Error("unexpected");}};
  const worker=createExperimentRunWorker({runService,executor:async ({input})=>({value:input.value})});
  const result=await worker.process({runId:"run-1",contextVersionId:"ctx-1",input:{value:42}});
  assert.equal(result.status,"COMPLETED"); assert.deepEqual(result.outcome,{value:42}); assert.equal(calls.length,2);
});

test("worker converts executor crashes into failed runs", async () => {
  const run={id:"run-2",status:"RUNNING"}; let failed;
  const runService={claim:()=>run,complete:()=>{throw new Error("unexpected");},fail:(id,o)=>{failed={id,...o};return {...run,status:"FAILED"};}};
  const worker=createExperimentRunWorker({runService,executor:async()=>{throw new Error("provider crashed");}});
  const result=await worker.process({runId:"run-2",contextVersionId:"ctx-2"});
  assert.equal(result.status,"FAILED"); assert.equal(failed.outcome.executionError.message,"provider crashed");
});
