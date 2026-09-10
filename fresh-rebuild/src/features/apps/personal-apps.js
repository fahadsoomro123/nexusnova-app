import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

async function scopedKey(name) {
  try {
    const user = await requireFirebaseUser();
    return `nexus_fresh_${name}_${user.uid}`;
  } catch {
    return `nexus_fresh_${name}_device`;
  }
}

function nowLocalInput(offsetMs = 0) {
  const date = new Date(Date.now() + offsetMs - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0,16);
}

export function renderCalendar() {
  const root = node(`
    <section class="nx-tool-card">
      <label class="nx-field"><span>Event</span><input maxlength="120" data-cal-title placeholder="Event title"></label>
      <label class="nx-field"><span>Date & time</span><input type="datetime-local" data-cal-time></label>
      <label class="nx-field"><span>Note</span><input maxlength="240" data-cal-note placeholder="Optional note"></label>
      <button class="nx-primary" type="button" data-cal-add>ADD EVENT</button>
      <p class="nx-tool-meta">Calendar items are saved on this device for the signed-in account.</p>
    </section>
    <section class="nx-stack" data-cal-list></section>
  `);
  const title = root.querySelector('[data-cal-title]');
  const time = root.querySelector('[data-cal-time]');
  const note = root.querySelector('[data-cal-note]');
  const list = root.querySelector('[data-cal-list]');
  time.value = nowLocalInput(3_600_000);
  let key = '';
  const draw = () => {
    if (!key) return;
    const items = loadJson(key, []).sort((a,b) => new Date(a.at) - new Date(b.at));
    list.innerHTML = items.length ? items.map(item => `
      <article class="nx-list-card">
        <div class="nx-list-card__head"><strong>${escapeHtml(item.title)}</strong><button class="nx-icon-button" type="button" data-cal-delete="${escapeHtml(item.id)}">×</button></div>
        <p>${new Date(item.at).toLocaleString()}${item.note ? ` • ${escapeHtml(item.note)}` : ''}</p>
      </article>`).join('') : '<div class="nx-empty">No calendar events yet.</div>';
    list.querySelectorAll('[data-cal-delete]').forEach(button => button.addEventListener('click', () => {
      saveJson(key, loadJson(key, []).filter(item => item.id !== button.dataset.calDelete));
      draw();
    }));
  };
  scopedKey('calendar_v1').then(value => { key = value; draw(); });
  root.querySelector('[data-cal-add]').addEventListener('click', () => {
    if (!key) return;
    const name = title.value.trim();
    const at = new Date(time.value).getTime();
    if (!name || !Number.isFinite(at)) return;
    const items = loadJson(key, []);
    items.push({ id:uid('event'), title:name, at:new Date(at).toISOString(), note:note.value.trim() });
    saveJson(key, items.slice(-500));
    title.value = ''; note.value = ''; time.value = nowLocalInput(3_600_000); draw();
  });
  return root;
}

