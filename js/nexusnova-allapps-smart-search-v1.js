/* NexusNova ALL APPS Smart Search v2
   Local-first feature discovery with hidden intent tags, typo tolerance,
   and target-tab content indexing. AI never auto-opens on a local miss. */
(() => {
  'use strict';
  if (window.__nxAllAppsSmartSearchV2) return;
  window.__nxAllAppsSmartSearchV2 = true;

  const TAGS = {
    'TOOLS': 'utility utilities calculator converter conversion unit units notes notepad todo to do pomodoro timer stopwatch tools kaam hisab',
    'GOLD/FX': 'gold sona xau xauusd forex fx currency currencies exchange rate rates usd pkr dollar riyal sar dirham aed euro eur pound gbp market price',
    'NEWS': 'news breaking headlines world international local latest khabar khabrein updates newspaper articles',
    'CHAT': 'chat message messages community conversation talk baat baat cheet friends discussion inbox',
    'AI': 'ai assistant ask question help explain write translate summarize idea advice answer jawab samjhao likho tarjuma research gemini',
    'LOCATION': 'location map maps gps current location jagah rasta route direction directions navigation nearby where am i',
    'SOS': 'sos emergency help danger accident police ambulance rescue madad mushkil khatra emergency contact',
    'FAMILY': 'family wife husband children kids child parents ghar family member trusted contact check in safety home',
    'PROFILE': 'profile account name email user id referral avatar miner user mera account personal details',
    'DAILY': 'daily reward bonus claim streak free nvx rozana reward task rewards daily bonus',
    'BUDGET': 'budget salary income monthly kharcha expenses rashan household saving plan spending money planner',
    'LEARN': 'learn study education homework subject lesson paper solved past exam class student parhai sawal school books',
    'TRAVEL': 'travel trip ticket tickets flight flights plane train railway bus booking hotel safar route station airport itinerary fare price',
    'HEALTH': 'health wellness bmi weight height water sleep diet nutrition calorie fitness sehat wazan neend doctor medicine medical',
    'SMART': 'smart camera ai camera daily brief voice intelligent automation scanner vision',
    'QIBLA': 'qibla kaaba kaba makkah mecca namaz prayer direction compass qibla direction',
    'PK NEWS': 'pakistan news pak news sindh urdu sindhi karachi lahore islamabad khabar local pakistan headlines',
    'WATCH': 'watch video movie movies drama dramas music youtube dailymotion netflix entertainment song songs gaana videos media',
    'BROWSER': 'browser web website internet open site google search web link url browse online page',
    'CALLER': 'caller caller id phone number unknown number kis ka number number kis ka hai lookup spam call identify caller lookup',
    'SETTINGS': 'settings setting theme dark light language voice notification preference password verification account settings app settings',
    'SUPER APP': 'super app all features everything command center find feature app search all apps launcher hub',
    'DAILY TOOLS': 'daily tools calculator notes todo quick routine rozmarra unit converter timer pomodoro everyday tools',
    'CALENDAR': 'calendar event events date dates schedule meeting appointment program planner month day',
    'REMINDERS': 'reminder reminders remind alarm notify yaad dilao alert alerts notification schedule',
    'FINANCE': 'finance expense expenses loan emi tip bill split savings money paisa qarz hisab calculator budget interest',
    'WEATHER': 'weather temperature rain barish mausam mosam forecast humidity wind garmi sardi sunrise sunset climate',
    'LEARNING': 'learning study planner quiz solved papers past papers knowledge education exam prep tayari school student teacher homework',
    'PAKISTAN HUB': 'pakistan government govt nadra passport cnic identity card utility bill electricity gas service sindh government services',
    'ISLAMIC HUB': 'islam islamic muslim deen quran quran pak holy quran koran qur an surah surat ayat ayah para juz sipara tilawat recitation translation urdu translation tarjuma tafseer tafsir hadith hadees bukhari sahih bukhari prayer namaz azan adhan dua duas sehri iftar ramadan hijri asma husna roza fasting islamic books scripture',
    'BIBLE': 'bible holy bible christian christianity jesus gospel gospels verse verses testament old testament new testament scripture church urdu bible english bible',
    'HABITS': 'habit habits routine streak aadat daily target self improvement tracker habit tracker',
    'SAVINGS': 'saving savings goal money goal bachat paise target amount savings tracker',
    'CONTACTS': 'contact contacts phonebook number save call address book naam number people directory',
    'SHOPPING': 'shopping shop buy purchase food grocery groceries rashan market product products price clothes kapray household saman cart',
    'DOCUMENTS': 'document documents scan scanner receipt bill ocr pdf maker image to pdf paper file convert converter camera document',
    'FILE VAULT': 'file vault private secure storage locker personal files documents safe hidden files secure files',
    'QR TOOLS': 'qr qr code scan scanner wifi contact qr payment barcode bar code generate qr reader',
    'SECURITY': 'security privacy permission permissions app lock backup wallet safe secure biometric lock protection password',
    'MARKETPLACE': 'marketplace sell seller buy selling listing store ecommerce e commerce product listing products bazaar market shop',
    'ORDERS': 'order orders delivery parcel courier tracking shipment shipped delivered return refund package purchase status',
    'NOTIFICATIONS': 'notification notifications alert alerts push price alert news alert mining wallet reminder updates',
    'TEACHER TOOLKIT': 'teacher teaching lesson plan worksheet quiz attendance grades students school classroom ustad teacher tools education'
  };

  const normalize = value => String(value || '')
    .toLowerCase().normalize('NFKC')
    .replace(/[&/_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}+]+/gu, ' ')
    .replace(/\s+/g, ' ').trim();

  const tokens = value => [...new Set(normalize(value).split(' ').filter(Boolean))];

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

  function tabFor(button) {
    const target = targetOf(button);
    return target ? document.getElementById(`tab-${target}`) : null;
  }

  function tabCorpus(button) {
    const tab = tabFor(button);
    if (!tab) return '';
    const chunks = [];
    const selectors = [
      'h1','h2','h3','h4','h5','strong','b','button','label','summary',
      '[aria-label]','[title]','input[placeholder]','textarea[placeholder]'
    ];
    tab.querySelectorAll(selectors.join(',')).forEach(node => {
      if (chunks.join(' ').length > 7000) return;
      chunks.push(
        node.textContent || '',
        node.getAttribute?.('aria-label') || '',
        node.getAttribute?.('title') || '',
        node.getAttribute?.('placeholder') || ''
      );
    });
    return normalize(chunks.join(' ')).slice(0, 8000);
  }

  function distance(a, b) {
    if (a === b) return 0;
    if (!a || !b) return Math.max(a.length, b.length);
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
    if (q === c) return 18;
    if (c.startsWith(q) || q.startsWith(c)) return 11;
    if (q.length >= 3 && c.includes(q)) return 7;
    if (q.length >= 4 && c.length >= 4) {
      const longest = Math.max(q.length, c.length);
      const limit = longest >= 9 ? 2 : 1;
      if (Math.abs(q.length - c.length) <= limit && distance(q, c) <= limit) return 7;
    }
    return 0;
  }

  function score(button, raw) {
    const query = normalize(raw);
    if (!query) return 0;
    const label = labelOf(button);
    const visible = normalize(label);
    const hidden = normalize(TAGS[label] || '');
    const target = normalize(targetOf(button));
    const inside = tabCorpus(button);
    const qTokens = tokens(query);
    const visibleTokens = tokens(visible);
    const hiddenTokens = tokens(hidden);
    const insideTokens = tokens(inside);
    const candidateTokens = [...new Set([...visibleTokens, ...hiddenTokens, ...tokens(target), ...insideTokens])];
    let total = 0;

    if (visible === query) total += 180;
    if (target === query) total += 150;
    if (visible.includes(query) || query.includes(visible)) total += Math.min(95, 45 + query.length * 4);
    if (hiddenTokens.includes(query)) total += 125;
    if (insideTokens.includes(query)) total += 105;
    if (query.length >= 3 && hidden.includes(query)) total += 70;
    if (query.length >= 3 && inside.includes(query)) total += 55;

    qTokens.forEach(q => {
      let best = 0;
      candidateTokens.forEach(c => { best = Math.max(best, wordScore(q, c)); });
      total += best;
      if (visibleTokens.includes(q)) total += 30;
      if (hiddenTokens.includes(q)) total += 24;
      if (insideTokens.includes(q)) total += 16;
    });

    if (qTokens.length > 1) {
      const covered = qTokens.filter(q => candidateTokens.some(c => wordScore(q, c) >= 7)).length;
      total += covered * 12;
      if (covered === qTokens.length) total += 25;
    }
    return total;
  }

  function ranked(query) {
    return Array.from(document.querySelectorAll('#moreMenu .more-item'))
      .map(button => ({button, label:labelOf(button), target:targetOf(button), score:score(button, query)}))
      .filter(row => row.score >= 12)
      .sort((a,b) => b.score - a.score || a.label.localeCompare(b.label));
  }

  function openResult(row, query) {
    if (!row?.button) return;
    try { row.button.click(); }
    catch (_) { if (row.target) window.openMoreTab?.(row.target); }
    try { localStorage.setItem('nexusnova_last_allapps_search', JSON.stringify({query, label:row.label, target:row.target, at:Date.now()})); } catch (_) {}
  }

  function aiFallbackButton(results, query) {
    const ai = Array.from(document.querySelectorAll('#moreMenu .more-item')).find(b => labelOf(b) === 'AI');
    if (!ai) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nx-smart-result nx-smart-ai';
    b.textContent = 'Ask NexusNova AI instead';
    b.addEventListener('click', () => {
      const row = {button:ai,label:'AI',target:targetOf(ai),score:1};
      openResult(row, query);
      setTimeout(() => {
        const aiInput = document.getElementById('aiInput');
        if (aiInput && !aiInput.value) aiInput.value = query;
      }, 180);
    });
    results.appendChild(b);
  }

  function install() {
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner || document.getElementById('nxAllAppsSmartSearch')) return false;

    const panel = document.createElement('div');
    panel.id = 'nxAllAppsSmartSearch';
    panel.innerHTML = `
      <div class="nx-smart-head">
        <div><strong>SMART APP SEARCH</strong><small>Search every NexusNova hub, tool and hidden feature</small></div>
        <span>LOCAL FIRST</span>
      </div>
      <div class="nx-smart-row">
        <input type="search" data-smart-input autocomplete="off" spellcheck="false" placeholder="Try Quran, Bukhari, salary, ticket, QR, weather…">
        <button type="button" data-smart-go>Search</button>
      </div>
      <div class="nx-smart-status" data-smart-status>Type what you need. NexusNova checks its own apps before AI.</div>
      <div class="nx-smart-results" data-smart-results></div>`;

    const style = document.createElement('style');
    style.textContent = `
      #nxAllAppsSmartSearch{grid-column:1/-1;margin:0 0 16px;padding:15px;border:1px solid rgba(56,189,248,.28);border-radius:20px;background:radial-gradient(circle at 92% 0,rgba(14,165,233,.16),transparent 32%),linear-gradient(145deg,rgba(4,20,38,.96),rgba(8,33,55,.91));box-shadow:0 14px 34px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.04)}
      #nxAllAppsSmartSearch .nx-smart-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}#nxAllAppsSmartSearch .nx-smart-head strong{display:block;color:#e8f7ff;font-size:12px;letter-spacing:.13em}#nxAllAppsSmartSearch .nx-smart-head small{display:block;color:#7895aa;font-size:10px;margin-top:3px}#nxAllAppsSmartSearch .nx-smart-head>span{white-space:nowrap;border:1px solid rgba(34,211,238,.2);border-radius:999px;padding:5px 8px;color:#65d8ff;font-size:9px;font-weight:900;letter-spacing:.1em;background:rgba(8,145,178,.08)}
      #nxAllAppsSmartSearch .nx-smart-row{display:flex;gap:9px}#nxAllAppsSmartSearch input{flex:1;min-width:0;border:1px solid rgba(96,165,250,.28);border-radius:14px;background:rgba(2,8,23,.82);color:#f8fafc;padding:12px 13px;outline:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.015)}#nxAllAppsSmartSearch input:focus{border-color:rgba(56,189,248,.7);box-shadow:0 0 0 3px rgba(14,165,233,.1)}
      #nxAllAppsSmartSearch [data-smart-go],#nxAllAppsSmartSearch .nx-smart-result{border:0;border-radius:12px;padding:10px 14px;font-weight:850;cursor:pointer;color:#ecfeff;background:linear-gradient(135deg,#0284c7,#0891b2);box-shadow:0 8px 18px rgba(2,132,199,.18)}#nxAllAppsSmartSearch [data-smart-go]:active,#nxAllAppsSmartSearch .nx-smart-result:active{transform:translateY(1px)}
      #nxAllAppsSmartSearch .nx-smart-status{font-size:11px;color:#8ba4b7;margin-top:9px;line-height:1.4}#nxAllAppsSmartSearch .nx-smart-results{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}#nxAllAppsSmartSearch .nx-smart-result{padding:8px 10px;font-size:11px;background:rgba(14,116,144,.25);border:1px solid rgba(34,211,238,.18);box-shadow:none}#nxAllAppsSmartSearch .nx-smart-result:first-child{background:linear-gradient(135deg,rgba(2,132,199,.55),rgba(8,145,178,.45));border-color:rgba(103,232,249,.38)}#nxAllAppsSmartSearch .nx-smart-ai{background:rgba(51,65,85,.4)!important;border-color:rgba(148,163,184,.18)!important;color:#cbd5e1!important}
      @media(max-width:560px){#nxAllAppsSmartSearch .nx-smart-head>span{display:none}#nxAllAppsSmartSearch .nx-smart-row{align-items:stretch}#nxAllAppsSmartSearch [data-smart-go]{padding-inline:12px}}
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
      if (!query) {
        status.textContent = 'Type what you need. NexusNova checks its own apps before AI.';
        return;
      }
      const rows = ranked(query);
      if (!rows.length) {
        status.textContent = `No NexusNova app matched “${query}”. AI is optional — it will not open automatically.`;
        aiFallbackButton(results, query);
        return;
      }

      const top = rows[0];
      status.textContent = `Found inside NexusNova: ${top.label}${rows.length > 1 ? ` • ${Math.min(rows.length,4)} relevant sections` : ''}`;
      rows.slice(0,4).forEach((row,index) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nx-smart-result';
        b.textContent = `${index === 0 ? '★ ' : ''}${row.label}`;
        b.title = row.target ? `Open ${row.label}` : row.label;
        b.addEventListener('click', () => openResult(row, query));
        results.appendChild(b);
      });

      if (autoOpen) {
        const second = rows[1];
        const decisive = top.score >= 80 && (!second || top.score >= second.score + 16 || top.score >= second.score * 1.35);
        if (decisive) setTimeout(() => openResult(top, query), 90);
      }
    };

    go.addEventListener('click', () => render(true));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        render(true);
      }
    });
    input.addEventListener('input', () => render(false));
    return true;
  }

  window.nexusAllAppsSmartSearch = query => ranked(query).slice(0,8).map(row => ({label:row.label,target:row.target,score:row.score}));
  window.nexusAllAppsSmartSearchVersion = 'local-first-v2';

  const boot = () => {
    install();
    [350,900,1800,3500,6500].forEach(ms => setTimeout(install, ms));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();