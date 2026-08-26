/* NexusNova NOVA 5.7 Sol Video Studio v1.
 * Real provider-ready text-to-video / image-to-video client for Web + Android.
 * Uses the existing paired NOVA gateway. No fake generation or fake progress.
 */
(() => {
  'use strict';
  if (window.__nxNovaSol57VideoV1) return;
  window.__nxNovaSol57VideoV1 = true;

  const CFG='nexusnova_nova_ai_mobile_v1';
  const JOBS='nexusnova_sol57_video_jobs_v1';
  const MAX_JOBS=30;
  let selectedImage=null, observer=null, syncQueued=false, polling=0;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'');return v??fallback}catch(_){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
  const cfg=()=>{const c=read(CFG,{});return c&&typeof c==='object'?c:{}};
  const jobs=()=>{const v=read(JOBS,[]);return Array.isArray(v)?v.slice(0,MAX_JOBS):[]};
  const saveJobs=v=>write(JOBS,(Array.isArray(v)?v:[]).slice(0,MAX_JOBS));
  const uid=()=>`video-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const now=()=>Date.now();
  const outputUrl=d=>String(d?.video_url||d?.output_url||d?.url||d?.result?.video_url||d?.result?.url||'').trim();
  const remoteId=d=>String(d?.job_id||d?.id||d?.job?.id||'').trim();
  const remoteStatus=d=>String(d?.status||d?.job?.status||'queued').trim().toLowerCase();
  const terminal=s=>['completed','complete','succeeded','success','failed','error','cancelled','canceled'].includes(String(s||'').toLowerCase());
  const okStatus=s=>['completed','complete','succeeded','success'].includes(String(s||'').toLowerCase());

  function gateway(){
    const c=cfg(),endpoint=String(c.endpoint||'').trim(),token=String(c.token||'').trim();
    if(!endpoint||!token)return null;
    try{
      const u=new URL(endpoint);
      const local=/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname);
      if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local))return null;
      return {base:u.href.replace(/\/$/,''),token};
    }catch(_){return null}
  }

  async function api(path,options={}){
    const g=gateway();
    if(!g)throw new Error('Video backend is not configured in NOVA Settings.');
    const headers={Accept:'application/json','X-NexusNova-Token':g.token,...(options.headers||{})};
    if(options.body&&!headers['Content-Type'])headers['Content-Type']='application/json';
    const r=await fetch(g.base+path,{...options,headers});
    let data={};try{data=await r.json()}catch(_){data={}}
    if(!r.ok)throw new Error(String(data.error||data.message||`Video backend HTTP ${r.status}`));
    return data;
  }

  async function fileToDataUrl(file){
    if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Please choose an image file.');
    if(file.size>4*1024*1024)throw new Error('Image must be 4 MB or smaller for image-to-video.');
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Could not read image.'));r.readAsDataURL(file)});
  }

  function style(){
    if($('nxSol57VideoStyle'))return;
    const s=document.createElement('style');s.id='nxSol57VideoStyle';s.textContent=`
      .nx-v57-video-back{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui}.nx-v57-video-sheet{width:min(820px,100%);max-height:92dvh;overflow:auto;background:#171717;color:#f3f3f3;border:1px solid #3a3a3a;border-bottom:0;border-radius:28px 28px 0 0}.nx-v57-video-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:17px 18px;background:#171717;border-bottom:1px solid #303030}.nx-v57-video-head div{flex:1}.nx-v57-video-head strong{display:block;font-size:20px}.nx-v57-video-head small{display:block;margin-top:4px;color:#929292}.nx-v57-video-head button{width:40px;height:40px;border:0;border-radius:50%;background:#2b2b2b;color:#fff;font-size:22px}.nx-v57-video-body{padding:16px 18px 30px}.nx-v57-video-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.nx-v57-video-card{border:1px solid #343434;border-radius:18px;background:#202020;padding:14px}.nx-v57-video-card h3{margin:0 0 10px;font-size:15px}.nx-v57-video-card label{display:block;margin:10px 0 5px;color:#aaa;font-size:11px}.nx-v57-video-card textarea,.nx-v57-video-card input,.nx-v57-video-card select{box-sizing:border-box;width:100%;border:1px solid #414141;border-radius:12px;background:#151515;color:#eee;padding:10px 11px}.nx-v57-video-card textarea{min-height:105px;resize:vertical}.nx-v57-video-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.nx-v57-video-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.nx-v57-video-actions button{min-height:42px;padding:0 14px;border:1px solid #444;border-radius:12px;background:#292929;color:#eee;font-weight:650}.nx-v57-video-actions .primary{background:#f2f2f2;color:#111;border-color:#f2f2f2}.nx-v57-video-note{margin:10px 0;color:#8e8e8e;font-size:11px;line-height:1.5}.nx-v57-video-status{margin-top:12px;padding:11px 12px;border-radius:12px;background:#222;color:#bdbdbd;font-size:12px}.nx-v57-video-jobs{margin-top:18px}.nx-v57-video-jobs h3{margin:0 0 10px}.nx-v57-video-job{margin-bottom:9px;padding:12px;border:1px solid #343434;border-radius:15px;background:#202020}.nx-v57-video-job strong,.nx-v57-video-job small{display:block}.nx-v57-video-job small{margin-top:5px;color:#8c8c8c}.nx-v57-video-job video{width:100%;max-height:320px;margin-top:10px;border-radius:12px;background:#000}.nx-v57-video-job .tools{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.nx-v57-video-job button,.nx-v57-video-job a{min-height:34px;display:inline-flex;align-items:center;padding:0 10px;border:1px solid #444;border-radius:9px;background:#292929;color:#eee;text-decoration:none;font-size:12px}.nx-v57-video-badge{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;background:#303030;color:#bbb;font-size:10px}.nx-v57-video-plus{order:3}.nx-v57-video-plus .circle{font-size:20px}.nx-v57-video-nav{width:100%;min-height:58px;display:flex;align-items:center;gap:18px;border:0;border-radius:13px;background:transparent;color:#eee;text-align:left;font-size:18px;font-weight:650}.nx-v57-video-nav:active{background:#222}.nx-v57-video-nav .ico{width:34px;text-align:center;font-size:24px}
      @media(min-width:760px){.nx-v57-video-back{align-items:center;padding:20px}.nx-v57-video-sheet{border-bottom:1px solid #3a3a3a;border-radius:28px}}@media(max-width:680px){.nx-v57-video-grid{grid-template-columns:1fr}.nx-v57-video-row{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }

  function backendSummary(){
    const g=gateway();
    return g?`Paired gateway: ${(()=>{try{return new URL(g.base).host}catch(_){return 'configured'}})()}`:'Video backend not configured';
  }

  function renderJobs(host){
    if(!host)return;
    const list=jobs();host.innerHTML='';
    if(!list.length){host.innerHTML='<div class="nx-v57-video-note">No generated videos yet.</div>';return}
    list.forEach(j=>{
      const el=document.createElement('div');el.className='nx-v57-video-job';
      const st=String(j.status||'queued');
      el.innerHTML=`<strong>${esc(j.prompt||'NOVA video')}<span class="nx-v57-video-badge">${esc(st)}</span></strong><small>${esc(j.mode==='image-to-video'?'Image → Video':'Text → Video')} • ${esc(j.aspect||'16:9')} • ${esc(String(j.duration||6))}s${j.model?` • ${esc(j.model)}`:''}</small>${j.error?`<small style="color:#e9a6a6">${esc(j.error)}</small>`:''}<div class="tools"></div>`;
      if(j.url){const v=document.createElement('video');v.controls=true;v.preload='metadata';v.src=j.url;el.insertBefore(v,el.querySelector('.tools'));}
      const tools=el.querySelector('.tools');
      if(j.url){const a=document.createElement('a');a.href=j.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open video';tools.appendChild(a)}
      if(j.remoteId&&!terminal(st)){const b=document.createElement('button');b.textContent='Refresh';b.onclick=()=>refreshJob(j.id,true);tools.appendChild(b)}
      const d=document.createElement('button');d.textContent='Delete';d.onclick=()=>{saveJobs(jobs().filter(x=>x.id!==j.id));renderJobs(host)};tools.appendChild(d);
      host.appendChild(el);
    });
  }

  function updateJob(localId,patch){
    const list=jobs(),i=list.findIndex(x=>x.id===localId);if(i<0)return null;
    list[i]={...list[i],...patch,updatedAt:now()};saveJobs(list);return list[i];
  }

  async function refreshJob(localId,manual=false){
    const j=jobs().find(x=>x.id===localId);if(!j?.remoteId||terminal(j.status))return j;
    try{
      const d=await api(`/api/video/job/${encodeURIComponent(j.remoteId)}`,{method:'GET'});
      const status=remoteStatus(d),url=outputUrl(d);
      const next=updateJob(localId,{status,url:url||j.url||'',model:String(d.model||j.model||''),provider:String(d.provider||j.provider||''),error:''});
      if(manual)openStudio();
      return next;
    }catch(e){
      const next=updateJob(localId,{error:String(e?.message||e).slice(0,220)});if(manual)openStudio();return next;
    }
  }

  async function poll(){
    const active=jobs().filter(j=>j.remoteId&&!terminal(j.status)).slice(0,5);
    for(const j of active)await refreshJob(j.id,false);
  }

  async function submit(form,statusEl,jobsEl){
    const f=new FormData(form),mode=String(f.get('mode')||'text-to-video'),prompt=String(f.get('prompt')||'').trim();
    if(!prompt){statusEl.textContent='Write a video prompt first.';return}
    if(mode==='image-to-video'&&!selectedImage){statusEl.textContent='Choose an image for Image → Video.';return}
    const aspect=String(f.get('aspect')||'16:9'),duration=Math.max(2,Math.min(20,Number(f.get('duration'))||6)),quality=String(f.get('quality')||'standard');
    if(!gateway()){statusEl.textContent='Video backend is not configured. Open NOVA Settings and pair a video-capable gateway.';return}
    const local={id:uid(),remoteId:'',mode,prompt:prompt.slice(0,1800),aspect,duration,quality,status:'submitting',url:'',createdAt:now(),updatedAt:now(),error:'',model:'',provider:''};
    saveJobs([local,...jobs()]);renderJobs(jobsEl);statusEl.textContent='Submitting to the real NOVA video backend…';
    try{
      const payload={mode,prompt:local.prompt,aspect_ratio:aspect,duration_seconds:duration,quality,nova_client:{product:'NOVA 5.7 Sol',surface:'video-studio-v1'}};
      if(mode==='image-to-video')payload.image=await fileToDataUrl(selectedImage);
      const d=await api('/api/video/generate',{method:'POST',body:JSON.stringify(payload)});
      const rid=remoteId(d),url=outputUrl(d),st=url?'completed':remoteStatus(d);
      updateJob(local.id,{remoteId:rid,status:st,url,model:String(d.model||''),provider:String(d.provider||''),error:''});
      statusEl.textContent=url?'Video generated successfully.':rid?'Video job submitted. NOVA will refresh its real backend status.':'Backend responded without a video URL or job ID.';
      if(!url&&!rid)updateJob(local.id,{status:'failed',error:'Backend returned no video URL or job ID.'});
      renderJobs(jobsEl);
    }catch(e){
      updateJob(local.id,{status:'failed',error:String(e?.message||e).slice(0,220)});statusEl.textContent=`Video generation failed: ${String(e?.message||e)}`;renderJobs(jobsEl);
    }
  }

  function openSettings(){
    document.querySelector('.nx-v57-video-back')?.remove();
    const b=$('nxNovaSettings');if(b){b.click();return}
    alert('Open NOVA Settings and configure the paired gateway/token. The gateway must implement /api/video/generate and /api/video/job/:id.');
  }

  function openStudio(){
    style();document.querySelector('.nx-v57-video-back')?.remove();
    const back=document.createElement('div');back.className='nx-v57-video-back';
    back.innerHTML=`<section class="nx-v57-video-sheet"><header class="nx-v57-video-head"><div><strong>NOVA Video Studio</strong><small>Text → Video • Image → Video • real backend jobs</small></div><button type="button" data-close>×</button></header><div class="nx-v57-video-body"><div class="nx-v57-video-grid"><form class="nx-v57-video-card" data-form><h3>Create AI video</h3><label>Mode</label><select name="mode"><option value="text-to-video">Text → Video</option><option value="image-to-video">Image → Video</option></select><label>Prompt</label><textarea name="prompt" maxlength="1800" placeholder="Describe the scene, motion, camera and style…" required></textarea><div class="nx-v57-video-row"><div><label>Aspect</label><select name="aspect"><option>16:9</option><option>9:16</option><option>1:1</option></select></div><div><label>Seconds</label><input name="duration" type="number" min="2" max="20" value="6"></div><div><label>Quality</label><select name="quality"><option value="standard">Standard</option><option value="high">High</option></select></div></div><label>Source image (Image → Video)</label><input data-image type="file" accept="image/*"><div class="nx-v57-video-actions"><button class="primary" type="submit">Generate video</button><button type="button" data-config>Backend settings</button></div><p class="nx-v57-video-note">NOVA does not fabricate video results. Generation only starts when the paired gateway actually supports the video API contract.</p><div class="nx-v57-video-status" data-status>${esc(backendSummary())}</div></form><div class="nx-v57-video-card"><h3>Video Library & jobs</h3><p class="nx-v57-video-note">Completed video URLs and job metadata are kept locally on this device. Large video files are not copied into localStorage.</p><div data-jobs></div></div></div></div></section>`;
    document.body.appendChild(back);
    const form=back.querySelector('[data-form]'),statusEl=back.querySelector('[data-status]'),jobsEl=back.querySelector('[data-jobs]');
    selectedImage=null;renderJobs(jobsEl);
    back.querySelector('[data-close]').onclick=()=>back.remove();back.onclick=e=>{if(e.target===back)back.remove()};
    back.querySelector('[data-config]').onclick=openSettings;
    back.querySelector('[data-image]').onchange=e=>{selectedImage=e.target.files?.[0]||null;statusEl.textContent=selectedImage?`Image ready: ${selectedImage.name}`:backendSummary()};
    form.onsubmit=e=>{e.preventDefault();submit(form,statusEl,jobsEl)};
  }

  function addNav(host){
    if(!host||host.querySelector('[data-sol57-video]'))return;
    const b=document.createElement('button');b.type='button';b.dataset.sol57Video='1';b.className='nx-v57-video-nav';b.innerHTML='<span class="ico">▷</span>Videos';
    b.onclick=e=>{e.preventDefault();e.stopPropagation();document.querySelector('.nx-sol57-drawer-back')?.remove();openStudio()};
    const anchor=host.querySelector('[data-f="library"]');if(anchor?.nextSibling)host.insertBefore(b,anchor.nextSibling);else host.appendChild(b);
  }

  function addPlus(menu){
    if(!menu||menu.querySelector('[data-sol57-video]'))return;
    const b=document.createElement('button');b.type='button';b.dataset.sol57Video='1';b.className='nx-v57-video-plus';b.innerHTML='<span class="circle">▷</span><strong>Create video</strong>';
    b.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();openStudio()};
    const plugins=menu.querySelector('[data-a="plugins"]');if(plugins)menu.insertBefore(b,plugins);else menu.appendChild(b);
  }

  function sync(){
    syncQueued=false;style();
    document.querySelectorAll('.nx-sol57-ref-nav,.nx-sol57-desktop-nav').forEach(addNav);
    document.querySelectorAll('.nx-sol57-real-plus').forEach(addPlus);
  }
  function queue(){if(syncQueued)return;syncQueued=true;requestAnimationFrame(sync)}
  function init(){
    sync();observer=new MutationObserver(queue);observer.observe(document.body,{childList:true,subtree:true});
    if(!polling)polling=setInterval(poll,12000);setTimeout(poll,1500);
  }

  window.NexusNovaSol57Video=Object.freeze({version:'1.0.0',open:openStudio,refresh:poll,jobs,backendConfigured:()=>!!gateway()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();