export function renderReminders() {
  const root = node(`
    <section class="nx-tool-card">
      <label class="nx-field"><span>Reminder</span><input maxlength="160" data-rem-title placeholder="What should NexusNova remind you about?"></label>
      <label class="nx-field"><span>When</span><input type="datetime-local" data-rem-time></label>
      <button class="nx-primary" type="button" data-rem-add>SET REMINDER</button>
      <p class="nx-tool-meta" data-rem-status>Stored reminders alert while NexusNova is open and browser notifications are allowed.</p>
    </section>
    <section class="nx-stack" data-rem-list></section>
  `);
  const title = root.querySelector('[data-rem-title]');
  const time = root.querySelector('[data-rem-time]');
  const list = root.querySelector('[data-rem-list]');
  const status = root.querySelector('[data-rem-status]');
  time.value = nowLocalInput(3_600_000);
  let key = '', timer = null, disposed = false;

  const notify = item => {
    if (Notification?.permission === 'granted') {
      try { new Notification('NexusNova Reminder', { body:item.title }); return; } catch {}
    }
    status.textContent = `Reminder due: ${item.title}`;
  };

  const checkDue = () => {
    if (!key || disposed) return;
    const items = loadJson(key, []);
    let changed = false;
    items.forEach(item => {
      if (!item.fired && Date.now() >= new Date(item.at).getTime()) {
        item.fired = true; changed = true; notify(item);
      }
    });
    if (changed) saveJson(key, items);
    draw();
  };

  const draw = () => {
    if (!key || disposed) return;
    const items = loadJson(key, []).sort((a,b) => new Date(a.at) - new Date(b.at));
    list.innerHTML = items.length ? items.map(item => `
      <article class="nx-list-card"><div class="nx-list-card__head"><strong>${escapeHtml(item.title)}</strong><button class="nx-icon-button" type="button" data-rem-delete="${escapeHtml(item.id)}">×</button></div><p>${new Date(item.at).toLocaleString()} • ${item.fired ? 'Completed' : 'Scheduled'}</p></article>`).join('') : '<div class="nx-empty">No reminders set.</div>';
    list.querySelectorAll('[data-rem-delete]').forEach(button => button.addEventListener('click', () => { saveJson(key, loadJson(key, []).filter(item => item.id !== button.dataset.remDelete)); draw(); }));
  };
  scopedKey('reminders_v1').then(value => {
    if (disposed) return;
    key = value;
    draw();
    timer = setInterval(checkDue,15_000);
    checkDue();
  });
  root.querySelector('[data-rem-add]').addEventListener('click', async () => {
    if (!key || disposed) return;
    const name = title.value.trim();
    const at = new Date(time.value).getTime();
    if (!name || !Number.isFinite(at) || at <= Date.now()) { status.textContent = 'Choose a future reminder time.'; return; }
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    if (disposed) return;
    const items = loadJson(key, []); items.push({ id:uid('reminder'), title:name, at:new Date(at).toISOString(), fired:false }); saveJson(key,items.slice(-500));
    title.value=''; time.value=nowLocalInput(3_600_000); status.textContent='Reminder saved on this device.'; draw();
  });
  root.__cleanup = () => {
    disposed = true;
    clearInterval(timer);
  };
  return root;
}

export function renderHabits() {
  const root = node(`
    <section class="nx-tool-card"><div class="nx-inline-field"><input maxlength="100" data-habit-input placeholder="Add a daily habit"><button type="button" data-habit-add>ADD</button></div><p class="nx-tool-meta">Tap a habit once each day to mark it complete.</p></section>
    <section class="nx-stack" data-habit-list></section>
  `);
  const input = root.querySelector('[data-habit-input]');
  const list = root.querySelector('[data-habit-list]');
  const today = () => new Date().toISOString().slice(0,10);
  let key='';
  const draw = () => {
    if (!key) return;
    const habits = loadJson(key, []);
    list.innerHTML = habits.length ? habits.map(habit => {
      const done = habit.days?.includes(today());
      const streak = (habit.days || []).slice(-30).length;
      return `<article class="nx-list-card nx-habit-row"><button type="button" class="nx-habit-check ${done?'done':''}" data-habit-toggle="${escapeHtml(habit.id)}">${done?'✓':'○'}</button><div><strong>${escapeHtml(habit.name)}</strong><p>${streak} recorded completion${streak===1?'':'s'}</p></div><button class="nx-icon-button" type="button" data-habit-delete="${escapeHtml(habit.id)}">×</button></article>`;
    }).join('') : '<div class="nx-empty">No habits yet.</div>';
    list.querySelectorAll('[data-habit-toggle]').forEach(button => button.addEventListener('click', () => {
      const habits = loadJson(key, []); const habit = habits.find(item => item.id === button.dataset.habitToggle); if (!habit) return;
      habit.days = Array.isArray(habit.days) ? habit.days : [];
      habit.days = habit.days.includes(today()) ? habit.days.filter(day => day !== today()) : [...habit.days,today()].slice(-365);
      saveJson(key,habits); draw();
    }));
    list.querySelectorAll('[data-habit-delete]').forEach(button => button.addEventListener('click', () => { saveJson(key,loadJson(key,[]).filter(item => item.id !== button.dataset.habitDelete)); draw(); }));
  };
  scopedKey('habits_v1').then(value => {key=value;draw();});
  root.querySelector('[data-habit-add]').addEventListener('click', () => { if(!key||!input.value.trim())return; const habits=loadJson(key,[]); habits.push({id:uid('habit'),name:input.value.trim(),days:[]}); saveJson(key,habits.slice(-100)); input.value=''; draw(); });
  return root;
}

