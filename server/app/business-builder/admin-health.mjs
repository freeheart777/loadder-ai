import{requireWorkspaceId}from"../tenant-context.mjs";
export function createBusinessBuilderAdminHealth(db){
  const safeCount=(source,sql,...args)=>{try{return{source,value:Number(db.prepare(sql).get(...args)?.c||0),known:true};}catch(error){if(String(error?.code||"")==="SQLITE_ERROR")return{source,value:null,known:false};throw error;}};
  return Object.freeze({summary(){
    const w=requireWorkspaceId(),at=new Date().toISOString();
    const checks=[
      safeCount("deployments","SELECT COUNT(*) c FROM business_builder_deployments WHERE workspace_id=? AND status IN ('failed','rolled_back','blocked')",w),
      safeCount("actions","SELECT COUNT(*) c FROM business_builder_action_ledger WHERE workspace_id=? AND status='drafted'",w),
      safeCount("appUsers","SELECT COUNT(*) c FROM business_builder_app_users WHERE workspace_id=? AND status='disabled'",w),
      safeCount("invites","SELECT COUNT(*) c FROM business_builder_app_invites WHERE workspace_id=? AND consumed_at IS NULL AND expires_at < ?",w,at),
      safeCount("payments","SELECT COUNT(*) c FROM business_builder_payment_events WHERE workspace_id=?",w),
      safeCount("files","SELECT COUNT(*) c FROM business_builder_files WHERE workspace_id=? AND deleted_at IS NULL",w),
      safeCount("git","SELECT COUNT(*) c FROM business_builder_git_sync_events WHERE workspace_id=? AND status='failed'",w),
      safeCount("collaboration","SELECT COUNT(*) c FROM business_builder_collaboration_events WHERE workspace_id=?",w),
      safeCount("commerceOutboxPending","SELECT COUNT(*) c FROM business_builder_commerce_outbox WHERE workspace_id=? AND status='pending' AND last_error IS NULL AND dead_lettered_at IS NULL",w),
      safeCount("commerceOutboxRetrying","SELECT COUNT(*) c FROM business_builder_commerce_outbox WHERE workspace_id=? AND status='pending' AND last_error IS NOT NULL AND dead_lettered_at IS NULL",w),
      safeCount("commerceOutboxDeadLetter","SELECT COUNT(*) c FROM business_builder_commerce_outbox WHERE workspace_id=? AND dead_lettered_at IS NOT NULL",w),
      safeCount("commerceOutboxDelivered","SELECT COUNT(*) c FROM business_builder_commerce_outbox WHERE workspace_id=? AND status='delivered'",w)
    ];
    const by=Object.fromEntries(checks.map(x=>[x.source,x.value])),unknownSources=checks.filter(x=>!x.known).map(x=>x.source);
    const failedDeployments=by.deployments,pendingActions=by.actions,disabledAppUsers=by.appUsers,expiredInvites=by.invites,paymentEvents=by.payments,files=by.files,gitFailures=by.git,collaborationEvents=by.collaboration,commerceOutboxPending=by.commerceOutboxPending,commerceOutboxRetrying=by.commerceOutboxRetrying,commerceOutboxDeadLetter=by.commerceOutboxDeadLetter,commerceOutboxDelivered=by.commerceOutboxDelivered;
    const incidents=[...(Number(failedDeployments)>0?[{code:"DEPLOYMENT_FAILURE",severity:"high",count:failedDeployments}]:[]),...(Number(gitFailures)>0?[{code:"GIT_SYNC_FAILURE",severity:"medium",count:gitFailures}]:[]),...(Number(commerceOutboxDeadLetter)>0?[{code:"COMMERCE_OUTBOX_DEAD_LETTER",severity:"high",count:commerceOutboxDeadLetter}]:[]),...(Number(commerceOutboxRetrying)>0?[{code:"COMMERCE_OUTBOX_RETRYING",severity:"high",count:commerceOutboxRetrying}]:[]),...(Number(expiredInvites)>0?[{code:"EXPIRED_INVITES",severity:"low",count:expiredInvites}]:[])];
    const status=incidents.some(x=>x.severity==="high")?"degraded":incidents.length?"attention":unknownSources.length?"unknown":"healthy";
    return{status,incidents,unknownSources,counters:{failedDeployments,pendingActions,disabledAppUsers,expiredInvites,paymentEvents,files,gitFailures,collaborationEvents,commerceOutboxPending,commerceOutboxRetrying,commerceOutboxDeadLetter,commerceOutboxDelivered}};
  }});
}
