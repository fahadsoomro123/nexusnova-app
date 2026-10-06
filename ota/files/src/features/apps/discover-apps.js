import { firebaseApp, readUserProfile, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

async function scopedKey(name) {
  try { const user = await requireFirebaseUser(); return `nexus_fresh_${name}_${user.uid}`; }
  catch { return `nexus_fresh_${name}_device`; }
}

function safeHttpUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) return '';
  try {
    const value = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(value);
    return ['http:','https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function openInBrowser(url) {
  const safe = safeHttpUrl(url);
  if (!safe) return false;
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url:safe }));
      return true;
    }
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal',{url:safe})) return true;
    window.open(safe,'_blank','noopener,noreferrer');
    return true;
  } catch { return false; }
}

export function renderBrowser() {
  const root = node(`
    <section class="nx-browser-shell nx-panel">
      <div class="nx-browser-bar"><input data-browser-input inputmode="url" autocomplete="off" placeholder="Search or enter URL"><button type="button" data-browser-go>GO</button></div>
      <div class="nx-browser-grid">
        <button type="button" data-browser-site="https://www.google.com">Google</button>
        <button type="button" data-browser-site="https://www.wikipedia.org">Wikipedia</button>
        <button type="button" data-browser-site="https://www.youtube.com">YouTube</button>
        <button type="button" data-browser-site="https://github.com">GitHub</button>
      </div>
      <div class="nx-browser-privacy"><strong>Safe handoff</strong><p>Android opens HTTPS pages in NexusNova's dedicated browser activity. Remote pages do not receive NexusNova's privileged native bridge.</p></div>
      <p class="nx-tool-meta" data-browser-status>Ready.</p>
    </section>
  `);
  const input = root.querySelector('[data-browser-input]');
  const status = root.querySelector('[data-browser-status]');
  const go = value => {
    const raw = String(value || input.value).trim();
    let url = safeHttpUrl(raw);
    if (!url || (!raw.includes('.') && !/^https?:/i.test(raw))) url = `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
    if (!openInBrowser(url)) status.textContent = 'Could not open that address.';
    else status.textContent = 'Opening secure browser…';
  };
  root.querySelector('[data-browser-go]').addEventListener('click', () => go());
  input.addEventListener('keydown', event => { if (event.key === 'Enter') go(); });
  root.querySelectorAll('[data-browser-site]').forEach(button => button.addEventListener('click', () => go(button.dataset.browserSite)));
  return root;
}

async function fetchFeed(query, language = 'en') {
  const hl = language === 'ur' ? 'ur' : 'en-PK';
  const ceid = language === 'ur' ? 'PK:ur' : 'PK:en';
  const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=PK&ceid=${ceid}`;
  try {
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
    const json = await response.json();
    if (json?.status && json.status !== 'ok') throw new Error(json.message || 'RSS service failed');
    return (json.items || []).map(item => ({
      title:String(item.title || '').replace(/\s+-\s+[^-]+$/,''),
      link:safeHttpUrl(item.link),
      date:item.pubDate || '',
      source:String(item.author || item.title?.split(' - ').pop() || 'News').slice(0,80)
    })).filter(item => item.title.length > 8 && item.link).slice(0,30);
  } catch (firstError) {
    const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(rss)}`, { cache:'no-store' });
    if (!response.ok) throw firstError;
    const xml = await response.text();
    const doc = new DOMParser().parseFromString(xml,'text/xml');
    return [...doc.querySelectorAll('item')].map(item => ({
      title:String(item.querySelector('title')?.textContent || '').replace(/\s+-\s+[^-]+$/,''),
      link:safeHttpUrl(item.querySelector('link')?.textContent || ''),
      date:item.querySelector('pubDate')?.textContent || '',
      source:item.querySelector('source')?.textContent || 'News'
    })).filter(item => item.title.length > 8 && item.link).slice(0,30);
  }
}

function renderNewsLike({ query = 'Pakistan latest news', label = 'Pakistan News' } = {}) {
  const root = node(`
    <section class="nx-tool-card"><div class="nx-list-card__head"><div><strong>${escapeHtml(label)}</strong><p class="nx-tool-meta" data-news-status style="margin-top:3px">Loading live headlines…</p></div><button class="nx-secondary nx-fit" type="button" data-news-refresh>REFRESH</button></div></section>
    <section class="nx-stack" data-news-list></section>
  `);
  const list = root.querySelector('[data-news-list]');
  const status = root.querySelector('[data-news-status]');
  let busy = false;
  const load = async () => {
    if (busy) return; busy = true; status.textContent = 'Loading live headlines…';
    try {
      const items = await fetchFeed(query);
      if (!items.length) throw new Error('No current stories returned.');
      list.innerHTML = items.map(item => `<button class="nx-news-card" type="button" data-news-url="${escapeHtml(item.link)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.source)}${item.date ? ` • ${new Date(item.date).toLocaleString()}` : ''}</span></button>`).join('');
      list.querySelectorAll('[data-news-url]').forEach(button => button.addEventListener('click', () => openInBrowser(button.dataset.newsUrl)));
      status.textContent = `${items.length} live headlines • tap a story to open source`;
    } catch (error) {
      list.innerHTML = '<div class="nx-empty">News provider unavailable right now.</div>';
      status.textContent = 'Could not load live headlines. No cached/fake headlines are shown.';
      console.warn('[NexusNova Fresh] news:', error);
    } finally { busy = false; }
  };
  root.querySelector('[data-news-refresh]').addEventListener('click',load);
  load();
  return root;
}