export function renderSavings() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col"><label class="nx-field"><span>Goal name</span><input maxlength="80" data-save-name placeholder="Emergency fund"></label><label class="nx-field"><span>Target</span><input type="number" min="0" step="0.01" inputmode="decimal" data-save-target placeholder="100000"></label></div>
      <button class="nx-primary" type="button" data-save-goal>ADD GOAL</button>
      <p class="nx-tool-meta">Planning tool only — no bank account or money transfer is connected.</p>
    </section>
    <section class="nx-stack" data-save-list></section>
  `);
  const name = root.querySelector('[data-save-name]'); const target = root.querySelector('[data-save-target]'); const list=root.querySelector('[data-save-list]'); let key='';
  const draw=()=>{if(!key)return;const goals=loadJson(key,[]);list.innerHTML=goals.length?goals.map(goal=>{const pct=goal.target>0?Math.min(100,(goal.saved/goal.target)*100):0;return `<article class="nx-list-card"><div class="nx-list-card__head"><strong>${escapeHtml(goal.name)}</strong><button class="nx-icon-button" type="button" data-save-delete="${escapeHtml(goal.id)}">×</button></div><p>${goal.saved.toLocaleString()} / ${goal.target.toLocaleString()} • ${pct.toFixed(0)}%</p><div class="nx-progress"><i style="width:${pct}%"></i></div><div class="nx-inline-field" style="margin-top:9px"><input type="number" min="0" step="0.01" data-save-amount="${escapeHtml(goal.id)}" placeholder="Add saved amount"><button type="button" data-save-add="${escapeHtml(goal.id)}">ADD</button></div></article>`}).join(''):'<div class="nx-empty">No savings goals yet.</div>';
    list.querySelectorAll('[data-save-delete]').forEach(b=>b.addEventListener('click',()=>{saveJson(key,loadJson(key,[]).filter(x=>x.id!==b.dataset.saveDelete));draw();}));
    list.querySelectorAll('[data-save-add]').forEach(b=>b.addEventListener('click',()=>{const input=list.querySelector(`[data-save-amount="${CSS.escape(b.dataset.saveAdd)}"]`);const amount=Number(input?.value);if(!(amount>0))return;const goals=loadJson(key,[]);const goal=goals.find(x=>x.id===b.dataset.saveAdd);if(goal){goal.saved=Math.max(0,Number(goal.saved||0)+amount);saveJson(key,goals);draw();}}));
  };
  scopedKey('savings_v1').then(v=>{key=v;draw();});
  root.querySelector('[data-save-goal]').addEventListener('click',()=>{const n=name.value.trim(),t=Number(target.value);if(!key||!n||!(t>0))return;const goals=loadJson(key,[]);goals.push({id:uid('goal'),name:n,target:t,saved:0});saveJson(key,goals.slice(-100));name.value='';target.value='';draw();});
  return root;
}

export function renderShopping() {
  const root=node(`<section class="nx-tool-card"><div class="nx-inline-field"><input maxlength="120" data-shop-input placeholder="Add shopping item"><button type="button" data-shop-add>ADD</button></div></section><section class="nx-stack" data-shop-list></section>`);
  const input=root.querySelector('[data-shop-input]'),list=root.querySelector('[data-shop-list]');let key='';
  const draw=()=>{if(!key)return;const items=loadJson(key,[]);list.innerHTML=items.length?items.map(item=>`<article class="nx-list-card nx-todo-row ${item.done?'done':''}"><label><input type="checkbox" data-shop-toggle="${escapeHtml(item.id)}" ${item.done?'checked':''}><span>${escapeHtml(item.name)}</span></label><button class="nx-icon-button" type="button" data-shop-delete="${escapeHtml(item.id)}">×</button></article>`).join(''):'<div class="nx-empty">Shopping list is empty.</div>';list.querySelectorAll('[data-shop-toggle]').forEach(c=>c.addEventListener('change',()=>{const items=loadJson(key,[]);const item=items.find(x=>x.id===c.dataset.shopToggle);if(item)item.done=c.checked;saveJson(key,items);draw();}));list.querySelectorAll('[data-shop-delete]').forEach(b=>b.addEventListener('click',()=>{saveJson(key,loadJson(key,[]).filter(x=>x.id!==b.dataset.shopDelete));draw();}));};
  scopedKey('shopping_v1').then(v=>{key=v;draw();});
  const add=()=>{if(!key||!input.value.trim())return;const items=loadJson(key,[]);items.push({id:uid('shop'),name:input.value.trim(),done:false});saveJson(key,items.slice(-500));input.value='';draw();};root.querySelector('[data-shop-add]').addEventListener('click',add);input.addEventListener('keydown',e=>{if(e.key==='Enter')add();});return root;
}

function normalizePhone(value) {
  return String(value || '').replace(/[^0-9+]/g,'').trim().slice(0,18);
}

export function renderContacts() {
  const root=node(`
    <section class="nx-tool-card"><div class="nx-two-col"><label class="nx-field"><span>Name</span><input maxlength="100" data-contact-name></label><label class="nx-field"><span>Phone</span><input inputmode="tel" maxlength="18" data-contact-phone></label></div><label class="nx-field"><span>Address</span><input maxlength="300" data-contact-address></label><button class="nx-primary" type="button" data-contact-add>ADD CONTACT</button><p class="nx-tool-meta" data-contact-status>Contacts are saved on this device for the signed-in account.</p></section>
    <section class="nx-stack" data-contact-list></section>`);
  const name=root.querySelector('[data-contact-name]'),phone=root.querySelector('[data-contact-phone]'),address=root.querySelector('[data-contact-address]'),list=root.querySelector('[data-contact-list]'),status=root.querySelector('[data-contact-status]');let key='';
  const draw=()=>{if(!key)return;const items=loadJson(key,[]);list.innerHTML=items.length?items.map(item=>`<article class="nx-list-card"><div class="nx-list-card__head"><strong>${escapeHtml(item.name)}</strong><button class="nx-icon-button" type="button" data-contact-delete="${escapeHtml(item.id)}">×</button></div><p>${escapeHtml(item.phone)}${item.address?` • ${escapeHtml(item.address)}`:''}</p></article>`).join(''):'<div class="nx-empty">No contacts yet.</div>';list.querySelectorAll('[data-contact-delete]').forEach(b=>b.addEventListener('click',()=>{saveJson(key,loadJson(key,[]).filter(x=>x.id!==b.dataset.contactDelete));draw();}));};
  requireFirebaseUser().then(user=>{key=`nexus_fresh_contacts_v1_${user.uid}`;draw();}).catch(error=>{status.textContent=error.message;});
  root.querySelector('[data-contact-add]').addEventListener('click',()=>{const n=name.value.trim(),p=normalizePhone(phone.value),a=address.value.trim();const digits=p.replace(/\D/g,'');if(!key||!n||digits.length<10||digits.length>15){status.textContent='Enter a name and a valid 10–15 digit phone number.';return;}const items=loadJson(key,[]);const item={id:uid('contact'),name:n.slice(0,100),phone:p,address:a.slice(0,300)};items.push(item);saveJson(key,items.slice(-1000));name.value=phone.value=address.value='';status.textContent='Contact saved.';draw();});
  return root;
}

export function renderFamily() {
  const root=node(`<section class="nx-tool-card"><div class="nx-two-col"><label class="nx-field"><span>Name</span><input maxlength="100" data-family-name></label><label class="nx-field"><span>Relation</span><input maxlength="60" data-family-relation></label></div><label class="nx-field"><span>Phone</span><input inputmode="tel" maxlength="18" data-family-phone></label><button class="nx-primary" type="button" data-family-add>ADD FAMILY MEMBER</button><p class="nx-tool-meta">This is a local family contact organizer. Live location sharing is not claimed or enabled.</p></section><section class="nx-stack" data-family-list></section>`);
  const name=root.querySelector('[data-family-name]'),relation=root.querySelector('[data-family-relation]'),phone=root.querySelector('[data-family-phone]'),list=root.querySelector('[data-family-list]');let key='';
  const draw=()=>{if(!key)return;const items=loadJson(key,[]);list.innerHTML=items.length?items.map(item=>`<article class="nx-list-card"><div class="nx-list-card__head"><strong>${escapeHtml(item.name)} • ${escapeHtml(item.relation||'Family')}</strong><button class="nx-icon-button" type="button" data-family-delete="${escapeHtml(item.id)}">×</button></div><p>${escapeHtml(item.phone||'No phone')}</p></article>`).join(''):'<div class="nx-empty">No family members added.</div>';list.querySelectorAll('[data-family-delete]').forEach(b=>b.addEventListener('click',()=>{saveJson(key,loadJson(key,[]).filter(x=>x.id!==b.dataset.familyDelete));draw();}));};
  scopedKey('family_v1').then(v=>{key=v;draw();});root.querySelector('[data-family-add]').addEventListener('click',()=>{if(!key||!name.value.trim())return;const items=loadJson(key,[]);items.push({id:uid('family'),name:name.value.trim(),relation:relation.value.trim(),phone:normalizePhone(phone.value)});saveJson(key,items.slice(-200));name.value=relation.value=phone.value='';draw();});return root;
}

export function renderHealth() {
  const root=node(`<section class="nx-tool-card"><p class="nx-eyebrow">DAILY WELLNESS LOG</p><div class="nx-two-col"><label class="nx-field"><span>Water (glasses)</span><input type="number" min="0" max="30" data-health-water></label><label class="nx-field"><span>Sleep (hours)</span><input type="number" min="0" max="24" step="0.25" data-health-sleep></label></div><label class="nx-field"><span>Note</span><input maxlength="180" data-health-note></label><button class="nx-primary" type="button" data-health-save>SAVE TODAY</button><div class="nx-result" data-health-result>Nothing logged today.</div><p class="nx-tool-meta">Personal tracking only. NexusNova does not diagnose medical conditions.</p></section>`);
  const water=root.querySelector('[data-health-water]'),sleep=root.querySelector('[data-health-sleep]'),note=root.querySelector('[data-health-note]'),result=root.querySelector('[data-health-result]');let key='';const day=()=>new Date().toISOString().slice(0,10);const draw=()=>{if(!key)return;const log=loadJson(key,{});const item=log[day()];if(!item){result.textContent='Nothing logged today.';return;}water.value=item.water??'';sleep.value=item.sleep??'';note.value=item.note??'';result.textContent=`Today • ${item.water||0} glasses water • ${item.sleep||0}h sleep`;};scopedKey('health_v1').then(v=>{key=v;draw();});root.querySelector('[data-health-save]').addEventListener('click',()=>{if(!key)return;const log=loadJson(key,{});log[day()]={water:Math.max(0,Math.min(30,Number(water.value)||0)),sleep:Math.max(0,Math.min(24,Number(sleep.value)||0)),note:note.value.trim().slice(0,180)};saveJson(key,log);draw();});return root;
}

export const personalRenderers = Object.freeze({
  calendar:renderCalendar,
  reminders:renderReminders,
  habits:renderHabits,
  savings:renderSavings,
  shopping:renderShopping,
  contacts:renderContacts,
  family:renderFamily,
  health:renderHealth
});