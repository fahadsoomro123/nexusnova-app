import { ensurePuterImageSdk,generateAiImage,getPuterImageSession,signInPuterForImages } from './ai-photo-studio-ai.js';
import { saveDesignProject } from './ai-photo-project-store.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeName=v=>String(v||'AI image').replace(/[^a-z0-9 _-]+/gi,'').trim().slice(0,48)||'AI image';

function ensureStyles(){
  if(document.getElementById('nx-puter-image-generator-v1'))return;
  const style=document.createElement('style');style.id='nx-puter-image-generator-v1';style.textContent=`
  .nx-photo-editor .nxv3-tabs{grid-template-columns:repeat(5,minmax(0,1fr))!important}
  .nxputer-wrap{display:grid;gap:9px;max-width:720px;margin:0 auto;padding:2px}.nxputer-hero{padding:11px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:#171922}.nxputer-hero strong{display:block;font-size:14px}.nxputer-hero p{margin:5px 0 0;color:#a8adbc;font-size:9px;line-height:1.45}
  .nxputer-status{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px;padding:8px 9px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:#12141b}.nxputer-status b{display:block;font-size:10px}.nxputer-status span{display:block;margin-top:2px;color:#9da3b4;font-size:8px;line-height:1.35}.nxputer-status.is-ok{border-color:rgba(120,220,170,.34)}
  .nxputer-label{display:grid;gap:4px;color:#c7cad6;font-size:9px}.nxputer-label textarea,.nxputer-label select{width:100%!important;border:1px solid rgba(255,255,255,.13)!important;border-radius:10px!important;background:#20232d!important;color:#fff!important}.nxputer-label textarea{min-height:86px!important;padding:9px!important;resize:vertical!important;font-size:12px!important}.nxputer-label select{height:38px!important;padding:0 8px!important;font-size:10px!important}
  .nxputer-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.nxputer-generate{width:100%;height:43px!important;font-size:12px!important}.nxputer-note{color:#8f95a7;font-size:8px;line-height:1.45}
  .nxputer-result{display:none;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#15171f}.nxputer-result.is-on{display:block}.nxputer-result img{display:block;width:100%;max-height:44vh;object-fit:contain;background:#0c0e13}.nxputer-result-copy{padding:9px}.nxputer-result-copy strong{display:block;font-size:10px}.nxputer-result-copy span{display:block;margin-top:3px;color:#9ba1b2;font-size:8px}.nxputer-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
  .nxputer-actions [data-puter-use-design]{color:#fff!important;-webkit-text-fill-color:#fff!important;opacity:1!important;border-color:rgba(173,137,255,.42)!important;background:#24193f!important;font-weight:800!important}
  .nxputer-error{display:none;padding:8px 9px;border:1px solid rgba(255,100,110,.3);border-radius:10px;background:rgba(120,20,30,.16);color:#ffc6cb;font-size:9px;line-height:1.4}.nxputer-error.is-on{display:block}
  @media(max-width:390px){.nxputer-options{grid-template-columns:1fr}.nxputer-actions{grid-template-columns:1fr}.nxputer-status{grid-template-columns:1fr}.nxputer-status .nxv3-btn{width:100%}}
  `;document.head.appendChild(style)
}

function allowanceInfo(usage){
  const info=usage?.allowanceInfo;if(!info)return null;
  const total=Number(info.monthUsageAllowance),remaining=Number(info.remaining);
  if(!Number.isFinite(total)||total<=0||!Number.isFinite(remaining))return null;
  return {total,remaining};
}

function remainingPercent(usage){
  const info=allowanceInfo(usage);if(!info)return null;
  return Math.max(0,Math.min(100,info.remaining/info.total*100));
}

function usageText(usage){
  const percent=remainingPercent(usage);
  if(percent!==null)return `${Math.round(percent)}% of your monthly Puter allowance remains.`;
  return usage?.allowanceInfo?'Puter connected. Your own Puter allowance is used for generation.':'Puter connected. Usage details are temporarily unavailable.';
}

function perImageUsageText(beforeUsage,afterUsage){
  const before=allowanceInfo(beforeUsage),after=allowanceInfo(afterUsage),remaining=remainingPercent(afterUsage);
  if(!before||!after||remaining===null)return usageText(afterUsage);
  const used=Math.max(0,before.remaining-after.remaining);
  if(used<=0)return `Usage meter has not reported a measurable change yet · ${Math.round(remaining)}% remains.`;
  const percent=used/after.total*100;
  const usedLabel=percent<0.01?'<0.01':percent<1?percent.toFixed(2):percent.toFixed(1);
  return `This image used ${usedLabel}% of your monthly Puter allowance · ${Math.round(remaining)}% remains.`;
}