export function renderNews() { return renderNewsLike({ query:'Pakistan latest news', label:'Live News' }); }
export function renderPakistan() { return renderNewsLike({ query:'Pakistan Sindh Karachi latest news', label:'Pakistan Hub • Live Headlines' }); }

export function renderTravel() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col"><label class="nx-field"><span>From</span><input maxlength="80" data-travel-from placeholder="Karachi"></label><label class="nx-field"><span>To</span><input maxlength="80" data-travel-to placeholder="Islamabad"></label></div>
      <label class="nx-field"><span>Travel date</span><input type="date" data-travel-date></label>
      <div class="nx-travel-actions"><button type="button" data-travel-type="flights">FLIGHTS</button><button type="button" data-travel-type="trains">TRAINS</button><button type="button" data-travel-type="buses">BUSES</button><button type="button" data-travel-type="hotels">HOTELS</button></div>
      <p class="nx-tool-meta" data-travel-status>NexusNova opens a live web search for availability and prices; it does not invent schedules or fares.</p>
    </section>
  `);
  const from = root.querySelector('[data-travel-from]');
  const to = root.querySelector('[data-travel-to]');
  const date = root.querySelector('[data-travel-date]');
  const status = root.querySelector('[data-travel-status]');
  date.value = new Date(Date.now()+86_400_000).toISOString().slice(0,10);
  root.querySelectorAll('[data-travel-type]').forEach(button => button.addEventListener('click', () => {
    const a = from.value.trim(), b = to.value.trim();
    if (!b) { status.textContent = 'Enter a destination first.'; return; }
    const type = button.dataset.travelType;
    const query = type === 'hotels'
      ? `hotels in ${b} ${date.value}`
      : `${type} from ${a || 'my city'} to ${b} ${date.value} live price schedule`;
    openInBrowser(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    status.textContent = `Opening live ${type} search…`;
  }));
  return root;
}

export function renderFinance() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col"><label class="nx-field"><span>Amount</span><input type="number" min="0" step="any" data-fx-amount value="1"></label><label class="nx-field"><span>From</span><select data-fx-from></select></label></div>
      <label class="nx-field"><span>To</span><select data-fx-to></select></label>
      <div class="nx-result" data-fx-result>Loading live rates…</div>
      <button class="nx-secondary" type="button" data-fx-refresh>REFRESH LIVE FX</button>
      <p class="nx-tool-meta" data-fx-status>Rates are informational and not a bank quote.</p>
    </section>
  `);
  const codes=['USD','PKR','EUR','GBP','AED','SAR','CAD','AUD','JPY','CNY','INR','TRY'];
  const amount=root.querySelector('[data-fx-amount]'),from=root.querySelector('[data-fx-from]'),to=root.querySelector('[data-fx-to]'),result=root.querySelector('[data-fx-result]'),status=root.querySelector('[data-fx-status]');
  [from,to].forEach(select=>select.innerHTML=codes.map(code=>`<option>${code}</option>`).join(''));from.value='USD';to.value='PKR';let rates=null,base='USD',busy=false;
  const calculate=()=>{const n=Number(amount.value);if(!rates||!Number.isFinite(n)){result.textContent='—';return;}const fromRate=from.value===base?1:Number(rates[from.value]);const toRate=to.value===base?1:Number(rates[to.value]);if(!(fromRate>0&&toRate>0)){result.textContent='Rate unavailable';return;}const converted=(n/fromRate)*toRate;result.textContent=`${n.toLocaleString()} ${from.value} = ${converted.toLocaleString(undefined,{maximumFractionDigits:4})} ${to.value}`;};
  const load=async()=>{if(busy)return;busy=true;status.textContent='Loading live exchange rates…';try{const response=await fetch('https://open.er-api.com/v6/latest/USD',{cache:'no-store'});if(!response.ok)throw new Error(`FX HTTP ${response.status}`);const data=await response.json();if(!data?.rates)throw new Error('Rates missing');rates=data.rates;base=data.base_code||'USD';status.textContent=`Live FX • updated ${data.time_last_update_utc||'recently'}`;calculate();}catch(error){rates=null;result.textContent='Live FX unavailable';status.textContent='Exchange-rate provider unavailable. No guessed rate is shown.';console.warn('[NexusNova Fresh] fx:',error);}finally{busy=false;}};
  [amount,from,to].forEach(el=>el.addEventListener('input',calculate));root.querySelector('[data-fx-refresh]').addEventListener('click',load);load();return root;
}

