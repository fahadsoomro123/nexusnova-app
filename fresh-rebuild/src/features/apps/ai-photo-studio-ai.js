const SAFE_ACTIONS=new Set(['set-background','set-text','set-color','set-font-size','move','resize','rotate','duplicate','delete','align','bring-front','send-back']);

export function buildDesignAssistantPrompt(command,design){
  return `You are NexusNova Design Assistant. Convert the user's design instruction into JSON actions only. Allowed actions: ${[...SAFE_ACTIONS].join(', ')}. Never invent unsupported assets or claim an edit succeeded. Current design summary: ${JSON.stringify({width:design?.width,height:design?.height,elements:(design?.elements||[]).map(x=>({id:x.id,type:x.type,text:x.text||'',locked:!!x.locked}))}).slice(0,5000)}. User instruction: ${String(command||'').slice(0,1000)}`;
}

export function normaliseDesignActions(value){
  const rows=Array.isArray(value)?value:Array.isArray(value?.actions)?value.actions:[];
  return rows.filter(x=>x&&SAFE_ACTIONS.has(x.action)).slice(0,30).map(x=>({...x,action:String(x.action),target:x.target?String(x.target):undefined}));
}

export function imageGenerationCapability(){
  return {
    enabled:false,
    reason:'No approved zero-cost commercial-safe image generation backend is configured.',
    requiresExplicitBillingApproval:true
  };
}
