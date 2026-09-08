const LIMIT=25,GOAL_LIMIT=25;

export function createBusinessStateService({businessProfileService,businessContextService,experimentRepository,recommendationRepository,contentRepository,now=()=>new Date()}) {
  function getSnapshot({workspace,actor}) {
    const profile=businessProfileService.getBusinessProfile();
    const current=businessContextService.getCurrentState();
    const experiments=experimentRepository.listOpen(LIMIT);
    const recommendations=recommendationRepository.listUndecided(LIMIT);
    const content=contentRepository.listOperationalState(actor,LIMIT);
    const goals=Array.isArray(current.activeContext?.snapshot?.strategy?.goals)
      ? current.activeContext.snapshot.strategy.goals.slice(0,GOAL_LIMIT).map((label,index)=>({ref:`/strategy/goals/${index}`,label:String(label).slice(0,200)})) : [];
    const generatedAt=now().toISOString();
    return {contractVersion:1,workspace:{id:workspace.id,name:workspace.name||null},
      business:profile?{profileId:profile.id,name:profile.name||null,industry:profile.industry||null}:null,
      context:{contextVersionId:current.activeContext?.id||null,isStale:Boolean(current.isStale),generatedAt},goals,
      experiments:{open:experiments.items.map(item=>({id:item.id,status:item.status,contextVersionId:item.contextVersionId||null,goalRef:item.goalRef||null})),truncated:experiments.truncated},
      recommendations:{undecidedIds:recommendations.items,truncated:recommendations.truncated},
      content:{pendingCandidateIds:content.pending.ids,reconciliationRequiredIds:content.reconciliationRequired.ids,
        truncated:content.pending.truncated||content.reconciliationRequired.truncated},freshness:{generatedAt}};
  }
  return Object.freeze({getSnapshot});
}

export const BUSINESS_STATE_LIMITS=Object.freeze({goals:GOAL_LIMIT,openExperiments:LIMIT,undecidedRecommendations:LIMIT,pendingCandidates:LIMIT,reconciliationCandidates:LIMIT});
