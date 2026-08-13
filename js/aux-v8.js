/* NexusNova AUX V8
   Additive repair only. Does not replace mining/wallet/tasks/market logic.
*/
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const set = (id,v) => { const e=$(id); if(e) e.textContent=String(v); };
  const esc = s => { const d=document.createElement('div'); d.textContent=String(s??''); return d.innerHTML; };

  function user(){ return window.__nexusAuthUser || (window.firebase?.auth?.currentUser) || null; }

  // Ticker: reuse the exact same Binance endpoint that the working Market uses.
  async function ticker(){
    const el=$('ticker'); if(!el) return;
    try{
      const r=await fetch('https://api.binance.com/api/v3/ticker/24hr',{cache:'no-store'});
      if(!r.ok) throw new Error(r.status);
      const rows=await r.json();
      const wanted=['BTC','ETH','BNB','SOL','XRP','ADA','DOGE','TRX','AVAX','LINK'];
      const map=new Map(rows.filter(x=>wanted.includes(String(x.symbol||'').replace('USDT',''))).map(x=>[String(x.symbol).replace('USDT',''),x]));
      const html=wanted.map(s=>{
        const x=map.get(s); if(!x) return '';
        const p=Number(x.lastPrice||0); const c=Number(x.priceChangePercent||0);
        return `<span class="ticker-item"><b>${s}</b> $${p.toLocaleString(undefined,{maximumFractionDigits:6})} <span class="${c>=0?'up':'down'}">${c>=0?'+':''}${c.toFixed(2)}%</span></span>`;
      }).join('');
      if(html) el.innerHTML=html;
      else throw new Error('empty');
    }catch(e){
      // If Market already has data, use it instead of showing a blank ticker.
      const coins=window.marketCoins;
      if(Array.isArray(coins)&&coins.length){
        const html=coins.slice(0,10).map(x=>`<span class="ticker-item"><b>${esc(x.symbol||'')}</b> $${Number(x.current_price||0).toLocaleString(undefined,{maximumFractionDigits:6})}</span>`).join('');
        if(html) el.innerHTML=html;
      }
    }
  }

  // Profile: Firebase Auth is enough to prevent an infinite Loading state.
  async function profile(){
    let u=null;
    try{
      const mod=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js');
      // page2.js has the initialized auth internally, so obtain the current user from its auth state through DOM/local fallback.
      u=window.__nexusAuthUser || null;
    }catch(_){ }
    if(!u){
      // Wait for page2's auth callback; it stores a safe public snapshot below.
      const name=$('profileName');
      if(name && name.textContent==='Miner User') set('profileEmailDisplay','Loading account…');
      return;
    }
    set('profileName',u.displayName||'Miner User');
    set('profileEmailDisplay',u.email||'');
    set('profileId',u.uid.slice(0,12)+'...');
    if($('profileTotalMined')?.textContent.includes('Loading')) set('profileTotalMined','0.0000 NVX');
    if($('profileTasksDone')?.textContent.includes('Loading')) set('profileTasksDone','0');
    if($('refCodeDisplay')?.textContent==='---') set('refCodeDisplay','NVX'+u.uid.slice(0,8).toUpperCase());
  }

  // News: direct GDELT JSON endpoint through fetch; fallback to BBC RSS via rss2json.
  async function news(){
    const list=$('newsList'); if(!list) return;
    set('newsStatus','Connecting...');
    list.innerHTML='<div class="status">Loading live world news...</div>';
    try{
      const r=await fetch('https://api.gdeltproject.org/api/v2/doc/doc?query=world&mode=artlist&format=json&maxrecords=10&timespan=1d',{cache:'no-store'});
      if(!r.ok) throw new Error(r.status);
      const j=await r.json(); const a=Array.isArray(j.articles)?j.articles:[];
      if(!a.length) throw new Error('no articles');
      list.innerHTML="";
      a.forEach(x=>{
        const item=document.createElement("div");
        item.className="news-item";
        const title=document.createElement("div");
        title.className="news-title";
        title.textContent=x.title||"World News";
        const meta=document.createElement("div");
        meta.className="news-meta";
        meta.textContent=x.seendate||"";
        item.append(title,meta);
        try{
          const u=new URL(String(x.url||"").trim());
          if(u.protocol==="http:" || u.protocol==="https:"){
            const btn=document.createElement("button");
            btn.className="action-btn";
            btn.style.cssText="margin-top:7px;padding:7px 10px";
            btn.type="button";
            btn.textContent="Read News";
            btn.addEventListener("click",()=>window.open(u.href,"_blank","noopener,noreferrer"));
            item.appendChild(btn);
          }
        }catch(_){}
        list.appendChild(item);
      });
      set('newsStatus','Connected • Live');
      return;
    }catch(_){ }
    try{
      const r=await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/world/rss.xml',{cache:'no-store'});
      if(!r.ok) throw new Error(r.status);
      const j=await r.json(); const a=Array.isArray(j.items)?j.items:[];
      if(!a.length) throw new Error('no articles');
      list.innerHTML="";
      a.slice(0,10).forEach(x=>{
        const item=document.createElement("div");
        item.className="news-item";
        const title=document.createElement("div");
        title.className="news-title";
        title.textContent=x.title||"World News";
        const meta=document.createElement("div");
        meta.className="news-meta";
        meta.textContent=x.pubDate||"";
        item.append(title,meta);
        try{
          const u=new URL(String(x.link||"").trim());
          if(u.protocol==="http:" || u.protocol==="https:"){
            const btn=document.createElement("button");
            btn.className="action-btn";
            btn.style.cssText="margin-top:7px;padding:7px 10px";
            btn.type="button";
            btn.textContent="Read News";
            btn.addEventListener("click",()=>window.open(u.href,"_blank","noopener,noreferrer"));
            item.appendChild(btn);
          }
        }catch(_){}
        list.appendChild(item);
      });
      set('newsStatus','Connected');
    }catch(e){
      list.innerHTML='<div class="status">Live news temporarily unavailable. Press Refresh to retry.</div>';
      set('newsStatus','Offline');
    }
  }

  // Gold/FX: use browser-friendly APIs with independent fallbacks.
  async function finance(){
    set('goldStatus','Loading live gold + USD/PKR...');
    try{
      const [g,f]=await Promise.all([
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd',{cache:'no-store'}),
        fetch('https://open.er-api.com/v6/latest/USD',{cache:'no-store'})
      ]);
      if(!g.ok||!f.ok) throw new Error('api');
      const gj=await g.json(), fj=await f.json();
      const ounce=Number(gj?.['pax-gold']?.usd||0), pkr=Number(fj?.rates?.PKR||0);
      if(!ounce||!pkr) throw new Error('data');
      const gramUsd=ounce/31.1034768, gramPkr=gramUsd*pkr;
      set('goldUsd',`$${ounce.toLocaleString(undefined,{maximumFractionDigits:2})} / oz`);
      set('goldUsdGram',`$${gramUsd.toFixed(2)} / gram`);
      set('goldPkr',`Approx. PKR ${gramPkr.toLocaleString(undefined,{maximumFractionDigits:0})} / gram`);
      set('gold24g',`PKR ${gramPkr.toLocaleString(undefined,{maximumFractionDigits:0})}`);
      set('gold22g',`PKR ${(gramPkr*22/24).toLocaleString(undefined,{maximumFractionDigits:0})}`);
      set('goldStatus','Connected • Live');
      localStorage.setItem('nexus_finance_v8',JSON.stringify({ounce,pkr,at:Date.now()}));
    }catch(e){
      try{
        const c=JSON.parse(localStorage.getItem('nexus_finance_v8')||'null');
        if(c?.ounce&&c?.pkr){
          const gramPkr=c.ounce/31.1034768*c.pkr;
          set('goldUsd',`$${Number(c.ounce).toFixed(2)} / oz`); set('goldUsdGram',`$${(c.ounce/31.1034768).toFixed(2)} / gram`); set('goldPkr',`Cached PKR ${gramPkr.toFixed(0)} / gram`); set('gold24g',`PKR ${gramPkr.toFixed(0)}`); set('gold22g',`PKR ${(gramPkr*22/24).toFixed(0)}`); set('goldStatus','Cached'); return;
        }
      }catch(_){ }
      set('goldStatus','Live data unavailable');
    }
  }

  // Auxiliary menu: force correct tab selection without touching core tabs.
  function bindMore(){
    document.querySelectorAll('.more-item').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const label=(btn.textContent||'').toLowerCase();
        setTimeout(()=>{
          if(label.includes('gold')) finance();
          else if(label.includes('news')) news();
          else if(label.includes('profile')) profile();
          else if(label.includes('chat') && typeof window.loadChat==='function') window.loadChat();
        },150);
      });
    });
  }

  // Expose only auxiliary helpers.
  window.nexusAuxV8={ticker,profile,news,finance};
  window.nexusTickerRefreshV8=ticker;
  window.nexusAuxProfileV8=profile;
  window.nexusAuxNewsV8=news;
  window.nexusAuxFinanceV8=finance;

  // Capture the authenticated user from Firebase's auth state without changing its existing listener.
  (async()=>{
    try{
      const appmod=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js');
      const authmod=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js');
      const apps=appmod.getApps(); if(!apps.length) return;
      const a=authmod.getAuth(apps[0]);
      authmod.onAuthStateChanged(a,u=>{ window.__nexusAuthUser=u||null; if(u) profile(); });
    }catch(_){ }
  })();

  window.addEventListener('load',()=>{
    bindMore();
    ticker();
    setTimeout(ticker,2500);
    setTimeout(()=>{ if($('tab-profile')?.classList.contains('active')) profile(); },700);
  });
})();
