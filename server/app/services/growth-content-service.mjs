import { executeAgentTask } from '../../ai/agent/executor.js';
// One bounded invocation of the canonical executor. No fallback or automatic retry.
export function createGrowthContentService({repository,execute=executeAgentTask,timeoutMs=40000}) {
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>40000)throw new Error('Invalid content timeout');
  return Object.freeze({
    async generate(briefId,input,actor) {
      const r=repository.reserve(briefId,input,actor);
      if(r.duplicate)return {candidate:r.candidate,duplicate:true,publishingAuthorized:false};
      const id=r.candidate.id;
      let result;
      if(r.body) result={success:true,answer:r.body,provider:'human',model:'manual-revision'};
      else {
        const controller=new AbortController();
        let timer;
        try {
          result=await Promise.race([
            execute(r.parameters,{signal:controller.signal}),
            new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('CONTENT_DEADLINE'));},timeoutMs);}),
          ]);
        } catch (error) {
          if(error?.code==='AI_PROVIDER_REJECTED')return {candidate:repository.finish(id,{state:'PROVIDER_FAILED',code:'PROVIDER_REJECTED'}),duplicate:false,publishingAuthorized:false};
          // Network errors/timeout cannot prove that the external invocation did not run.
          return {candidate:repository.finish(id,{state:'RECONCILIATION_REQUIRED',code:'PROVIDER_OUTCOME_UNKNOWN'}),duplicate:false,publishingAuthorized:false};
        } finally {clearTimeout(timer);}
      }
      if(result?.success===false)return {candidate:repository.finish(id,{state:'PROVIDER_FAILED',code:'PROVIDER_REJECTED'}),duplicate:false,publishingAuthorized:false};
      const safeLabel=v=>typeof v==='string'&&v.length>0&&v.length<=120&&/^[\w@./:-]+$/.test(v);
      if(result?.success!==true||typeof result?.answer!=='string'||!result.answer.trim()||result.answer.length>12000||!safeLabel(result.provider)||!safeLabel(result.model))return {candidate:repository.finish(id,{state:'VALIDATION_FAILED',code:'OUTPUT_INVALID'}),duplicate:false,publishingAuthorized:false};
      const usage={};
      for(const k of ['inputTokens','outputTokens','totalTokens'])if(Number.isSafeInteger(result.usage?.[k])&&result.usage[k]>=0&&result.usage[k]<=100000)usage[k]=result.usage[k];
      usage.state=Object.keys(usage).length?'REPORTED':'UNKNOWN';
      return {candidate:repository.finish(id,{state:'VALIDATED',body:result.answer.trim(),provider:result.provider,model:result.model,usage,code:'PASS'}),duplicate:false,publishingAuthorized:false};
    },
  });
}
