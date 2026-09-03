import { aiModel, downloadBlob, fileToInline, openSecure, safeName, studioShell } from './premium-studio-core.js';

function renderCanvas(canvas, image, state) {
  if (!image) return;
  const max = 1800;
  const scale = Math.min(1, max / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const rotated = Math.abs(state.rotation % 180) === 90;
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.width = rotated ? h : w;
  canvas.height = rotated ? w : h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.rotate(state.rotation * Math.PI / 180);
  ctx.scale(state.flipX ? -1 : 1, state.flipY ? -1 : 1);
  ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%) blur(${state.blur}px)`;
  ctx.drawImage(image, -w/2, -h/2, w, h);
  ctx.restore();
}

export function renderAiPhotoStudio() {
  const root = studioShell({
    eyebrow:'NEXUSNOVA CREATOR ENGINE', title:'AI Photo Studio', subtitle:'Local pro editor + AI analysis + secure premium provider handoff', badge:'PHOTO PRO', accent:'#33c8ff', accent2:'#2677ff',
    tabs:[
      { id:'edit', label:'EDIT', html:`<div class="nx-studio-grid two"><div class="nx-studio-preview"><canvas data-photo-canvas hidden></canvas><div class="nx-studio-empty" data-photo-empty>IMPORT A PHOTO<br><small>JPG • PNG • WEBP</small></div></div><div class="nx-studio-grid"><label class="nx-studio-field"><span>PHOTO</span><input type="file" accept="image/jpeg,image/png,image/webp" data-photo-file></label><div class="nx-studio-range"><span>Brightness</span><input type="range" min="40" max="180" value="100" data-photo-range="brightness"><output>100%</output></div><div class="nx-studio-range"><span>Contrast</span><input type="range" min="40" max="180" value="100" data-photo-range="contrast"><output>100%</output></div><div class="nx-studio-range"><span>Saturation</span><input type="range" min="0" max="220" value="100" data-photo-range="saturation"><output>100%</output></div><div class="nx-studio-actions"><button type="button" data-photo-rotate>ROTATE</button><button type="button" data-photo-flip>FLIP</button><button type="button" data-photo-reset>RESET</button></div></div></div>` },
      { id:'enhance', label:'ENHANCE', html:`<div class="nx-studio-grid rows"><div class="nx-studio-card"><strong>Hyper-real enhancement deck</strong><p>Non-destructive presets run locally on the imported image. Original bytes stay untouched.</p><div class="nx-studio-actions" style="margin-top:9px"><button type="button" data-photo-preset="clean">CLEAN</button><button type="button" data-photo-preset="vivid">VIVID</button><button type="button" data-photo-preset="cinema">CINEMA</button></div><div class="nx-studio-actions" style="margin-top:7px"><button type="button" data-photo-preset="portrait">PORTRAIT</button><button type="button" data-photo-preset="mono">MONO</button><button type="button" data-photo-preset="soft">SOFT</button></div></div><div class="nx-studio-status" data-photo-enhance-status>Select a preset after importing a photo.</div></div>` },
      { id:'ai', label:'AI LAB', html:`<div class="nx-studio-grid two"><div class="nx-studio-card"><strong>AI Visual Director</strong><p>Analyze the imported photo and build a premium edit/generation prompt without inventing hidden details.</p><label class="nx-studio-field" style="margin-top:8px"><span>CREATIVE INTENT</span><textarea data-photo-prompt placeholder="Example: luxury product campaign, dramatic studio lighting"></textarea></label><div class="nx-studio-actions" style="margin-top:7px"><button class="nx-studio-primary" type="button" data-photo-analyze>AI DIRECTOR</button><button type="button" data-photo-copy>COPY PROMPT</button></div></div><div class="nx-studio-grid"><div class="nx-studio-card"><strong>Premium generation providers</strong><p>NexusNova opens the provider securely. Provider usage is billed on that connected provider account.</p><div class="nx-studio-actions" style="margin-top:8px"><button type="button" data-photo-provider="https://app.runwayml.com/">RUNWAY</button><button type="button" data-photo-provider="https://firefly.adobe.com/">FIREFLY</button></div><button style="height:34px;margin-top:7px" type="button" data-photo-provider="https://www.canva.com/ai-image-generator/">CANVA AI</button></div><div class="nx-studio-status" data-photo-ai-status>AI Director ready.</div></div></div>` },
      { id:'export', label:'EXPORT', html:`<div class="nx-studio-grid two"><div class="nx-studio-card"><strong>Master export</strong><p>Exports the currently rendered local edit. Choose modern WebP for smaller files or PNG for lossless output.</p><label class="nx-studio-field" style="margin-top:8px"><span>FORMAT</span><select data-photo-format><option value="image/webp">WEBP</option><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></label><label class="nx-studio-field" style="margin-top:7px"><span>QUALITY</span><input type="range" min="60" max="100" value="94" data-photo-quality></label></div><div class="nx-studio-grid rows"><div class="nx-studio-metric"><div><b data-photo-width>—</b><span>WIDTH</span></div><div><b data-photo-height>—</b><span>HEIGHT</span></div><div><b data-photo-mp>—</b><span>MP</span></div></div><div><button class="nx-studio-primary" style="width:100%;height:38px" type="button" data-photo-export disabled>EXPORT MASTER</button><div class="nx-studio-status" style="margin-top:7px" data-photo-export-status>No photo loaded.</div></div></div></div>` }
    ]
  });

  const file = root.querySelector('[data-photo-file]');
  const canvas = root.querySelector('[data-photo-canvas]');
  const empty = root.querySelector('[data-photo-empty]');
  const exportButton = root.querySelector('[data-photo-export]');
  const state = { brightness:100, contrast:100, saturation:100, blur:0, rotation:0, flipX:false, flipY:false };
  let image = null;
  let sourceFile = null;

  const paint = () => {
    renderCanvas(canvas,image,state);
    if (image) {
      root.querySelector('[data-photo-width]').textContent = canvas.width;
      root.querySelector('[data-photo-height]').textContent = canvas.height;
      root.querySelector('[data-photo-mp]').textContent = `${((canvas.width*canvas.height)/1e6).toFixed(1)}`;
    }
  };

  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    if (!selected) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(selected.type)) return;
    const url = URL.createObjectURL(selected);
    const next = new Image();
    next.onload = () => {
      if (sourceFile && sourceFile.__url) URL.revokeObjectURL(sourceFile.__url);
      sourceFile = selected; sourceFile.__url = url; image = next;
      canvas.hidden = false; empty.hidden = true; exportButton.disabled = false;
      paint();
      root.querySelector('[data-photo-export-status]').textContent = `${selected.name} ready for master export.`;
    };
    next.onerror = () => URL.revokeObjectURL(url);
    next.src = url;
  });

  root.querySelectorAll('[data-photo-range]').forEach(input => input.addEventListener('input', () => {
    state[input.dataset.photoRange] = Number(input.value);
    input.nextElementSibling.textContent = `${input.value}${input.dataset.photoRange === 'blur' ? 'px' : '%'}`;
    paint();
  }));
  root.querySelector('[data-photo-rotate]').addEventListener('click',()=>{state.rotation=(state.rotation+90)%360;paint();});
  root.querySelector('[data-photo-flip]').addEventListener('click',()=>{state.flipX=!state.flipX;paint();});
  root.querySelector('[data-photo-reset]').addEventListener('click',()=>{Object.assign(state,{brightness:100,contrast:100,saturation:100,blur:0,rotation:0,flipX:false,flipY:false});root.querySelectorAll('[data-photo-range]').forEach(i=>{i.value=100;i.nextElementSibling.textContent='100%';});paint();});

  const presets = {
    clean:{brightness:104,contrast:108,saturation:103,blur:0}, vivid:{brightness:106,contrast:122,saturation:142,blur:0}, cinema:{brightness:92,contrast:132,saturation:88,blur:0}, portrait:{brightness:108,contrast:104,saturation:108,blur:.15}, mono:{brightness:102,contrast:128,saturation:0,blur:0}, soft:{brightness:110,contrast:92,saturation:95,blur:.45}
  };
  root.querySelectorAll('[data-photo-preset]').forEach(button=>button.addEventListener('click',()=>{
    if(!image){root.querySelector('[data-photo-enhance-status]').textContent='Import a photo in EDIT first.';return;}
    Object.assign(state,presets[button.dataset.photoPreset]||presets.clean);paint();
    root.querySelector('[data-photo-enhance-status]').textContent=`${button.textContent.trim()} preset applied non-destructively.`;
  }));

  const aiStatus = root.querySelector('[data-photo-ai-status]');
  const prompt = root.querySelector('[data-photo-prompt]');
  root.querySelector('[data-photo-analyze]').addEventListener('click',async()=>{
    if(!sourceFile){aiStatus.textContent='Import a photo in EDIT first.';return;}
    aiStatus.textContent='AI Director analyzing visible image content…';
    try{
      const [model,data]=await Promise.all([aiModel('You are a professional photo art director. Analyze only visible content. Return a concise premium editing/generation prompt and practical lighting/color recommendations.'),fileToInline(sourceFile,12)]);
      const result=await model.generateContent([{inlineData:data},{text:`Creative intent: ${prompt.value.trim()||'premium photorealistic enhancement'}. Build a concise production-ready prompt and 4 edit recommendations.`}]);
      const text=String(result?.response?.text?.()||'').trim();
      if(!text)throw new Error('AI returned no direction.');
      prompt.value=text.slice(0,1800);aiStatus.textContent='AI Director completed the visual brief.';
    }catch(error){aiStatus.textContent=String(error?.message||'AI Director unavailable.').slice(0,220);}
  });
  root.querySelector('[data-photo-copy]').addEventListener('click',async()=>{if(!prompt.value.trim())return;try{await navigator.clipboard.writeText(prompt.value);aiStatus.textContent='Prompt copied.';}catch{aiStatus.textContent='Clipboard permission unavailable.';}});
  root.querySelectorAll('[data-photo-provider]').forEach(button=>button.addEventListener('click',()=>{aiStatus.textContent=openSecure(button.dataset.photoProvider)?'Opening premium provider securely…':'Could not open provider.';}));

  exportButton.addEventListener('click',()=>{
    if(!image)return;
    const type=root.querySelector('[data-photo-format]').value;
    const quality=Math.max(.6,Math.min(1,Number(root.querySelector('[data-photo-quality]').value)/100));
    canvas.toBlob(blob=>{
      if(!blob){root.querySelector('[data-photo-export-status]').textContent='Export failed.';return;}
      const ext=type==='image/png'?'png':type==='image/jpeg'?'jpg':'webp';
      downloadBlob(blob,`${safeName(sourceFile?.name,'nexusnova-photo')}-edited.${ext}`);
      root.querySelector('[data-photo-export-status]').textContent=`Master ${ext.toUpperCase()} exported locally.`;
    },type,quality);
  });

  root.__cleanup=()=>{if(sourceFile?.__url)URL.revokeObjectURL(sourceFile.__url);};
  return root;
}
