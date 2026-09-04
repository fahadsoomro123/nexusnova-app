const SAFE_ACTIONS=new Set(['set-background','set-text','set-color','set-font-size','move','resize','rotate','duplicate','delete','align','bring-front','send-back']);
const PUTER_SDK_URL='https://js.puter.com/v2/';
const PUTER_TIMEOUT_MS=12_000;
let puterPromise=null;

export function buildDesignAssistantPrompt(command,design){
  return `You are NexusNova Design Assistant. Convert the user's design instruction into JSON actions only. Allowed actions: ${[...SAFE_ACTIONS].join(', ')}. Never invent unsupported assets or claim an edit succeeded. Current design summary: ${JSON.stringify({width:design?.width,height:design?.height,elements:(design?.elements||[]).map(x=>({id:x.id,type:x.type,text:x.text||'',locked:!!x.locked}))}).slice(0,5000)}. User instruction: ${String(command||'').slice(0,1000)}`;
}

export function normaliseDesignActions(value){const rows=Array.isArray(value)?value:Array.isArray(value?.actions)?value.actions:[];return rows.filter(x=>x&&SAFE_ACTIONS.has(x.action)).slice(0,30).map(x=>({...x,action:String(x.action),target:x.target?String(x.target):undefined}))}

export function ensurePuterImageSdk(){
  if(globalThis.puter?.ai?.txt2img&&globalThis.puter?.auth)return Promise.resolve(globalThis.puter);
  if(puterPromise)return puterPromise;
  puterPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-nova-puter-sdk],script[src^="https://js.puter.com/v2/"]');
    const started=Date.now();
    const finish=()=>{
      if(globalThis.puter?.ai?.txt2img&&globalThis.puter?.auth){resolve(globalThis.puter);return true}
      return false;
    };
    if(existing){
      if(finish())return;
      const poll=setInterval(()=>{if(finish())clearInterval(poll);else if(Date.now()-started>PUTER_TIMEOUT_MS){clearInterval(poll);reject(new Error('Puter AI did not become ready.'))}},100);
      return;
    }
    const script=document.createElement('script');script.src=PUTER_SDK_URL;script.async=true;script.dataset.novaPuterSdk='1';
    const timer=setTimeout(()=>reject(new Error('Puter AI connection timed out.')),PUTER_TIMEOUT_MS);
    script.onload=()=>{clearTimeout(timer);if(!finish())reject(new Error('Puter SDK loaded without image generation support.'))};
    script.onerror=()=>{clearTimeout(timer);reject(new Error('Could not load Puter AI. Check your internet connection.'))};
    document.head.appendChild(script);
  }).catch(error=>{puterPromise=null;throw error});
  return puterPromise;
}

export function imageGenerationCapability(){
  return {enabled:true,provider:'puter',developerApiKeyRequired:false,developerBillingRequired:false,userPays:true,auth:'puter-account',sdk:PUTER_SDK_URL};
}

export async function getPuterImageSession(){
  const puter=await ensurePuterImageSdk();
  const signedIn=Boolean(puter.auth?.isSignedIn?.());
  let user=null,usage=null;
  if(signedIn){
    try{user=await puter.auth.getUser?.()}catch{}
    try{usage=await puter.auth.getMonthlyUsage?.()}catch{}
  }
  return {signedIn,user,usage};
}

export async function signInPuterForImages(){
  const puter=await ensurePuterImageSdk();
  if(!puter.auth?.isSignedIn?.())await puter.auth.signIn();
  return getPuterImageSession();
}

const STYLE_PREFIX={
  auto:'',photo:'Photorealistic professional photograph. ',cinematic:'Cinematic lighting, premium composition. ',illustration:'High quality polished digital illustration. ',threeD:'Premium 3D render, detailed materials and lighting. ',logo:'Original clean brand-mark concept, simple vector-like composition, no copyrighted logos. '
};
const RATIOS={square:{w:1,h:1},portrait:{w:4,h:5},story:{w:9,h:16},wide:{w:16,h:9}};

export async function generateAiImage(prompt,{aspect='square',style='auto',mode='economy'}={}){
  const text=String(prompt||'').trim();
  if(text.length<3)throw new Error('Describe the image you want to create.');
  if(text.length>900)throw new Error('Prompt is too long. Keep it under 900 characters.');
  const puter=await ensurePuterImageSdk();
  if(!puter.auth?.isSignedIn?.())throw new Error('Connect your Puter account first.');
  const ratio=RATIOS[aspect]||RATIOS.square;
  const prefix=STYLE_PREFIX[style]??STYLE_PREFIX.auto;
  const options={ratio,quality:'low'};
  if(mode==='economy')options.model='gpt-image-1-mini';
  else if(mode==='balanced')options.model='gpt-image-1';
  else options.model='gpt-image-1.5';
  const image=await puter.ai.txt2img(`${prefix}${text}`,options);
  const dataUrl=String(image?.src||'');
  if(!/^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl))throw new Error('Puter returned an invalid image.');
  let usage=null;try{usage=await puter.auth.getMonthlyUsage?.()}catch{}
  return {dataUrl,width:Number(image?.naturalWidth||image?.width)||0,height:Number(image?.naturalHeight||image?.height)||0,model:options.model,provider:'puter',usage};
}