export function renderLearning() {
  const root=node(`<section class="nx-tool-card"><div class="nx-two-col"><label class="nx-field"><span>Question / term</span><input maxlength="220" data-card-q></label><label class="nx-field"><span>Answer</span><input maxlength="500" data-card-a></label></div><button class="nx-primary" type="button" data-card-add>ADD FLASHCARD</button></section><section class="nx-stack" data-card-list></section>`);
  const q=root.querySelector('[data-card-q]'),a=root.querySelector('[data-card-a]'),list=root.querySelector('[data-card-list]');let key='';
  const draw=()=>{if(!key)return;const cards=loadJson(key,[]);list.innerHTML=cards.length?cards.map(card=>`<article class="nx-flash-card" data-card-id="${escapeHtml(card.id)}"><strong>${escapeHtml(card.q)}</strong><p hidden>${escapeHtml(card.a)}</p><span>Tap to reveal</span><button class="nx-icon-button" type="button" data-card-delete="${escapeHtml(card.id)}">×</button></article>`).join(''):'<div class="nx-empty">No flashcards yet.</div>';list.querySelectorAll('.nx-flash-card').forEach(card=>card.addEventListener('click',event=>{if(event.target.closest('[data-card-delete]'))return;const p=card.querySelector('p'),hint=card.querySelector('span');p.hidden=!p.hidden;hint.textContent=p.hidden?'Tap to reveal':'Tap to hide';}));list.querySelectorAll('[data-card-delete]').forEach(b=>b.addEventListener('click',()=>{saveJson(key,loadJson(key,[]).filter(x=>x.id!==b.dataset.cardDelete));draw();}));};
  scopedKey('flashcards_v1').then(v=>{key=v;draw();});root.querySelector('[data-card-add]').addEventListener('click',()=>{if(!key||!q.value.trim()||!a.value.trim())return;const cards=loadJson(key,[]);cards.push({id:uid('card'),q:q.value.trim(),a:a.value.trim()});saveJson(key,cards.slice(-500));q.value=a.value='';draw();});return root;
}