function dataUrlToFile(dataUrl,name){
  const [head,body]=String(dataUrl).split(',',2),mime=(head.match(/^data:([^;]+);base64$/i)||[])[1]||'image/png',bytes=atob(body||''),arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new File([arr],name,{type:mime,lastModified:Date.now()})
}

async function compressForProject(dataUrl){
  const image=new Image();image.src=dataUrl;await image.decode?.().catch(()=>{});if(!image.complete)await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});
  const max=1536,scale=Math.min(1,max/Math.max(image.naturalWidth||1,image.naturalHeight||1)),w=Math.max(1,Math.round((image.naturalWidth||1024)*scale)),h=Math.max(1,Math.round((image.naturalHeight||1024)*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(image,0,0,w,h);return {dataUrl:canvas.toDataURL('image/webp',.9),width:w,height:h}
}

function makeGeneratedDesign(dataUrl,width,height,prompt){
  const id=`design-ai-${Date.now().toString(36)}`;return {id,name:`AI · ${safeName(prompt).slice(0,32)}`,width:Math.max(1,width||1024),height:Math.max(1,height||1024),background:'#111111',templateId:'ai-generated',templateMeta:{purpose:'AI generated image',description:'Created with Puter AI inside NexusNova.',editableFields:['Generated image','Add text','Add shapes','Opacity','Position','Layers'],category:'ai-image',useCase:'AI image',style:'Generated',sizeLabel:`${width||1024} × ${height||1024}`},elements:[{id:`${id}-image`,type:'photo',x:0,y:0,w:1,h:1,src:dataUrl,label:'',radius:0,rotation:0,opacity:1,z:0}],selection:[],updatedAt:Date.now()}
}

export function installPuterImageGenerator(root){
  if(!root||root.__nxPuterImageGeneratorInstalled)return()=>{};const workspace=root.querySelector('.nx-canva-v3');if(!workspace)return()=>{};root.__nxPuterImageGeneratorInstalled=true;ensureStyles();
  const tabs=workspace.querySelector('.nxv3-tabs'),body=workspace.querySelector('.nxv3-body');if(!tabs||!body)return()=>{};
  const tab=document.createElement('button');tab.type='button';tab.className='nxv3-tab';tab.dataset.v3Tab='ai-image';tab.textContent='AI Image';tabs.appendChild(tab);
  const pane=document.createElement('section');pane.className='nxv3-pane';pane.dataset.v3Pane='ai-image';pane.innerHTML=`<div class="nxputer-wrap"><div class="nxputer-hero"><strong>AI Image Generator</strong><p>Describe any original image you want. NexusNova uses Puter: no NexusNova developer API key or AI bill. Generation uses the signed-in user's Puter allowance.</p></div><div class="nxputer-status" data-puter-status><div><b data-puter-status-title>Connecting Puter…</b><span data-puter-status-copy>No account has been connected yet.</span></div><button class="nxv3-btn primary" data-puter-connect>Connect Puter</button></div><label class="nxputer-label">Describe your image<textarea data-puter-prompt maxlength="900" placeholder="Example: A premium cinematic portrait in soft window light, realistic skin texture, clean background"></textarea></label><div class="nxputer-options"><label class="nxputer-label">Aspect<select data-puter-aspect><option value="square">1:1 Square</option><option value="portrait">4:5 Portrait</option><option value="story">9:16 Story</option><option value="wide">16:9 Wide</option></select></label><label class="nxputer-label">Style<select data-puter-style><option value="auto">Auto</option><option value="photo">Photorealistic</option><option value="cinematic">Cinematic</option><option value="illustration">Anime illustration</option><option value="threeD">3D Render</option><option value="digitalArt">Digital Art</option><option value="portrait">Portrait</option><option value="product">Product</option><option value="logo">Logo Concept</option></select></label><label class="nxputer-label">Quality / allowance<select data-puter-mode><option value="economy">Economy · recommended</option><option value="balanced">Balanced</option><option value="quality">Higher quality</option></select></label></div><button class="nxv3-btn primary nxputer-generate" data-puter-generate>Generate Image</button><div class="nxputer-note">Economy is the default to stretch your Puter allowance. Puter may ask you to sign in or approve usage. NexusNova does not store a Puter password or developer API key.</div><div class="nxputer-error" data-puter-error></div><div class="nxputer-result" data-puter-result><img alt="AI generated result" data-puter-image><div class="nxputer-result-copy"><strong data-puter-result-title>Generated image</strong><span data-puter-result-meta></span><div class="nxputer-actions"><button class="nxv3-btn" data-puter-use-design>Use in Design</button><button class="nxv3-btn primary" data-puter-edit-photo>Edit Photo</button></div></div></div></div>`;body.appendChild(pane);
  const q=s=>pane.querySelector(s),status= q('[data-puter-status]'),statusTitle=q('[data-puter-status-title]'),statusCopy=q('[data-puter-status-copy]'),connect=q('[data-puter-connect]'),prompt=q('[data-puter-prompt]'),generate=q('[data-puter-generate]'),error=q('[data-puter-error]'),result=q('[data-puter-result]'),image=q('[data-puter-image]'),meta=q('[data-puter-result-meta]');let generated=null,busy=false,destroyed=false;
  const setError=text=>{error.textContent=String(text||'');error.classList.toggle('is-on',Boolean(text))};
  async function refreshSession(){try{const session=await getPuterImageSession();if(destroyed)return;status.classList.toggle('is-ok',session.signedIn);statusTitle.textContent=session.signedIn?`Connected${session.user?.username?` · ${session.user.username}`:''}`:'Puter account not connected';statusCopy.textContent=session.signedIn?usageText(session.usage):'Connect once to generate images with your own Puter allowance.';connect.textContent=session.signedIn?'Connected':'Connect Puter';connect.disabled=session.signedIn;generate.disabled=!session.signedIn}catch(e){if(destroyed)return;statusTitle.textContent='Puter unavailable';statusCopy.textContent=e?.message||'Could not load Puter AI.';generate.disabled=true}}
  tab.onclick=()=>{workspace.querySelectorAll('[data-v3-tab]').forEach(n=>n.classList.toggle('is-active',n===tab));workspace.querySelectorAll('[data-v3-pane]').forEach(n=>n.classList.toggle('is-active',n===pane));refreshSession()};
  connect.onclick=async()=>{if(busy)return;setError('');connect.disabled=true;connect.textContent='Connecting…';try{if(!globalThis.puter?.auth){await ensurePuterImageSdk();connect.disabled=false;connect.textContent='Connect Puter';statusCopy.textContent='Puter is ready. Tap Connect Puter once more to open sign-in.';return}await signInPuterForImages();await refreshSession()}catch(e){connect.disabled=false;connect.textContent='Connect Puter';setError(e?.msg||e?.message||'Puter sign-in did not complete. Tap Connect and try again.')}};
  generate.onclick=async()=>{if(busy)return;const text=prompt.value.trim();if(text.length<3){setError('Write what image you want first.');prompt.focus();return}setError('');busy=true;generate.disabled=true;generate.textContent='Generating…';result.classList.remove('is-on');let beforeUsage=null;try{beforeUsage=(await getPuterImageSession()).usage}catch{}try{const out=await generateAiImage(text,{aspect:q('[data-puter-aspect]').value,style:q('[data-puter-style]').value,mode:q('[data-puter-mode]').value});if(destroyed)return;generated={...out,prompt:text};image.src=out.dataUrl;q('[data-puter-result-title]').textContent=safeName(text).slice(0,64);const usageLabel=perImageUsageText(beforeUsage,out.usage);meta.textContent=`${out.width&&out.height?`${out.width} × ${out.height} · `:''}${out.model||'Puter AI'} · ${usageLabel}`;result.classList.add('is-on');statusCopy.textContent=usageText(out.usage)}catch(e){setError(e?.msg||e?.message||'Image generation failed.')}finally{busy=false;generate.textContent='Generate Image';const session=await getPuterImageSession().catch(()=>null);generate.disabled=!(session?.signedIn)}};
  q('[data-puter-use-design]').onclick=async()=>{if(!generated)return;setError('');try{const packed=await compressForProject(generated.dataUrl),design=makeGeneratedDesign(packed.dataUrl,packed.width,packed.height,generated.prompt);saveDesignProject(design);const projects=workspace.querySelector('[data-v3-tab="projects"]');projects?.click();requestAnimationFrame(()=>{workspace.querySelector(`[data-project="${design.id}"] button:not([data-del])`)?.click()})}catch(e){setError(e?.message||'Could not add this generated image to Design.')}};
  q('[data-puter-edit-photo]').onclick=()=>{if(!generated)return;setError('');try{const file=dataUrlToFile(generated.dataUrl,`nexusnova-ai-${Date.now()}.png`),input=root.querySelector('[data-photo-file]');if(!input)throw new Error('Photo editor import is unavailable.');const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;root.__nxCanvaWorkspaceV3?.close?.();root.__nxStudioNavigation?.openEditor?.({pick:false});input.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){setError(e?.message||'Could not send the generated image to Photo Editor.')}};
  ensurePuterImageSdk().then(refreshSession).catch(()=>refreshSession());
  return()=>{destroyed=true;tab.remove();pane.remove();delete root.__nxPuterImageGeneratorInstalled};
}
