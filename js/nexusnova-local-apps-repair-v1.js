/* NexusNova Local Apps Repair v2
   Real local/browser tools using NexusNova Premium UI instead of browser prompt dialogs. */
(() => {
  'use strict';
  if (window.__nxLocalAppsRepairV2) return;
  window.__nxLocalAppsRepairV2 = true;
  window.__nxLocalAppsRepairV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const accountKey = name => `nxlocal_${name}:${String(window.nexusAccountId || 'guest')}`;
  let uiPromise = null;

  function getUI() {
    if (window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if (uiPromise) return uiPromise;
    uiPromise = new Promise((resolve,reject) => {
      const existing = document.querySelector('script[data-nx-premium-ui]');
      const done = () => window.NexusNovaUI ? resolve(window.NexusNovaUI) : reject(new Error('Premium UI did not initialize.'));
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, {once:true});
        setTimeout(done,1200);
        return;
      }
      const script = document.createElement('script');
      script.src = './js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi = '1';
      script.onload = done;
      script.onerror = () => reject(new Error('Premium UI could not be loaded.'));
      document.body.appendChild(script);
    }).finally(() => { uiPromise = null; });
    return uiPromise;
  }

  function toast(message) {
    if (window.NexusNovaUI) return window.NexusNovaUI.toast(message);
    let el = $('nxLocalRepairToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nxLocalRepairToast';
      el.className = 'nxmega-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._nxTimer);
    el._nxTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function buttonByLabel(tabId, label) {
    return Array.from(document.querySelectorAll(`#${tabId} button`)).find(button =>
      String(button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === label.toLowerCase()
    );
  }

  function claimButton(tabId, label, id, handler) {
    const button = buttonByLabel(tabId, label);
    if (!button || button.dataset.nxLocalReady === '1') return false;
    button.id = id;
    button.dataset.nxLocalReady = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve(handler(button)).catch(error=>console.error('NexusNova local tool:',error));
    });
    return true;
  }

  function openToolsQr() {
    if (typeof window.openMoreTab === 'function') window.openMoreTab('tools');
    else window.switchTab?.('tools');
    setTimeout(() => {
      window.nexusShowTool?.('qr');
      document.getElementById('tool-qr')?.scrollIntoView({behavior:'smooth',block:'start'});
    }, 120);
  }

  function generateMegaQr(payload) {
    const input = $('nxMegaQRText');
    const button = $('nxMegaQRBtn');
    if (!input || !button) return toast('QR generator is unavailable on this screen.');
    input.value = payload;
    input.dispatchEvent(new Event('input', {bubbles:true}));
    button.click();
  }

  async function wifiQr() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'QR TOOLS',
      title:'Create Wi‑Fi QR',
      subtitle:'Enter the network details. NexusNova will create a scannable Wi‑Fi connection QR code.',
      icon:'wifi',
      submitText:'Create Wi‑Fi QR',
      fields:[
        {name:'ssid',label:'Wi‑Fi Name (SSID)',icon:'wifi',placeholder:'e.g. Home WiFi',required:true,wide:true},
        {name:'password',label:'Wi‑Fi Password',icon:'lock',type:'password',placeholder:'Leave empty for open network',wide:true},
        {name:'security',label:'Security Type',icon:'security',type:'select',value:'WPA',options:['WPA','WEP','Open'],wide:true}
      ]
    });
    if (!data) return;
    const type = data.security === 'Open' || !data.password ? 'nopass' : data.security;
    const clean = value => String(value).replace(/([\\;,:"])/g, '\\$1');
    generateMegaQr(`WIFI:T:${type};S:${clean(data.ssid)};P:${clean(data.password)};;`);
  }

  async function contactQr() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'QR TOOLS',
      title:'Create Contact QR',
      subtitle:'Turn a person’s contact details into a vCard QR that phones can scan and save.',
      icon:'contact',
      submitText:'Create Contact QR',
      fields:[
        {name:'name',label:'Contact Name',icon:'contact',placeholder:'Full name',required:true,wide:true},
        {name:'phone',label:'Phone Number',icon:'user',placeholder:'+92 300 1234567'},
        {name:'email',label:'Email (optional)',icon:'subject',type:'email',placeholder:'name@example.com'}
      ]
    });
    if (!data) return;
    const lines = ['BEGIN:VCARD','VERSION:3.0',`FN:${data.name}`];
    if (data.phone) lines.push(`TEL:${data.phone}`);
    if (data.email) lines.push(`EMAIL:${data.email}`);
    lines.push('END:VCARD');
    generateMegaQr(lines.join('\n'));
  }

  function teacherOutput() {
    let out = $('nxTeacherLocalOut');
    if (out) return out;
    const tab = $('tab-mega-teacher');
    const card = tab?.querySelector('.card');
    if (!card) return null;
    out = document.createElement('div');
    out.id = 'nxTeacherLocalOut';
    out.className = 'tool-result nx-premium-result-host';
    out.style.marginTop = '12px';
    card.appendChild(out);
    return out;
  }

  async function lessonPlanner() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'TEACHER TOOLKIT', title:'Quick Lesson Plan', subtitle:'Create a simple local lesson-plan template when AI generation is unavailable.', icon:'lesson', submitText:'Create Plan',
      fields:[
        {name:'subject',label:'Subject',icon:'subject',placeholder:'e.g. English',required:true},
        {name:'grade',label:'Class / Grade',icon:'school',placeholder:'e.g. Grade 5',required:true},
        {name:'topic',label:'Lesson Topic',icon:'lesson',placeholder:'e.g. Nouns and Pronouns',required:true,wide:true}
      ]
    });
    if (!data) return;
    const out = teacherOutput();
    if (!out) return;
    const body = `<div><b>Objective</b><br>Students will understand the key ideas of ${esc(data.topic)}.</div><div style="margin-top:10px"><b>Warm-up • 5 min</b><br>Ask 2–3 questions to check prior knowledge.</div><div style="margin-top:10px"><b>Teaching • 15–20 min</b><br>Explain the concept with examples and student participation.</div><div style="margin-top:10px"><b>Practice • 10–15 min</b><br>Individual or pair activity based on the lesson.</div><div style="margin-top:10px"><b>Assessment</b><br>Use 3 quick questions or an exit ticket.</div><div style="margin-top:10px"><b>Homework</b><br>Short practice task related to ${esc(data.topic)}.</div>`;
    out.innerHTML = ui.resultShell({title:`Lesson Plan — ${data.subject}`,subtitle:`${data.grade} • ${data.topic}`,icon:'lesson',bodyHtml:body});
  }

  async function quizMaker() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'TEACHER TOOLKIT', title:'Quick Quiz Template', subtitle:'Create a blank classroom quiz template instantly on this device.', icon:'quiz', submitText:'Create Template',
      fields:[
        {name:'topic',label:'Quiz Topic',icon:'quiz',placeholder:'e.g. General Science',required:true,wide:true},
        {name:'count',label:'Number of Questions',icon:'number',type:'number',value:'5',min:1,max:20,required:true,wide:true}
      ]
    });
    if (!data) return;
    const count = Math.max(1, Math.min(20, Number(data.count) || 5));
    const out = teacherOutput();
    if (!out) return;
    const body = Array.from({length:count}, (_,i) => `<div style="margin-top:${i?9:0}px;padding:9px 0;border-bottom:1px solid rgba(100,160,225,.12)"><b>${i+1}.</b> ________________________________________________</div>`).join('');
    out.innerHTML = ui.resultShell({title:`${data.topic} — Quiz Template`,subtitle:`${count} questions`,icon:'quiz',bodyHtml:body,footer:'Teacher can copy this template and add exact questions/answers.'});
  }

  async function worksheetMaker() {
    const ui = await getUI();
    const data = await ui.form({
      eyebrow:'TEACHER TOOLKIT', title:'Quick Worksheet', subtitle:'Create a clean local worksheet template for your class.', icon:'worksheet', submitText:'Create Worksheet',
      fields:[{name:'topic',label:'Worksheet Topic',icon:'worksheet',placeholder:'e.g. Fractions',required:true,wide:true}]
    });
    if (!data) return;
    const out = teacherOutput();
    if (!out) return;
    const body = `<div>Name: ____________________ &nbsp; Date: __________</div><div style="margin-top:12px"><b>A. Key terms</b><br>1. ____________________<br>2. ____________________<br>3. ____________________</div><div style="margin-top:12px"><b>B. Short answers</b><br>1. __________________________________________<br><br>2. __________________________________________<br><br>3. __________________________________________</div><div style="margin-top:12px"><b>C. Reflection</b><br>What was the most important thing you learned about ${esc(data.topic)}?</div>`;
    out.innerHTML = ui.resultShell({title:`${data.topic} — Worksheet`,subtitle:'Printable classroom template',icon:'worksheet',bodyHtml:body});
  }

  async function renderAttendance() {
    const ui = await getUI().catch(()=>window.NexusNovaUI || null);
    const out = teacherOutput();
    if (!out) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(accountKey('attendance')) || '[]'); } catch (_) {}
    if (!Array.isArray(list) || !list.length) {
      const body = '<div style="color:#91a9c4">No attendance list yet. Tap Attendance and add student names.</div>';
      out.innerHTML = ui ? ui.resultShell({title:'Class Attendance',subtitle:new Date().toLocaleDateString(),icon:'attendance',bodyHtml:body}) : body;
      return;
    }
    const rows = list.map((student,index) => `<label style="display:flex;align-items:center;gap:11px;padding:10px;border-radius:13px;margin-top:8px;background:rgba(8,28,50,.72);border:1px solid rgba(95,165,235,.13)"><input type="checkbox" data-nx-att="${index}" ${student.present?'checked':''} style="width:19px;height:19px;accent-color:#2f9bff"><span style="font-weight:750">${esc(student.name)}</span></label>`).join('');
    const body = `${rows}<button id="nxAttendanceSave" class="tool-btn primary" type="button" style="margin-top:13px;width:100%">Save Attendance</button>`;
    out.innerHTML = ui ? ui.resultShell({title:'Class Attendance',subtitle:new Date().toLocaleDateString(),icon:'attendance',bodyHtml:body,footer:'Attendance is stored locally on this device.'}) : body;
    out.querySelector('#nxAttendanceSave')?.addEventListener('click', () => {
      out.querySelectorAll('[data-nx-att]').forEach(box => {
        const index = Number(box.dataset.nxAtt);
        if (list[index]) list[index].present = box.checked;
      });
      localStorage.setItem(accountKey('attendance'), JSON.stringify(list));
      toast('Attendance saved on this device.');
    });
  }

  async function attendance() {
    const ui = await getUI();
    const saved = (()=>{ try { return JSON.parse(localStorage.getItem(accountKey('attendance')) || '[]'); } catch { return []; } })();
    const existing = Array.isArray(saved) ? saved.map(x=>x.name).filter(Boolean).join(', ') : '';
    const data = await ui.form({
      eyebrow:'TEACHER TOOLKIT',
      title:'Set Up Class Attendance',
      subtitle:'Add student names once, then mark present or absent from the visual class list.',
      icon:'attendance',
      submitText:'Open Attendance',
      fields:[{name:'names',label:'Student Names',icon:'attendance',type:'textarea',value:existing,placeholder:'Ali, Sana, Ahmed, Ayesha…',wide:true,hint:'Separate student names with commas. Existing names are shown here for editing.'}]
    });
    if (!data) return;
    if (data.names.trim()) {
      const oldByName = new Map((Array.isArray(saved)?saved:[]).map(x=>[String(x.name).toLowerCase(),Boolean(x.present)]));
      const list = data.names.split(',').map(name => name.trim()).filter(Boolean).slice(0,100).map(name => ({name,present:oldByName.has(name.toLowerCase()) ? oldByName.get(name.toLowerCase()) : true}));
      localStorage.setItem(accountKey('attendance'), JSON.stringify(list));
    }
    await renderAttendance();
  }

  async function permissionManager() {
    const ui = await getUI().catch(()=>null);
    let out = $('nxSecurityLocalOut');
    const card = $('tab-mega-security')?.querySelector('.card');
    if (!card) return;
    if (!out) {
      out = document.createElement('div');
      out.id = 'nxSecurityLocalOut';
      out.className = 'tool-result';
      out.style.marginTop = '12px';
      card.appendChild(out);
    }
    const rows = [];
    rows.push(`Notifications: ${'Notification' in window ? Notification.permission : 'unsupported'}`);
    for (const name of ['geolocation','camera']) {
      try {
        if (!navigator.permissions?.query) throw new Error();
        const state = await navigator.permissions.query({name});
        rows.push(`${name[0].toUpperCase()+name.slice(1)}: ${state.state}`);
      } catch (_) {
        rows.push(`${name[0].toUpperCase()+name.slice(1)}: check when feature is used`);
      }
    }
    const body = rows.map(row => `<div style="margin-top:8px;padding:10px 12px;border-radius:12px;background:rgba(8,27,49,.7);border:1px solid rgba(90,160,225,.12)">${esc(row)}</div>`).join('');
    out.innerHTML = ui ? ui.resultShell({title:'Browser Permission Status',subtitle:'Current device/browser access',icon:'security',bodyHtml:body}) : '<b>Browser Permission Status</b>' + body;
  }

  function localBackup() {
    const data = {};
    const uid = String(window.nexusAccountId || '');
    for (let i=0; i<localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const belongsToNexus = /^(?:nx|nexusnova|nexusAccount|bible|quran)/i.test(key) || (uid && key.includes(uid));
      if (belongsToNexus) data[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify({exportedAt:new Date().toISOString(),account:uid||null,data}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexusnova-local-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Local NexusNova backup exported.');
  }

  function install() {
    claimButton('tab-mega-qr','📷 QR Scanner','nxMegaQrScannerLocal',openToolsQr);
    claimButton('tab-mega-qr','📶 Wi-Fi QR','nxMegaWifiQrLocal',wifiQr);
    claimButton('tab-mega-qr','👤 Contact QR','nxMegaContactQrLocal',contactQr);
    claimButton('tab-mega-teacher','Lesson Planner','nxTeacherLessonLocal',lessonPlanner);
    claimButton('tab-mega-teacher','Quiz Maker','nxTeacherQuizLocal',quizMaker);
    claimButton('tab-mega-teacher','Worksheet Maker','nxTeacherWorksheetLocal',worksheetMaker);
    claimButton('tab-mega-teacher','Attendance','nxTeacherAttendanceLocal',attendance);
    claimButton('tab-mega-security','Permission Manager','nxSecurityPermissionsLocal',permissionManager);
    claimButton('tab-mega-security','Wallet Security','nxSecurityWalletLocal',() => window.openMoreTab?.('wallet'));
    claimButton('tab-mega-security','Data Backup','nxSecurityBackupLocal',localBackup);
  }

  const boot=()=>{getUI().catch(()=>{});setTimeout(install,1000);[1800,3500,7000].forEach(ms=>setTimeout(install,ms));};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();