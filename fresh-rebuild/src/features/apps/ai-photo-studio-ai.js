const SAFE_ACTIONS=new Set(['set-background','set-text','set-color','set-font-size','move','resize','rotate','duplicate','delete','align','bring-front','send-back']);
const IMAGE_ENDPOINT=''; // Intentionally empty until a zero-charge backend deployment is verified.

export function buildDesignAssistantPrompt(command,design){
  return `You are NexusNova Design Assistant. Convert the user's design instruction into JSON actions only. Allowed actions: ${[...SAFE_ACTIONS].join(', ')}. Never invent unsupported assets or claim an edit succeeded. Current design summary: ${JSON.stringify({width:design?.width,height:design?.height,elements:(design?.elements||[]).map(x=>({id:x.id,type:x.type,text:x.text||'',locked:!!x.locked}))}).slice(0,5000)}. User instruction: ${String(command||'').slice(0,1000)}`;
}

export function normaliseDesignActions(value){const rows=Array.isArray(value)?value:Array.isArray(value?.actions)?value.actions:[];return rows.filter(x=>x&&SAFE_ACTIONS.has(x.action)).slice(0,30).map(x=>({...x,action:String(x.action),target:x.target?String(x.target):undefined}))}

export function imageGenerationCapability(){
  return {
    enabled:Boolean(IMAGE_ENDPOINT),provider:IMAGE_ENDPOINT?'cloudflare-workers-ai':null,endpoint:IMAGE_ENDPOINT||null,
    model:IMAGE_ENDPOINT?'@cf/black-forest-labs/flux-1-schnell':null,
    reason:IMAGE_ENDPOINT?'Ready':'AI image backend is not activated because the Cloudflare billing plan has not been verified as zero-charge.',
    requiresExplicitBillingApproval:!IMAGE_ENDPOINT
  };
}

export async function generateAiImage(prompt,{aspect='1:1',style='auto',signal}={}){
  const cap=imageGenerationCapability();if(!cap.enabled)throw new Error(cap.reason);
  const text=String(prompt||'').trim();if(text.length<3)throw new Error('Describe the image you want to create.');if(text.length>900)throw new Error('Prompt is too long.');
  const response=await fetch(cap.endpoint,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({prompt:text,aspect:String(aspect||'1:1'),style:String(style||'auto')}),signal});
  let payload=null;try{payload=await response.json()}catch{}
  if(!response.ok)throw new Error(payload?.error||`Image generation failed (${response.status}).`);
  const dataUrl=payload?.dataUrl||payload?.image||'';if(!/^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl))throw new Error('Generator returned an invalid image.');
  return {dataUrl,model:payload?.model||cap.model,width:Number(payload?.width)||0,height:Number(payload?.height)||0};
}