export function renderTeacher() {
  const root=node(`<section class="nx-tool-card"><div class="nx-two-col"><label class="nx-field"><span>Subject</span><input maxlength="80" data-lesson-subject></label><label class="nx-field"><span>Class</span><input maxlength="40" data-lesson-class></label></div><label class="nx-field"><span>Topic</span><input maxlength="140" data-lesson-topic></label><label class="nx-field"><span>Objective</span><textarea rows="3" maxlength="500" data-lesson-objective></textarea></label><label class="nx-field"><span>Activities / notes</span><textarea rows="5" maxlength="1500" data-lesson-notes></textarea></label><button class="nx-primary" type="button" data-lesson-save>SAVE LESSON PLAN</button></section><section class="nx-stack" data-lesson-list></section>`);
  const fields=['subject','class','topic','objective','notes'].reduce((acc,key)=>(acc[key]=root.querySelector(`[data-lesson-${key}]`),acc),{});const list=root.querySelector('[data-lesson-list]');let key='';
  const draw=()=>{if(!key)return;const plans=loadJson(key,[]);list.innerHTML=plans.length?plans.slice().reverse().map(plan=>`<article class="nx-list-card"><div class="nx-list-card__head"><strong>${escapeHtml(plan.subject)} • ${escapeHtml(plan.className)}</strong><button class="nx-icon-button" type="button" data-lesson-delete="${escapeHtml(plan.id)}">×</button></div><p><b>${escapeHtml(plan.topic)}</b><br>${escapeHtml(plan.objective)}<br>${escapeHtml(plan.notes).replace(/\n/g,'<br>')}</p><small>${new Date(plan.at).toLocaleString()}</small></article>`).join(''):'<div class="nx-empty">No lesson plans saved.</div>';list.querySelectorAll('[data-lesson-delete]').forEach(b=>b.addEventListener('click',()=>{saveJson(key,loadJson(key,[]).filter(x=>x.id!==b.dataset.lessonDelete));draw();}));};
  scopedKey('teacher_v1').then(v=>{key=v;draw();});root.querySelector('[data-lesson-save]').addEventListener('click',()=>{if(!key||!fields.subject.value.trim()||!fields.topic.value.trim())return;const plans=loadJson(key,[]);plans.push({id:uid('lesson'),subject:fields.subject.value.trim(),className:fields.class.value.trim(),topic:fields.topic.value.trim(),objective:fields.objective.value.trim(),notes:fields.notes.value.trim(),at:new Date().toISOString()});saveJson(key,plans.slice(-200));Object.values(fields).forEach(field=>field.value='');draw();});return root;
}

export function renderDocuments() {
  const root=node(`<section class="nx-tool-card"><label class="nx-file-picker"><input type="file" multiple accept="application/pdf,text/plain,text/markdown,image/*" data-doc-files><strong>Choose documents</strong><span>PDF, text, markdown or images • max 5 files per selection</span></label><p class="nx-tool-meta" data-doc-status>Files stay in memory for this screen unless another backend is explicitly connected.</p></section><section class="nx-stack" data-doc-list></section><section class="nx-tool-card" data-doc-preview hidden></section>`);
  const input=root.querySelector('[data-doc-files]'),list=root.querySelector('[data-doc-list]'),preview=root.querySelector('[data-doc-preview]'),status=root.querySelector('[data-doc-status]');let files=[];
  const draw=()=>{list.innerHTML=files.length?files.map((file,index)=>`<button class="nx-doc-row" type="button" data-doc-index="${index}"><strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.type||'unknown')} • ${(file.size/1024).toFixed(1)} KB</span></button>`).join(''):'<div class="nx-empty">No documents selected.</div>';list.querySelectorAll('[data-doc-index]').forEach(button=>button.addEventListener('click',async()=>{const file=files[Number(button.dataset.docIndex)];if(!file)return;preview.hidden=false;if(file.type.startsWith('text/')||/\.(txt|md)$/i.test(file.name)){if(file.size>1_000_000){preview.textContent='Text preview limited to files under 1 MB.';return;}preview.textContent=(await file.text()).slice(0,20_000);}else if(file.type.startsWith('image/')){const img=new Image();img.alt=file.name;img.src=URL.createObjectURL(file);preview.replaceChildren(img);}else preview.textContent='PDF metadata is available above. Full PDF rendering is not enabled in this fresh pass.';}));};
  input.addEventListener('change',()=>{files=[...input.files].slice(0,5);status.textContent=`${files.length} file${files.length===1?'':'s'} selected • no upload performed`;preview.hidden=true;draw();});draw();root.__cleanup=()=>files.forEach(file=>{try{URL.revokeObjectURL(file);}catch{}});return root;
}

