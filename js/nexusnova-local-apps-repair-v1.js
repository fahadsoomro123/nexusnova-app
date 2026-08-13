/* NexusNova Local Apps Repair v1
   Turns selected backend-free placeholder buttons into real local/browser tools. */
(() => {
  'use strict';
  if (window.__nxLocalAppsRepairV1) return;
  window.__nxLocalAppsRepairV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const accountKey = name => `nxlocal_${name}:${String(window.nexusAccountId || 'guest')}`;

  function toast(message) {
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
      handler(button);
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

  function wifiQr() {
    const ssid = prompt('Wi-Fi name (SSID):');
    if (!ssid) return;
    const password = prompt('Wi-Fi password (leave empty for open network):') ?? '';
    const type = password ? 'WPA' : 'nopass';
    const clean = value => String(value).replace(/([\\;,:"])/g, '\\$1');
    generateMegaQr(`WIFI:T:${type};S:${clean(ssid)};P:${clean(password)};;`);
  }

  function contactQr() {
    const name = prompt('Contact name:');
    if (!name) return;
    const phone = prompt('Phone number:') || '';
    const email = prompt('Email (optional):') || '';
    const lines = ['BEGIN:VCARD','VERSION:3.0',`FN:${name}`];
    if (phone) lines.push(`TEL:${phone}`);
    if (email) lines.push(`EMAIL:${email}`);
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
    out.className = 'tool-result';
    out.style.marginTop = '12px';
    card.appendChild(out);
    return out;
  }

  function lessonPlanner() {
    const subject = prompt('Subject:') || 'Subject';
    const topic = prompt('Lesson topic:') || 'Topic';
    const grade = prompt('Class / Grade:') || 'Class';
    const out = teacherOutput();
    if (!out) return;
    out.innerHTML = `<div class="nxmega-item"><div><b>Lesson Plan — ${esc(subject)}</b><small>${esc(grade)} • ${esc(topic)}</small></div></div>
      <div style="margin-top:10px"><b>Objective</b><br>Students will understand the key ideas of ${esc(topic)}.</div>
      <div style="margin-top:8px"><b>Warm-up (5 min)</b><br>Ask 2–3 questions to check prior knowledge.</div>
      <div style="margin-top:8px"><b>Teaching (15–20 min)</b><br>Explain the concept with examples and student participation.</div>
      <div style="margin-top:8px"><b>Practice (10–15 min)</b><br>Individual or pair activity based on the lesson.</div>
      <div style="margin-top:8px"><b>Assessment</b><br>Use 3 quick questions or an exit ticket.</div>
      <div style="margin-top:8px"><b>Homework</b><br>Short practice task related to ${esc(topic)}.</div>`;
  }

  function quizMaker() {
    const topic = prompt('Quiz topic:') || 'Topic';
    const raw = Number(prompt('How many questions? (1–20):') || 5);
    const count = Math.max(1, Math.min(20, Number.isFinite(raw) ? Math.floor(raw) : 5));
    const out = teacherOutput();
    if (!out) return;
    out.innerHTML = `<b>${esc(topic)} — Quiz Template</b>` + Array.from({length:count}, (_,i) =>
      `<div style="margin-top:9px">${i+1}. ________________________________________________</div>`
    ).join('') + '<div style="margin-top:12px" class="nxmega-muted">Teacher can copy this template and add the exact questions/answers.</div>';
  }

  function worksheetMaker() {
    const topic = prompt('Worksheet topic:') || 'Topic';
    const out = teacherOutput();
    if (!out) return;
    out.innerHTML = `<b>${esc(topic)} — Worksheet</b>
      <div style="margin-top:10px">Name: ____________________ &nbsp; Date: __________</div>
      <div style="margin-top:10px"><b>A. Key terms</b><br>1. ____________________<br>2. ____________________<br>3. ____________________</div>
      <div style="margin-top:10px"><b>B. Short answers</b><br>1. __________________________________________<br><br>2. __________________________________________<br><br>3. __________________________________________</div>
      <div style="margin-top:10px"><b>C. Reflection</b><br>What was the most important thing you learned about ${esc(topic)}?</div>`;
  }

  function renderAttendance() {
    const out = teacherOutput();
    if (!out) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(accountKey('attendance')) || '[]'); } catch (_) {}
    if (!Array.isArray(list) || !list.length) {
      out.innerHTML = '<div class="nxmega-muted">No attendance list yet. Tap Attendance and enter student names.</div>';
      return;
    }
    out.innerHTML = `<b>Attendance — ${new Date().toLocaleDateString()}</b>` + list.map((student,index) =>
      `<label style="display:flex;align-items:center;gap:8px;margin-top:9px"><input type="checkbox" data-nx-att="${index}" ${student.present?'checked':''}><span>${esc(student.name)}</span></label>`
    ).join('') + '<button id="nxAttendanceSave" class="tool-btn primary" type="button" style="margin-top:12px">Save Attendance</button>';
    out.querySelector('#nxAttendanceSave')?.addEventListener('click', () => {
      out.querySelectorAll('[data-nx-att]').forEach(box => {
        const index = Number(box.dataset.nxAtt);
        if (list[index]) list[index].present = box.checked;
      });
      localStorage.setItem(accountKey('attendance'), JSON.stringify(list));
      toast('Attendance saved on this device.');
    });
  }

  function attendance() {
    const names = prompt('Student names separated by commas. Leave blank to open saved list:');
    if (names && names.trim()) {
      const list = names.split(',').map(name => name.trim()).filter(Boolean).map(name => ({name,present:true}));
      localStorage.setItem(accountKey('attendance'), JSON.stringify(list));
    }
    renderAttendance();
  }

  async function permissionManager() {
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
    out.innerHTML = '<b>Browser Permission Status</b>' + rows.map(row => `<div style="margin-top:7px">${esc(row)}</div>`).join('');
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install,1000), {once:true});
  else setTimeout(install,1000);
  [1800,3500,7000].forEach(ms => setTimeout(install,ms));
})();