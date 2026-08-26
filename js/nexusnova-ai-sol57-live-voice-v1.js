/* NexusNova NOVA 5.7 Sol Live Voice v1.
 * Two-way conversational voice surface for Web/PC + Android WebView.
 * Free browser/system voices work without a paid provider.
 * Local/Paid providers use the paired NexusNova gateway so provider keys never live in the client.
 * No provider is reported as ready unless it is configured/observed.
 */
(() => {
  'use strict';
  if (window.__nxNovaSol57LiveVoiceV1) return;
  window.__nxNovaSol57LiveVoiceV1 = true;

  const CFG_KEY='nexusnova_nova_ai_mobile_v1';
  const VOICE_KEY='nexusnova_sol57_live_voice_v1';
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  const PROVIDERS=Object.freeze({
    'system-auto':{label:'Best system voice',tier:'FREE',kind:'system',desc:'Best natural voice already available on this device'},
    'system-female':{label:'System female voice',tier:'FREE',kind:'system',gender:'female',desc:'Uses the best matching female system voice'},
    'system-male':{label:'System male voice',tier:'FREE',kind:'system',gender:'male',desc:'Uses the best matching male system voice'},
    'piper-local':{label:'Local Piper voice',tier:'FREE',kind:'gateway',desc:'Free local TTS • requires Piper on paired PC'},
    'kokoro-local':{label:'Local Kokoro voice',tier:'FREE',kind:'gateway',desc:'Free local neural TTS • requires local backend'},
    'elevenlabs':{label:'ElevenLabs natural voice',tier:'PAID',kind:'gateway',desc:'Provider account/API required'},
    'azure':{label:'Microsoft Azure neural voice',tier:'PAID',kind:'gateway',desc:'Provider account/API required'},
    'google':{label:'Google Cloud neural voice',tier:'PAID',kind:'gateway',desc:'Provider account/API required'},
    'custom':{label:'Custom premium voice provider',tier:'PAID',kind:'gateway',desc:'Secure server-side provider adapter'}
  });

  const defaults={provider:'system-auto',gender:'auto',language:'en-US',autoListen:true,autoSpeak:true,bargeIn:true,rate:0.96,pitch:1.0};
  let recognition=null, listening=false, speaking=false, session=false, lastAssistantText='', audio=null, resumeTimer=null;

  function readCfg(){try{return {endpoint:'',token:'',...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch(_){return {endpoint:'',token:''}}}
  function read(){try{return {...defaults,...JSON.parse(localStorage.getItem(VOICE_KEY)||'{}')}}catch(_){return {...defaults}}}
  function save(patch){const next={...read(),...patch};try{localStorage.setItem(VOICE_KEY,JSON.stringify(next))}catch(_){}return next}
  function paired(){const c=readCfg();return !!(String(c.endpoint||'').trim()&&String(c.token||'').trim())}
  function baseUrl(){return String(readCfg().endpoint||'').replace(/\/+$/,'')}
  function provider(){return PROVIDERS[read().provider]||PROVIDERS['system-auto']}
  function language(){return read().language||'en-US'}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function status(text,tone=''){const el=$('nxSol57VoiceStatus');if(el){el.textContent=text;el.dataset.tone=tone}}

  function installStyle(){
    if($('nxSol57LiveVoiceStyle'))return;
    const s=document.createElement('style');s.id='nxSol57LiveVoiceStyle';s.textContent=`
      .nx-sol57-voice-back{position:fixed;inset:0;z-index:10320;background:#090909;color:#f4f4f4;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;flex-direction:column;overflow:hidden}
      .nx-sol57-voice-top{height:72px;display:flex;align-items:center;gap:10px;padding:0 max(16px,env(safe-area-inset-left));border-bottom:1px solid #242424;background:#0c0c0c}
      .nx-sol57-voice-top strong{flex:1;font-size:17px}.nx-sol57-voice-close,.nx-sol57-voice-gear{width:42px;height:42px;border:0;border-radius:50%;background:#202020;color:#eee;font-size:20px}
      .nx-sol57-voice-stage{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 18px 18px;text-align:center}
      .nx-sol57-voice-orb{width:154px;height:154px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#777 0,#343434 32%,#171717 68%,#0a0a0a 100%);box-shadow:0 0 0 1px #333,0 28px 80px rgba(255,255,255,.08);transition:.25s transform,.25s box-shadow}
      .nx-sol57-voice-orb:before{content:'✦';font-size:46px;color:#efefef;opacity:.92}.nx-sol57-voice-orb.listening{transform:scale(1.04);box-shadow:0 0 0 2px #686868,0 0 48px rgba(255,255,255,.16)}.nx-sol57-voice-orb.speaking{animation:nxSolVoicePulse 1.35s ease-in-out infinite}@keyframes nxSolVoicePulse{50%{transform:scale(1.065);box-shadow:0 0 0 3px #555,0 0 58px rgba(255,255,255,.14)}}
      .nx-sol57-voice-state{margin-top:26px;font-weight:720;font-size:19px}.nx-sol57-voice-status{max-width:620px;min-height:42px;margin-top:9px;color:#9c9c9c;font-size:13px;line-height:1.45}.nx-sol57-voice-status[data-tone="error"]{color:#ffaaa8}.nx-sol57-voice-status[data-tone="ok"]{color:#b8e9c7}
      .nx-sol57-voice-provider{margin-top:14px;padding:7px 11px;border:1px solid #343434;border-radius:999px;color:#bcbcbc;font-size:11px;background:#161616}
      .nx-sol57-voice-controls{display:flex;align-items:center;justify-content:center;gap:18px;padding:18px 18px calc(20px + env(safe-area-inset-bottom));border-top:1px solid #202020;background:#0c0c0c}.nx-sol57-voice-round{width:58px;height:58px;border:0;border-radius:50%;background:#222;color:#eee;font-size:23px}.nx-sol57-voice-round.primary{width:68px;height:68px;background:#f2f2f2;color:#111}.nx-sol57-voice-round.danger{background:#392020;color:#ffb0ad}
      .nx-sol57-voice-settings-back{position:fixed;inset:0;z-index:10340;background:rgba(0,0,0,.64);display:flex;align-items:flex-end;justify-content:center}.nx-sol57-voice-settings{width:min(620px,100%);max-height:88dvh;overflow:auto;padding:18px 16px calc(22px + env(safe-area-inset-bottom));border:1px solid #383838;border-bottom:0;border-radius:24px 24px 0 0;background:#1b1b1b;color:#f2f2f2}
      .nx-sol57-voice-settings h3{margin:0 0 15px;font-size:18px}.nx-sol57-voice-settings label{display:block;margin:12px 0 6px;color:#aaa;font-size:11px;font-weight:700}.nx-sol57-voice-field{width:100%;height:46px;padding:0 12px;border:1px solid #3d3d3d;border-radius:12px;background:#111;color:#eee;font:13px system-ui}.nx-sol57-voice-note{margin:8px 0;color:#8d8d8d;font-size:11px;line-height:1.45}.nx-sol57-voice-toggle{display:flex;align-items:center;gap:9px;min-height:40px;color:#ddd;font-size:13px}.nx-sol57-voice-save{width:100%;height:46px;margin-top:14px;border:0;border-radius:13px;background:#f1f1f1;color:#111;font-weight:750}
      .nx-sol57-voice-launch{position:fixed;right:18px;bottom:92px;z-index:90;width:48px;height:48px;border:1px solid #414141;border-radius:50%;background:#242424;color:#eee;box-shadow:0 8px 28px rgba(0,0,0,.36);font-size:20px}
      @media(min-width:900px){.nx-sol57-voice-launch{right:28px;bottom:28px}.nx-sol57-voice-settings-back{align-items:center}.nx-sol57-voice-settings{border-bottom:1px solid #383838;border-radius:24px}}
      @media(prefers-reduced-motion:reduce){.nx-sol57-voice-orb.speaking{animation:none}}
    `;document.head.appendChild(s);
  }

  function chooseSystemVoice(gender='auto',lang=language()){
    const voices=window.speechSynthesis?.getVoices?.()||[];if(!voices.length)return null;
    const female=/(Jenny|Aria|Sonia|Zira|Samantha|Karen|Susan|Female|Ava|Emma|Joanna|Salli)/i;
    const male=/(Guy|Ryan|David|Mark|Daniel|Alex|Male|Brian|Matthew|Arthur)/i;
    const natural=/(Natural|Neural|Online|Premium|Enhanced|Google|Microsoft)/i;
    return [...voices].sort((a,b)=>{
      const score=v=>{let n=0;const name=String(v.name||''),vl=String(v.lang||'');if(vl.toLowerCase().startsWith(String(lang).slice(0,2).toLowerCase()))n+=50;if(natural.test(name))n+=22;if(gender==='female'&&female.test(name))n+=40;if(gender==='male'&&male.test(name))n+=40;if(gender==='auto')n+=5;return n};return score(b)-score(a)
    })[0]||voices[0];
  }

  function stopOutput(){
    speaking=false;clearTimeout(resumeTimer);try{window.NexusNovaVoice?.stop?.()}catch(_){}try{window.speechSynthesis?.cancel?.()}catch(_){}try{audio?.pause?.()}catch(_){}audio=null;syncOrb();
  }
  function syncOrb(){const orb=$('nxSol57VoiceOrb'),state=$('nxSol57VoiceState');if(!orb)return;orb.classList.toggle('listening',listening&&!speaking);orb.classList.toggle('speaking',speaking);if(state)state.textContent=speaking?'NOVA is speaking':listening?'Listening':'Voice paused'}

  async function systemSpeak(text,p){
    if(!('speechSynthesis' in window))throw new Error('System speech output is not supported on this device');
    stopOutput();speaking=true;syncOrb();
    const cfg=read();const gender=p.gender||cfg.gender;const lang=language();const chunks=String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?۔؟])\s+/).filter(Boolean);
    const voice=chooseSystemVoice(gender,lang);
    await new Promise(resolve=>{
      let i=0;const next=()=>{if(!speaking||i>=chunks.length){speaking=false;syncOrb();resolve();return}const u=new SpeechSynthesisUtterance(chunks[i++]);u.lang=lang;if(voice)u.voice=voice;u.rate=cfg.rate;u.pitch=cfg.pitch;u.volume=1;u.onend=next;u.onerror=()=>{speaking=false;syncOrb();resolve()};window.speechSynthesis.speak(u)};next();
    });
  }

  async function gatewaySpeak(text,p){
    if(!paired())throw new Error('Pair the NOVA local gateway first; provider keys stay on the server');
    stopOutput();speaking=true;syncOrb();status(`Connecting to ${p.label}…`);
    const cfg=readCfg(),vc=read();
    const r=await fetch(baseUrl()+'/api/voice/synthesize',{method:'POST',headers:{'Content-Type':'application/json','X-NexusNova-Token':cfg.token},body:JSON.stringify({provider:vc.provider,text:String(text||''),language:vc.language,gender:vc.gender,quality:'natural',format:'mp3'})});
    const type=String(r.headers.get('content-type')||'');
    if(!r.ok){let msg=`HTTP ${r.status}`;try{const j=await r.json();msg=j.error||msg}catch(_){}throw new Error(msg)}
    let src='';
    if(type.includes('application/json')){const j=await r.json();if(!j.ok&&j.error)throw new Error(j.error);if(j.audio_url)src=j.audio_url;else if(j.audio_base64)src='data:audio/mpeg;base64,'+j.audio_base64;else throw new Error('Voice backend returned no audio')}
    else{const blob=await r.blob();src=URL.createObjectURL(blob)}
    await new Promise((resolve,reject)=>{audio=new Audio(src);audio.onended=()=>{speaking=false;audio=null;syncOrb();resolve()};audio.onerror=()=>{speaking=false;audio=null;syncOrb();reject(new Error('Voice audio playback failed'))};audio.play().catch(reject)});
  }

  async function speak(text){
    const clean=String(text||'').trim();if(!clean||!session||!read().autoSpeak)return;
    const p=provider();try{if(p.kind==='system')await systemSpeak(clean,p);else await gatewaySpeak(clean,p);status('Ready for your reply','ok')}catch(e){speaking=false;syncOrb();status(e.message,'error')}
    if(session&&read().autoListen)resumeTimer=setTimeout(()=>startListening(),220);
  }

  function assistantText(){
    const rows=[...document.querySelectorAll('#aiBox .ai-message:not(.user) .ai-bubble')];
    return String(rows.at(-1)?.textContent||'').trim();
  }
  function observeReplies(){
    const box=$('aiBox');if(!box||box.__nxSol57VoiceObserver)return;
    const o=new MutationObserver(()=>{if(!session)return;const text=assistantText();if(text&&text!==lastAssistantText){lastAssistantText=text;stopListening();setTimeout(()=>speak(text),120)}});o.observe(box,{childList:true,subtree:true,characterData:true});box.__nxSol57VoiceObserver=o;
  }

  function submitTranscript(text){
    const clean=String(text||'').trim();if(!clean)return;const input=$('aiInput'),send=$('aiSendBtn');if(!input||!send){status('NOVA chat composer is not ready','error');return}
    stopListening();stopOutput();status(`You: ${clean}`);input.value=clean;input.dispatchEvent(new Event('input',{bubbles:true}));send.click();
  }

  function recognitionCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition}
  function startListening(){
    if(!session||listening)return false;const SR=recognitionCtor();if(!SR){status('Speech recognition is not supported here. You can still use voice output.','error');return false}
    if(speaking)stopOutput();
    try{recognition=new SR();recognition.lang=language();recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;
      recognition.onstart=()=>{listening=true;syncOrb();status('Listening… speak naturally')};
      recognition.onresult=e=>{let final='',interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)final+=t;else interim+=t}status(final?`Heard: ${final}`:interim?`Hearing: ${interim}`:'Listening…');if(final)submitTranscript(final)};
      recognition.onerror=e=>{listening=false;syncOrb();if(!['aborted','no-speech'].includes(e.error))status(`Microphone: ${e.error||'voice input error'}`,'error')};
      recognition.onend=()=>{listening=false;syncOrb();if(session&&read().autoListen&&!speaking)resumeTimer=setTimeout(()=>startListening(),420)};
      recognition.start();return true;
    }catch(e){listening=false;syncOrb();status(e.message,'error');return false}
  }
  function stopListening(){clearTimeout(resumeTimer);if(recognition){try{recognition.onend=null;recognition.stop()}catch(_){}recognition=null}listening=false;syncOrb()}
  function interrupt(){stopOutput();stopListening();status('Interrupted • listening for you');if(session)setTimeout(()=>startListening(),100)}

  function providerOptions(){return Object.entries(PROVIDERS).map(([key,p])=>`<option value="${key}">${esc(p.label)} — ${p.tier}</option>`).join('')}
  function openSettings(){
    document.querySelector('.nx-sol57-voice-settings-back')?.remove();const v=read();const back=document.createElement('div');back.className='nx-sol57-voice-settings-back';back.innerHTML=`<section class="nx-sol57-voice-settings"><h3>Live Voice settings</h3>
      <label>Voice provider</label><select id="nxSol57VoiceProvider" class="nx-sol57-voice-field">${providerOptions()}</select><div id="nxSol57VoiceProviderNote" class="nx-sol57-voice-note"></div>
      <label>Voice style</label><select id="nxSol57VoiceGender" class="nx-sol57-voice-field"><option value="auto">Auto / best match</option><option value="female">Female</option><option value="male">Male</option></select>
      <label>Speech language</label><select id="nxSol57VoiceLanguage" class="nx-sol57-voice-field"><option value="en-US">English / Roman Urdu</option><option value="ur-PK">Urdu</option><option value="hi-IN">Hindi</option><option value="en-GB">English (UK)</option></select>
      <label class="nx-sol57-voice-toggle"><input id="nxSol57VoiceAutoListen" type="checkbox"> Continue listening automatically</label>
      <label class="nx-sol57-voice-toggle"><input id="nxSol57VoiceAutoSpeak" type="checkbox"> Speak NOVA replies automatically</label>
      <label class="nx-sol57-voice-toggle"><input id="nxSol57VoiceBarge" type="checkbox"> Tap-to-interrupt / barge-in</label>
      <div class="nx-sol57-voice-note">FREE system voices use your device/browser. FREE local voices need a local TTS engine. PAID options need a provider account configured securely on the NexusNova gateway; API keys are never stored in this page.</div>
      <button id="nxSol57VoiceSave" class="nx-sol57-voice-save" type="button">Save voice settings</button></section>`;document.body.appendChild(back);
    const providerEl=$('nxSol57VoiceProvider'),genderEl=$('nxSol57VoiceGender'),langEl=$('nxSol57VoiceLanguage');providerEl.value=v.provider;genderEl.value=v.gender;langEl.value=v.language;$('nxSol57VoiceAutoListen').checked=!!v.autoListen;$('nxSol57VoiceAutoSpeak').checked=!!v.autoSpeak;$('nxSol57VoiceBarge').checked=!!v.bargeIn;
    const note=()=>{const p=PROVIDERS[providerEl.value];$('nxSol57VoiceProviderNote').textContent=`${p.tier} • ${p.desc}${p.kind==='gateway'&&!paired()?' • gateway not paired':''}`};note();providerEl.onchange=note;
    back.onclick=e=>{if(e.target===back)back.remove()};$('nxSol57VoiceSave').onclick=()=>{save({provider:providerEl.value,gender:genderEl.value,language:langEl.value,autoListen:$('nxSol57VoiceAutoListen').checked,autoSpeak:$('nxSol57VoiceAutoSpeak').checked,bargeIn:$('nxSol57VoiceBarge').checked});back.remove();renderProvider();status('Voice settings saved','ok')};
  }

  function renderProvider(){const el=$('nxSol57VoiceProviderBadge');if(!el)return;const p=provider();el.textContent=`${p.label} • ${p.tier}${p.kind==='gateway'&&!paired()?' • not configured':''}`}
  function close(){session=false;stopListening();stopOutput();document.querySelector('.nx-sol57-voice-back')?.remove()}
  function open(){
    installStyle();document.querySelector('.nx-sol57-voice-back')?.remove();session=true;lastAssistantText=assistantText();const back=document.createElement('div');back.className='nx-sol57-voice-back';back.innerHTML=`<header class="nx-sol57-voice-top"><button id="nxSol57VoiceClose" class="nx-sol57-voice-close" type="button">×</button><strong>NOVA Live Voice</strong><button id="nxSol57VoiceGear" class="nx-sol57-voice-gear" type="button">⚙</button></header><main class="nx-sol57-voice-stage"><div id="nxSol57VoiceOrb" class="nx-sol57-voice-orb"></div><div id="nxSol57VoiceState" class="nx-sol57-voice-state">Voice paused</div><div id="nxSol57VoiceStatus" class="nx-sol57-voice-status">Tap the microphone and speak naturally.</div><div id="nxSol57VoiceProviderBadge" class="nx-sol57-voice-provider"></div></main><footer class="nx-sol57-voice-controls"><button id="nxSol57VoiceStop" class="nx-sol57-voice-round danger" type="button" title="Interrupt">■</button><button id="nxSol57VoiceMic" class="nx-sol57-voice-round primary" type="button" title="Talk">🎤</button><button id="nxSol57VoiceSettings" class="nx-sol57-voice-round" type="button" title="Voice settings">☰</button></footer>`;document.body.appendChild(back);renderProvider();syncOrb();observeReplies();
    $('nxSol57VoiceClose').onclick=close;$('nxSol57VoiceGear').onclick=openSettings;$('nxSol57VoiceSettings').onclick=openSettings;$('nxSol57VoiceStop').onclick=interrupt;$('nxSol57VoiceMic').onclick=()=>{if(speaking||listening)interrupt();else startListening()};
    const p=provider();if(p.kind==='gateway'&&!paired())status(`${p.label} selected, but NOVA gateway is not paired. Choose a FREE system voice or configure the gateway.`,'error');else status('Ready • tap the microphone and talk','ok');
  }

  function installLaunch(){
    installStyle();if(!$('nxSol57VoiceLaunch')){const b=document.createElement('button');b.id='nxSol57VoiceLaunch';b.className='nx-sol57-voice-launch';b.type='button';b.title='NOVA Live Voice';b.textContent='◉';b.onclick=open;document.body.appendChild(b)}
    document.querySelectorAll('#tab-ai .nx-sol57-nav,#tab-ai .nx-sol57-desktop-nav').forEach(nav=>{if(nav.querySelector('[data-sol57-livevoice]'))return;const b=document.createElement('button');b.type='button';b.dataset.sol57Livevoice='1';b.innerHTML='<span class="ico">◉</span>Live Voice <small>NEW</small>';b.onclick=e=>{e.preventDefault();open()};nav.appendChild(b)});
    const menu=document.querySelector('#tab-ai .nx-nova-plus-menu');if(menu&&!menu.querySelector('[data-sol57-livevoice]')){const b=document.createElement('button');b.type='button';b.className='nx-nova-plus-item';b.dataset.sol57Livevoice='1';b.innerHTML='<span style="width:18px;text-align:center">◉</span><span>Live Voice<small class="nx-v6-mini">Natural two-way voice conversation</small></span>';b.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();open()};menu.appendChild(b)}
  }

  function init(){installLaunch();observeReplies();const tab=$('tab-ai');if(tab&&!tab.__nxSol57VoiceLaunchObserver){const o=new MutationObserver(()=>requestAnimationFrame(installLaunch));o.observe(tab,{childList:true,subtree:true});tab.__nxSol57VoiceLaunchObserver=o}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [800,1800,3600].forEach(ms=>setTimeout(installLaunch,ms));

  window.NexusNovaSol57LiveVoice={open,close,openSettings,startListening,stopListening,interrupt,speak,providers:PROVIDERS,read,save,paired,version:'1.0.0'};
})();