export function renderEntertainment() {
  const root=node(`<section class="nx-tool-card"><div class="nx-inline-field"><input maxlength="140" data-watch-input placeholder="Add movie, show, video or book"><button type="button" data-watch-add>ADD</button></div><p class="nx-tool-meta">Personal watch/read list. NexusNova does not host copyrighted media.</p></section><section class="nx-stack" data-watch-list></section>`);
  const input=root.querySelector('[data-watch-input]'),list=root.querySelector('[data-watch-list]');let key='';const draw=()=>{if(!key)return;const items=loadJson(key,[]);list.innerHTML=items.length?items.map(item=>`<article class="nx-list-card nx-todo-row ${item.done?'done':''}"><label><input type="checkbox" data-watch-toggle="${escapeHtml(item.id)}" ${item.done?'checked':''}><span>${escapeHtml(item.name)}</span></label><button class="nx-icon-button" type="button" data-watch-delete="${escapeHtml(item.id)}">×</button></article>`).join(''):'<div class="nx-empty">Your watchlist is empty.</div>';list.querySelectorAll('[data-watch-toggle]').forEach(c=>c.addEventListener('change',()=>{const items=loadJson(key,[]);const item=items.find(x=>x.id===c.dataset.watchToggle);if(item)item.done=c.checked;saveJson(key,items);draw();}));list.querySelectorAll('[data-watch-delete]').forEach(b=>b.addEventListener('click',()=>{saveJson(key,loadJson(key,[]).filter(x=>x.id!==b.dataset.watchDelete));draw();}));};scopedKey('entertainment_v1').then(v=>{key=v;draw();});const add=()=>{if(!key||!input.value.trim())return;const items=loadJson(key,[]);items.push({id:uid('watch'),name:input.value.trim(),done:false});saveJson(key,items.slice(-500));input.value='';draw();};root.querySelector('[data-watch-add]').addEventListener('click',add);return root;
}

function detectLanguage(text) { return /[\u0600-\u06FF]/.test(String(text||'')) ? 'ur-PK' : 'en-US'; }
function speak(text) {
  if (!('speechSynthesis' in window)) return false;
  const voices=window.speechSynthesis.getVoices?.()||[];
  const female=/(jenny|aria|sonia|zira|samantha|karen|ava|susan|victoria|female|natasha|serena|hazel)/i;
  const voice=[...voices].sort((a,b)=>(female.test(b.name)?2:0)-(female.test(a.name)?2:0))[0];
  const utterance=new SpeechSynthesisUtterance(String(text||'').slice(0,3500));utterance.lang=detectLanguage(text);if(voice)utterance.voice=voice;utterance.rate=.94;utterance.pitch=1.03;window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);return true;
}

