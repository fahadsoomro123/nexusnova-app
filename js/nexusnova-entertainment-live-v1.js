/* NexusNova Entertainment Live v1
   Additive discovery/search layer for the existing Entertainment Hub.
   Existing provider tiles stay untouched.
*/
(() => {
  'use strict';
  if (window.__nxEntertainmentLiveV1) return;
  window.__nxEntertainmentLiveV1 = true;

  const STORAGE = 'nexusnova_entertainment_recent_v1';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const PROVIDERS = {
    youtube: {
      label:'YouTube',
      url:q=>`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    },
    music: {
      label:'YouTube Music',
      url:q=>`https://music.youtube.com/search?q=${encodeURIComponent(q)}`
    },
    dailymotion: {
      label:'Dailymotion',
      url:q=>`https://www.dailymotion.com/search/${encodeURIComponent(q)}/videos`
    },
    imdb: {
      label:'IMDb',
      url:q=>`https://www.imdb.com/find/?q=${encodeURIComponent(q)}`
    },
    netflix: {
      label:'Netflix',
      url:q=>`https://www.netflix.com/search?q=${encodeURIComponent(q)}`
    }
  };

  function readRecent() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE) || '[]');
      return Array.isArray(value) ? value.filter(x=>x && x.q).slice(0,6) : [];
    } catch (_) { return []; }
  }

  function saveRecent(q,provider) {
    const clean = String(q || '').trim().slice(0,120);
    if (!clean) return;
    const next = [{q:clean,provider,at:Date.now()},...readRecent().filter(x=>String(x.q).toLowerCase()!==clean.toLowerCase())].slice(0,6);
    try { localStorage.setItem(STORAGE,JSON.stringify(next)); } catch (_) {}
    renderRecent();
  }

  function openUrl(url) {
    if (typeof window.nxOpenExternal === 'function') return window.nxOpenExternal(url);
    const opened = window.open(url,'_blank','noopener,noreferrer');
    if (opened) try { opened.opener = null; } catch (_) {}
  }

  function search(q,providerKey) {
    const clean = String(q || '').trim();
    if (!clean) {
      window.NexusNovaUI?.toast?.('Type a movie, song, creator or topic first.');
      $('nxEntertainmentQuery')?.focus();
      return;
    }
    const key = PROVIDERS[providerKey] ? providerKey : 'youtube';
    saveRecent(clean,key);
    openUrl(PROVIDERS[key].url(clean));
  }

  function renderRecent() {
    const box = $('nxEntertainmentRecent');
    if (!box) return;
    const items = readRecent();
    if (!items.length) {
      box.innerHTML = '<span class="nx-ent-empty">Your recent entertainment searches will appear here.</span>';
      return;
    }
    box.innerHTML = items.map((item,index)=>`<button type="button" class="nx-ent-chip" data-nx-ent-recent="${index}" title="Search ${esc(item.q)} on ${esc(PROVIDERS[item.provider]?.label || 'YouTube')}">${esc(item.q)}</button>`).join('');
    box.querySelectorAll('[data-nx-ent-recent]').forEach(button=>button.addEventListener('click',()=>{
      const item=items[Number(button.dataset.nxEntRecent)];
      if (!item) return;
      if ($('nxEntertainmentQuery')) $('nxEntertainmentQuery').value=item.q;
      if ($('nxEntertainmentProvider')) $('nxEntertainmentProvider').value=PROVIDERS[item.provider]?item.provider:'youtube';
      search(item.q,item.provider);
    }));
  }

  function ensureStyles() {
    if ($('nxEntertainmentLiveStyles')) return;
    const style=document.createElement('style');
    style.id='nxEntertainmentLiveStyles';
    style.textContent=`
      .nx-ent-discover{position:relative;overflow:hidden;margin:14px 0;padding:16px;border-radius:20px;border:1px solid rgba(98,174,255,.18);background:linear-gradient(145deg,rgba(9,28,52,.96),rgba(5,16,32,.96));box-shadow:0 14px 34px rgba(0,0,0,.18)}
      .nx-ent-discover:before{content:"";position:absolute;right:-55px;top:-75px;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,rgba(54,158,255,.17),transparent 68%);pointer-events:none}
      .nx-ent-title{display:flex;align-items:center;gap:10px;color:#f7fbff;font-size:15px;font-weight:900}.nx-ent-title span{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(145deg,#1978ff,#41b8ff);box-shadow:0 9px 22px rgba(28,126,255,.25)}.nx-ent-title svg{width:19px;height:19px;color:#fff}
      .nx-ent-sub{margin:6px 0 12px;color:#829bb5;font-size:11px;line-height:1.5}
      .nx-ent-search{display:grid;grid-template-columns:minmax(0,1fr) minmax(128px,.42fr) auto;gap:8px}.nx-ent-search input,.nx-ent-search select{min-width:0;min-height:44px;border-radius:13px;border:1px solid rgba(106,169,235,.18);background:rgba(4,16,32,.92);color:#f7fbff;padding:10px 12px;outline:0}.nx-ent-search input:focus,.nx-ent-search select:focus{border-color:#4ba6ff;box-shadow:0 0 0 3px rgba(43,139,255,.13)}
      .nx-ent-search button{min-height:44px;border:0;border-radius:13px;padding:0 16px;color:#fff;font-weight:900;background:linear-gradient(135deg,#156eff,#3eb4ff);box-shadow:0 9px 22px rgba(27,126,255,.24);cursor:pointer}
      .nx-ent-recent-head{margin-top:13px;color:#6f8da9;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.nx-ent-recent{display:flex;flex-wrap:wrap;gap:7px;margin-top:7px}.nx-ent-chip{border:1px solid rgba(91,163,235,.17);border-radius:999px;background:rgba(7,23,43,.78);color:#bcd4ed;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer}.nx-ent-chip:active{transform:scale(.97)}.nx-ent-empty{color:#647d97;font-size:10px}
      @media(max-width:640px){.nx-ent-search{grid-template-columns:1fr}.nx-ent-search button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    const tab=$('tab-entertainment');
    if (!tab || $('nxEntertainmentDiscover')) return false;
    ensureStyles();
    const host=tab.querySelector(':scope > .card') || tab;
    const hero=host.querySelector('.hub-hero');
    const block=document.createElement('div');
    block.id='nxEntertainmentDiscover';
    block.className='nx-ent-discover';
    block.innerHTML=`
      <div class="nx-ent-title"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/><path d="m9.5 8.5 5 2.5-5 2.5v-5Z"/></svg></span><div>Find Entertainment</div></div>
      <div class="nx-ent-sub">Search movies, shows, songs, creators or videos and open the provider you prefer.</div>
      <div class="nx-ent-search"><input id="nxEntertainmentQuery" type="search" autocomplete="off" placeholder="Movie, song, creator, topic…"><select id="nxEntertainmentProvider">${Object.entries(PROVIDERS).map(([key,p])=>`<option value="${key}">${p.label}</option>`).join('')}</select><button id="nxEntertainmentSearchBtn" type="button">SEARCH</button></div>
      <div class="nx-ent-recent-head">Recent searches</div><div id="nxEntertainmentRecent" class="nx-ent-recent"></div>`;
    if (hero) hero.insertAdjacentElement('afterend',block); else host.insertBefore(block,host.firstChild);
    $('nxEntertainmentSearchBtn')?.addEventListener('click',()=>search($('nxEntertainmentQuery')?.value,$('nxEntertainmentProvider')?.value));
    $('nxEntertainmentQuery')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();search(event.currentTarget.value,$('nxEntertainmentProvider')?.value);}});
    renderRecent();
    return true;
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,700),{once:true}); else setTimeout(install,300);
  [1200,2400,4800,8000].forEach(ms=>setTimeout(install,ms));
})();