/* NexusNova ALL APPS Smart Search v1.1
   Hidden intent/synonym tags stay in JavaScript and are never shown in the UI. */
(() => {
  'use strict';
  if (window.__nxAllAppsSmartSearchV1) return;
  window.__nxAllAppsSmartSearchV1 = true;

  const TAGS = {
    'TOOLS': 'utility calculator converter units notes todo pomodoro quick tools kaam',
    'GOLD/FX': 'gold sona xau forex fx currency exchange rate usd pkr dollar riyal dirham euro pound',
    'NEWS': 'news breaking headlines world international khabar khabrein latest',
    'CHAT': 'chat message community conversation talk baat baat cheet',
    'AI': 'ai assistant ask question help explain write translate summarize idea advice jawab samjhao likho tarjuma',
    'LOCATION': 'location map maps gps current location jagah rasta direction directions',
    'SOS': 'sos emergency help danger accident police ambulance madad mushkil khatra',
    'FAMILY': 'family wife husband children kids parents ghar family member trusted contact check in',
    'PROFILE': 'profile account name email user id referral avatar mera account',
    'DAILY': 'daily reward bonus claim streak free nvx rozana',
    'BUDGET': 'budget salary income monthly kharcha expenses rashan household saving plan',
    'LEARN': 'learn study education homework subject lesson paper solved past exam class student parhai sawal',
    'TRAVEL': 'travel trip ticket flight plane train railway bus booking hotel safar route station airport itinerary',
    'HEALTH': 'health wellness bmi weight height water sleep diet nutrition calorie fitness sehat wazan neend',
    'SMART': 'smart camera ai camera daily brief voice intelligent',
    'QIBLA': 'qibla kaaba kaba makkah namaz direction',
    'PK NEWS': 'pakistan news pak news sindh urdu sindhi karachi khabar',
    'WATCH': 'watch video movie drama music youtube dailymotion netflix entertainment song gaana',
    'BROWSER': 'browser web website internet open site google search web link url',
    'CALLER': 'caller caller id phone number unknown number kis ka number number kis ka hai lookup spam call identify',
    'SETTINGS': 'settings theme dark light language voice notification preference password verification',
    'SUPER APP': 'super app all features everything command center find feature app search',
    'DAILY TOOLS': 'daily tools calculator notes todo quick routine rozmarra',
    'CALENDAR': 'calendar event date schedule meeting appointment program',
    'REMINDERS': 'reminder remind alarm notify yaad dilao alert',
    'FINANCE': 'finance expense loan emi tip bill split savings money paisa qarz hisab',
    'WEATHER': 'weather temperature rain barish mausam mosam forecast humidity wind garmi sardi sunrise sunset',
    'LEARNING': 'learning study planner quiz solved papers past papers knowledge education exam prep tayari',
    'PAKISTAN HUB': 'pakistan government govt nadra passport cnic utility bill electricity gas service sindh',
    'ISLAMIC HUB': 'islam islamic prayer namaz azan adhan dua sehri iftar ramadan hijri asma husna deen roza',
    'BIBLE': 'bible christian jesus gospel verse testament scripture',
    'HABITS': 'habit routine streak aadat daily target self improvement',
    'SAVINGS': 'saving savings goal money goal bachat paise target amount',
    'CONTACTS': 'contact phonebook number save call address book naam number',
    'SHOPPING': 'shopping shop buy purchase food grocery groceries rashan market product price clothes kapray household saman',
    'DOCUMENTS': 'document scan scanner receipt bill ocr pdf maker image to pdf paper file convert',
    'FILE VAULT': 'file vault private secure storage locker personal files documents safe',
    'QR TOOLS': 'qr qr code scan wifi contact qr payment barcode',
    'SECURITY': 'security privacy permission app lock backup wallet safe secure biometric lock',
    'MARKETPLACE': 'marketplace sell seller buy sell listing store ecommerce product listing',
    'ORDERS': 'order delivery parcel courier tracking shipment shipped delivered return refund package',
    'NOTIFICATIONS': 'notification alert push price alert news alert mining wallet',
    'TEACHER TOOLKIT': 'teacher teaching lesson plan worksheet quiz attendance grades students school classroom ustad'
  };

  const normalize = value => String(value || '')
    .toLowerCase().normalize('NFKC')
    .replace(/[&/_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}+]+/gu, ' ')
    .replace(/\s+/g, ' ').trim();

  function labelOf(button) {
    const spans = button?.querySelectorAll(':scope > span');
    const value = spans?.length ? spans[spans.length - 1].textContent : button?.textContent;
    return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function targetOf(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return button.dataset.nxmega;
    if (button.dataset?.finalBible) return 'bible';
    const match = String(button.getAttribute('onclick') || '').match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/);
    return match?.[1] || '';
  }

  function distance(a, b) {
    if (a === b) return 0;
    const row = Array.from({length:b.length + 1}, (_,i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = row[j];
        row[j] = Math.min(row[j] + 1, row[j-1] + 1, diagonal + (a[i-1] === b[j-1] ? 0 : 1));
        diagonal = old;
      }
    }
    return row[b.length];
  }

  function wordScore(q, c) {
    if (!q || !c) return 0;
    if (q === c) return 14;
    if (c.startsWith(q) || q.startsWith(c)) return 8;
    if (q.length >= 4 && c.length >= 4) {
      const limit = Math.max(q.length, c.length) >= 8 ? 2 : 1;
      if (distance(q, c) <= limit) return 5;
    }
    return 0;
  }

  function score(button, raw) {
    const query = normalize(raw);
    if (!query) return 0;
    const label = labelOf(button);
    const visible = normalize(label);
    const hidden = normalize(TAGS[label] || '');
    const corpus = `${visible} ${hidden}`.trim();
    let total = 0;

    if (visible === query) total += 120;
    else if (Math.min(visible.length, query.length) >= 4 && (visible.includes(query) || query.includes(visible))) total += 65;
    if (hidden.split(' ').includes(query)) total += 90;
    if (query.length >= 3 && hidden.includes(query)) total += 45;

    const candidates = [...new Set(corpus.split(' ').filter(Boolean))];
    query.split(' ').filter(Boolean).forEach(q => {
      let best = 0;
      candidates.forEach(c => { best = Math.max(best, wordScore(q, c)); });
      total += best;
    });
    return total;
  }

  function ranked(query) {
    return Array.from(document.querySelectorAll('#moreMenu .more-item'))
      .map(button => ({button, label:labelOf(button), target:targetOf(button), score:score(button, query)}))
      .filter(row => row.score > 0)
      .sort((a,b) => b.score - a.score);
  }

  function openResult(row, query) {
    if (!row?.button) return;
    try { row.button.click(); }
    catch (_) { if (row.target) window.openMoreTab?.(row.target); }
    try { localStorage.setItem('nexusnova_last_allapps_search', JSON.stringify({query, label:row.label, at:Date.now()})); } catch (_) {}
  }

  function install() {
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner || document.getElementById('nxAllAppsSmartSearch')) return false;

    const panel = document.createElement('div');
    panel.id = 'nxAllAppsSmartSearch';
    panel.innerHTML = `
      <div class="nx-smart-row">
        <input type="search" data-smart-input autocomplete="off" spellcheck="false" placeholder="What do you need? e.g. food, salary, ticket, dua…">
        <button type="button" data-smart-go>Search</button>
      </div>
      <div class="nx-smart-status" data-smart-status>Describe what you need. NexusNova will find the closest tool.</div>
      <div class="nx-smart-results" data-smart-results></div>`;

    const style = document.createElement('style');
    style.textContent = `
      #nxAllAppsSmartSearch{grid-column:1/-1;margin:0 0 12px;padding:12px;border:1px solid rgba(56,189,248,.22);border-radius:16px;background:linear-gradient(135deg,rgba(8,47,73,.72),rgba(15,23,42,.84))}
      #nxAllAppsSmartSearch .nx-smart-row{display:flex;gap:8px}
      #nxAllAppsSmartSearch input{flex:1;min-width:0;border:1px solid rgba(148,163,184,.25);border-radius:12px;background:rgba(2,6,23,.68);color:#f8fafc;padding:11px 12px;outline:none}
      #nxAllAppsSmartSearch [data-smart-go],#nxAllAppsSmartSearch .nx-smart-result{border:0;border-radius:11px;padding:10px 13px;font-weight:800;cursor:pointer;color:#e0f2fe;background:linear-gradient(135deg,#0369a1,#0e7490)}
      #nxAllAppsSmartSearch .nx-smart-status{font-size:11px;color:#94a3b8;margin-top:8px;line-height:1.35}
      #nxAllAppsSmartSearch .nx-smart-results{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      #nxAllAppsSmartSearch .nx-smart-result{padding:7px 10px;font-size:11px;background:rgba(14,116,144,.30);border:1px solid rgba(34,211,238,.20)}
    `;
    document.head.appendChild(style);
    inner.insertBefore(panel, inner.firstChild);

    const input = panel.querySelector('[data-smart-input]');
    const go = panel.querySelector('[data-smart-go]');
    const status = panel.querySelector('[data-smart-status]');
    const results = panel.querySelector('[data-smart-results]');

    const render = (autoOpen = false) => {
      const query = String(input.value || '').trim();
      results.innerHTML = '';
      if (!query) { status.textContent = 'Describe what you need. NexusNova will find the closest tool.'; return; }
      const rows = ranked(query);
      if (!rows.length) {
        status.textContent = 'No strong tool match. NexusNova AI is the fallback for this request.';
        const ai = Array.from(document.querySelectorAll('#moreMenu .more-item')).find(b => labelOf(b) === 'AI');
        if (autoOpen && ai) {
          const row = {button:ai,label:'AI',target:targetOf(ai),score:1};
          openResult(row, query);
          setTimeout(() => { const aiInput=document.getElementById('aiInput'); if(aiInput && !aiInput.value) aiInput.value=query; }, 180);
        }
        return;
      }

      status.textContent = rows.length > 1 ? 'Best matching NexusNova tools:' : 'Best matching NexusNova tool:';
      rows.slice(0,3).forEach((row,index) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nx-smart-result';
        b.textContent = `${index === 0 ? '★ ' : ''}${row.label}`;
        b.addEventListener('click', () => openResult(row, query));
        results.appendChild(b);
      });

      if (autoOpen && rows[0].score >= 20) {
        const first=rows[0], second=rows[1];
        const decisive=!second || first.score >= second.score + 8 || (first.score >= 120 && second.score < first.score * .75);
        if (decisive) setTimeout(() => openResult(first, query), 80);
      }
    };

    go.addEventListener('click', () => render(true));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
    input.addEventListener('input', () => render(false));
    return true;
  }

  window.nexusAllAppsSmartSearch = query => ranked(query).slice(0,5).map(row => ({label:row.label,target:row.target,score:row.score}));

  const boot = () => {
    install();
    [500,1200,2500,5000,9000].forEach(ms => setTimeout(install, ms));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();