export function renderAI() {
  const root=node(`<section class="nx-ai-shell nx-panel"><div class="nx-ai-messages" data-ai-messages><div class="nx-ai-msg bot"><strong>Nova AI</strong><p>Ask about your NVX account, mining, or a general question. I will not invent account values.</p></div></div><div class="nx-ai-compose"><textarea rows="2" maxlength="3000" data-ai-input placeholder="Ask Nova AI…"></textarea><button type="button" data-ai-send>ASK</button></div><div class="nx-action-row"><button type="button" data-ai-speak-last>SPEAK LAST</button><button type="button" data-ai-clear>CLEAR CHAT</button><button type="button" data-ai-remember>REMEMBER NOTE</button></div><p class="nx-tool-meta" data-ai-status>Firebase AI general-answer provider loads only when needed.</p></section>`);
  const messages=root.querySelector('[data-ai-messages]'),input=root.querySelector('[data-ai-input]'),send=root.querySelector('[data-ai-send]'),status=root.querySelector('[data-ai-status]');let lastReply='',busy=false,key='';
  const add=(text,who)=>{const div=document.createElement('div');div.className=`nx-ai-msg ${who}`;div.innerHTML=`<strong>${who==='user'?'You':'Nova AI'}</strong><p></p>`;div.querySelector('p').textContent=text;messages.appendChild(div);messages.scrollTop=messages.scrollHeight;};
  scopedKey('ai_notes_v1').then(v=>{key=v;});
  const deterministic=async text=>{const t=text.toLowerCase();if(/(balance|nvx).*(kitna|how much|my|mera)|(?:my|mera).*(balance|nvx)/i.test(t)){const p=await readUserProfile();const n=Number(p.balance);return Number.isFinite(n)?`Your current NexusNova balance is ${n.toLocaleString(undefined,{maximumFractionDigits:4})} NVX.`:'Your NVX balance is unavailable right now.';}if(/mining.*(status|active|timer)|(?:status|active).*mining/i.test(t)){const p=await readUserProfile();if(p.miningActive===true){const left=Math.max(0,86_400_000-(Date.now()-(Number(p.miningStartedAt)||0)));return `Mining is active. About ${(left/3_600_000).toFixed(2)} hours remain in the current 24-hour session.`;}return 'Mining is currently idle.';}if(/(?:my|mera|meri).*(name|email|profile)|(?:name|email|profile).*(my|mera|meri)/i.test(t)){const user=await requireFirebaseUser();const p=await readUserProfile(user);return `Name: ${p.name||user.displayName||'Unavailable'}\nEmail: ${user.email||'Unavailable'}`;}return '';};
  const ask=async()=>{const text=input.value.trim();if(!text||busy)return;busy=true;send.disabled=true;send.textContent='…';add(text,'user');input.value='';try{let reply=await deterministic(text);if(!reply){const [{getAI,getGenerativeModel,GoogleAIBackend}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js')]);const ai=getAI(firebaseApp,{backend:new GoogleAIBackend()});const model=getGenerativeModel(ai,{model:'gemini-3.6-flash',systemInstruction:{parts:[{text:'You are Nova AI inside NexusNova. Be concise, useful, and match the user language. Never invent balances, mining data, transactions, live prices, tickets, rewards or provider results. Never ask for passwords, seed phrases or private keys.'}]},generationConfig:{temperature:.5,maxOutputTokens:800}});const notes=key?loadJson(key,[]):[];const result=await model.generateContent(`Remembered user notes:\n${notes.join('\n')||'none'}\n\nUser request:\n${text}`);reply=String(result?.response?.text?.()||'').trim();}lastReply=reply||'AI returned no text.';add(lastReply,'bot');status.textContent='Nova AI ready.';}catch(error){lastReply='AI service is unavailable right now. Your account data was not changed.';add(lastReply,'bot');status.textContent=/app.?check|403|permission/i.test(String(error?.message||''))?'AI request was blocked by Firebase App Check / provider configuration.':'AI provider did not respond.';console.warn('[NexusNova Fresh] AI:',error);}finally{busy=false;send.disabled=false;send.textContent='ASK';}};
  send.addEventListener('click',ask);input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ask();}});root.querySelector('[data-ai-speak-last]').addEventListener('click',()=>{if(lastReply)speak(lastReply);});root.querySelector('[data-ai-clear]').addEventListener('click',()=>{messages.innerHTML='<div class="nx-ai-msg bot"><strong>Nova AI</strong><p>Chat cleared.</p></div>';lastReply='';});root.querySelector('[data-ai-remember]').addEventListener('click',()=>{const note=input.value.trim();if(!key||!note){status.textContent='Type a note in the message box first.';return;}const notes=loadJson(key,[]);if(!notes.includes(note))notes.push(note.slice(0,500));saveJson(key,notes.slice(-30));input.value='';status.textContent='Note remembered on this account/device.';});return root;
}

export const discoverRenderers = Object.freeze({
  browser:renderBrowser,
  news:renderNews,
  pakistan:renderPakistan,
  travel:renderTravel,
  finance:renderFinance,
  learning:renderLearning,
  teacher:renderTeacher,
  documents:renderDocuments,
  entertainment:renderEntertainment,
  ai:renderAI
});
