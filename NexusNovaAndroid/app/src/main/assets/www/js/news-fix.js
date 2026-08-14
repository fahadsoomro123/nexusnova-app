/* NexusNova NEWS FIX V7
   Robust bilingual Pakistan-first newsroom.
   Key reliability changes:
   - Urdu uses real Pakistani Urdu RSS feeds (UrduPoint) for core categories.
   - Every feed has its own fallback path; one working category can no longer mask a failed Pakistan feed.
   - Legacy malformed News markup is replaced by a self-contained News root while ALL APPS back navigation is preserved.
*/
(() => {
  "use strict";
  if (window.__nxPremiumNewsV7) return;
  window.__nxPremiumNewsV7 = true;
  window.__nxPremiumNewsV6 = true;
  window.__nxPremiumNewsV5 = true;
  window.__nxPremiumNewsV4 = true;
  window.__nxPremiumNewsV3 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const safeUrl = value => {
    try {
      const u = new URL(String(value || ""));
      return /^(https?:)$/.test(u.protocol) ? u.href : "";
    } catch (_) { return ""; }
  };
  const hasUrdu = text => /[\u0600-\u06ff]/.test(String(text || ""));

  let requestNo = 0;
  let currentItems = [];
  let activeCategory = "ALL";
  let language = localStorage.getItem("nx_news_language") === "en" ? "en" : "ur";

  const TEXT = {
    en: {
      heading:"Pakistan Live News Desk",
      sub:"Pakistan • Sindh • Business • Sports • Technology • Entertainment • World",
      breaking:"BREAKING NEWS", live:"LIVE", language:"News language",
      loading:"Connecting to live English news sources…",
      offline:"Live news is temporarily unavailable. Tap Refresh to retry.",
      read:"READ FULL STORY", tap:"Tap to read full story",
      empty:"No stories are available in this section right now.",
      status:"English News Desk",
      categories:{ALL:"All News",PAKISTAN:"Pakistan",SINDH:"Sindh",BUSINESS:"Business",SPORTS:"Sports",TECH:"Tech",ENTERTAINMENT:"Entertainment",WORLD:"World"}
    },
    ur: {
      heading:"پاکستان لائیو نیوز ڈیسک",
      sub:"پاکستان • سندھ • کاروبار • کھیل • ٹیکنالوجی • شوبز • دنیا",
      breaking:"بریکنگ نیوز", live:"لائیو", language:"خبروں کی زبان",
      loading:"پاکستانی اردو نیوز ذرائع سے رابطہ ہو رہا ہے…",
      offline:"اردو خبریں عارضی طور پر دستیاب نہیں۔ ریفریش کر کے دوبارہ کوشش کریں۔",
      read:"مکمل خبر پڑھیں", tap:"مکمل خبر پڑھنے کے لیے کھولیں",
      empty:"اس حصے میں اس وقت کوئی خبر دستیاب نہیں۔",
      status:"اردو نیوز ڈیسک",
      categories:{ALL:"تمام خبریں",PAKISTAN:"پاکستان",SINDH:"سندھ",BUSINESS:"کاروبار",SPORTS:"کھیل",TECH:"ٹیکنالوجی",ENTERTAINMENT:"شوبز",WORLD:"دنیا"}
    }
  };

  const plainText = html => {
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      return String(doc.body?.textContent || "").replace(/\s+/g, " ").trim();
    } catch (_) { return ""; }
  };
  const imageFromHtml = html => {
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      return safeUrl(doc.querySelector("img")?.getAttribute("src") || "");
    } catch (_) { return ""; }
  };
  function splitTitle(title, fallbackSource) {
    const text = String(title || "").trim();
    const parts = text.split(/\s+-\s+/);
    if (parts.length > 1) {
      const source = parts.pop().trim();
      return { title: parts.join(" - ").trim(), source: source || fallbackSource };
    }
    return { title:text, source:fallbackSource };
  }
  function dateValue(value) {
    const d = new Date(value || "");
    return Number.isFinite(d.getTime()) ? d : null;
  }
  function timeAgo(value) {
    const d = dateValue(value);
    if (!d) return language === "ur" ? "تازہ خبر" : "Live update";
    const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
    if (language === "ur") {
      if (mins < 1) return "ابھی";
      if (mins < 60) return `${mins} منٹ پہلے`;
      const h = Math.floor(mins / 60);
      if (h < 24) return `${h} گھنٹے پہلے`;
      return `${Math.floor(h / 24)} دن پہلے`;
    }
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  }
  function isBreaking(item, index) {
    const d = dateValue(item.date);
    return Boolean((d && Date.now() - d.getTime() <= 6 * 3600e3) || index < 4);
  }

  function injectStyle() {
    if ($("nxPremiumNewsStyleV7")) return;
    ["nxPremiumNewsStyle","nxPremiumNewsStyleV5","nxPremiumNewsStyleV6"].forEach(id => $(id)?.remove());
    const style = document.createElement("style");
    style.id = "nxPremiumNewsStyleV7";
    style.textContent = `
      #tab-news .nx-news-shell{background:linear-gradient(180deg,#091426,#07101e);border:1px solid rgba(56,189,248,.24);border-radius:18px;padding:16px;box-shadow:0 22px 60px rgba(0,0,0,.35);overflow:hidden}
      .nx-news-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:13px}.nx-news-kicker{font-size:10px;letter-spacing:.18em;color:#38bdf8;font-weight:950}.nx-news-heading{font-size:23px;line-height:1.16;font-weight:950;margin-top:5px;background:linear-gradient(90deg,#fff,#7dd3fc,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent}.nx-news-sub{font-size:11px;color:#94a3b8;margin-top:7px;line-height:1.55}.nx-news-live{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(239,68,68,.36);background:rgba(127,29,29,.22);border-radius:999px;color:#fecaca;font-size:10px;font-weight:950;white-space:nowrap}.nx-news-live i{width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 14px #ef4444;animation:nxNPulse 1.1s infinite}@keyframes nxNPulse{50%{opacity:.35;transform:scale(.72)}}
      .nx-breaking{display:grid;grid-template-columns:auto 1fr;min-height:42px;border:1px solid rgba(239,68,68,.36);border-radius:11px;overflow:hidden;background:#070d17;margin-bottom:10px}.nx-breaking-label{display:flex;align-items:center;padding:0 13px;background:linear-gradient(135deg,#ef233c,#b90432);font-size:10px;font-weight:950;color:#fff;white-space:nowrap}.nx-breaking-window{display:flex;align-items:center;overflow:hidden}.nx-breaking-track{display:inline-flex;min-width:max-content;white-space:nowrap;animation:nxNTicker 52s linear infinite}.nx-breaking-track span{padding:0 26px 0 12px;color:#e2e8f0;font-size:11px}.nx-breaking-track b{color:#38bdf8;margin-right:7px}@keyframes nxNTicker{from{transform:translateX(8%)}to{transform:translateX(-100%)}}
      .nx-news-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border:1px solid rgba(56,189,248,.16);background:rgba(8,15,28,.84);border-radius:12px;margin-bottom:10px}.nx-news-language-label{font-size:10px;color:#94a3b8;font-weight:850}.nx-news-lang-wrap{display:flex;gap:6px}.nx-news-lang,.nx-news-chip,.nx-news-refresh{border:1px solid rgba(148,163,184,.24);background:#111827;color:#cbd5e1;font-weight:900}.nx-news-lang{border-radius:9px;padding:7px 12px;font-size:11px}.nx-news-lang.active,.nx-news-chip.active{background:linear-gradient(135deg,#0ea5e9,#2563eb);border-color:transparent;color:#fff;box-shadow:0 8px 20px rgba(37,99,235,.23)}.nx-news-refresh{border-radius:9px;padding:7px 11px;font-size:11px;color:#7dd3fc}.nx-news-filters{display:flex;gap:7px;overflow:auto;padding:1px 0 12px;scrollbar-width:none}.nx-news-filters::-webkit-scrollbar{display:none}.nx-news-chip{border-radius:999px;padding:7px 11px;font-size:10px;white-space:nowrap}.nx-news-count{opacity:.65;font-weight:700;margin-inline-start:4px}
      .nx-feature-story{position:relative;min-height:320px;border-radius:17px;overflow:hidden;border:1px solid rgba(255,255,255,.1);margin-bottom:14px;background:#0f172a;cursor:pointer;isolation:isolate}.nx-feature-media,.nx-news-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0b1220}.nx-feature-story:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(1,7,17,.05) 20%,rgba(2,8,20,.54) 55%,rgba(2,8,20,.98) 100%);z-index:1}.nx-feature-fallback,.nx-news-image-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 18% 22%,rgba(56,189,248,.24),transparent 33%),radial-gradient(circle at 82% 18%,rgba(167,139,250,.22),transparent 29%),linear-gradient(135deg,#07111f,#10192d);color:rgba(255,255,255,.18);font-size:50px;font-weight:950}.nx-feature-copy{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:23px}.nx-badge-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:9px}.nx-news-breaking{background:linear-gradient(135deg,#ef233c,#b90432);color:#fff;padding:5px 8px;border-radius:6px;font-size:9px;font-weight:950}.nx-news-category{padding:5px 8px;border-radius:6px;background:rgba(14,165,233,.17);border:1px solid rgba(56,189,248,.32);color:#7dd3fc;font-size:9px;font-weight:900}.nx-feature-title{font-size:22px;line-height:1.25;font-weight:950;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.48)}.nx-feature-meta,.nx-card-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:#cbd5e1;font-size:10px;margin-top:10px}.nx-source-dot{width:5px;height:5px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8}
      .nx-news-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nx-news-card{overflow:hidden;border:1px solid rgba(148,163,184,.14);border-radius:15px;background:linear-gradient(180deg,rgba(17,24,39,.96),rgba(8,14,25,.99));box-shadow:0 14px 32px rgba(0,0,0,.24);cursor:pointer}.nx-news-media{position:relative;height:175px;background:#0b1220;overflow:hidden}.nx-news-card-body{padding:13px}.nx-news-card-title{font-size:14px;line-height:1.45;font-weight:900;color:#f8fafc;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.nx-news-snippet{font-size:11px;line-height:1.55;color:#94a3b8;margin-top:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.nx-news-read{display:flex;justify-content:space-between;margin-top:11px;padding-top:10px;border-top:1px solid rgba(148,163,184,.11);color:#38bdf8;font-size:10px;font-weight:950}.nx-news-empty,.nx-news-loading{padding:28px 15px;text-align:center;color:#94a3b8;border:1px dashed rgba(148,163,184,.2);border-radius:14px}
      #tab-news.nx-news-urdu .nx-news-heading,#tab-news.nx-news-urdu .nx-news-sub,#tab-news.nx-news-urdu .nx-feature-title,#tab-news.nx-news-urdu .nx-news-card-title,#tab-news.nx-news-urdu .nx-news-snippet{direction:rtl;text-align:right;font-family:"Noto Nastaliq Urdu","Noto Sans Arabic","Segoe UI",Arial,sans-serif}#tab-news.nx-news-urdu .nx-feature-meta,#tab-news.nx-news-urdu .nx-card-meta,#tab-news.nx-news-urdu .nx-news-read{direction:rtl}#tab-news.nx-news-urdu .nx-breaking-track{direction:rtl}
      @media(max-width:680px){.nx-news-grid{grid-template-columns:1fr}.nx-feature-story{min-height:285px}.nx-feature-title{font-size:19px}.nx-news-media{height:195px}.nx-news-heading{font-size:21px}.nx-news-top{align-items:flex-start}.nx-news-controls{align-items:flex-start;flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    const tab = $("tab-news");
    if (!tab) return null;
    injectStyle();
    tab.classList.toggle("nx-news-urdu", language === "ur");

    let root = $("nxNewsRoot");
    if (!root) {
      const keep = [];
      tab.querySelectorAll("button").forEach(btn => {
        const label = String(btn.textContent || "").replace(/\s+/g," ").trim().toUpperCase();
        if (label.includes("BACK TO ALL APPS")) keep.push(btn.closest(".nx-allapps-back") || btn);
      });
      keep.forEach(node => { try { tab.insertBefore(node, tab.firstChild); } catch (_) {} });
      Array.from(tab.children).forEach(child => {
        const label = String(child.textContent || "").replace(/\s+/g," ").trim().toUpperCase();
        if (label.includes("BACK TO ALL APPS")) return;
        child.remove();
      });

      root = document.createElement("div");
      root.id = "nxNewsRoot";
      root.className = "nx-news-shell";
      root.innerHTML = `
        <div class="nx-news-top"><div><div class="nx-news-kicker">NEXUSNOVA NEWSROOM</div><div id="nxNewsHeading" class="nx-news-heading"></div><div id="nxNewsSub" class="nx-news-sub"></div></div><div id="nxNewsLive" class="nx-news-live"><i></i></div></div>
        <div class="nx-breaking"><div id="nxBreakingLabel" class="nx-breaking-label"></div><div class="nx-breaking-window"><div id="nxBreakingTrack" class="nx-breaking-track"></div></div></div>
        <div class="nx-news-controls"><div><div id="nxNewsLanguageLabel" class="nx-news-language-label"></div><div class="nx-news-lang-wrap"><button type="button" class="nx-news-lang" data-news-lang="ur">اردو</button><button type="button" class="nx-news-lang" data-news-lang="en">English</button></div></div><button id="nxNewsRefresh" type="button" class="nx-news-refresh">↻ Refresh</button></div>
        <div id="nxNewsFilters" class="nx-news-filters"></div>
        <div id="newsList"><div class="nx-news-loading">Loading…</div></div>`;
      tab.appendChild(root);

      root.querySelectorAll("[data-news-lang]").forEach(btn => btn.addEventListener("click", () => {
        const next = btn.dataset.newsLang === "en" ? "en" : "ur";
        if (next === language) return;
        language = next;
        activeCategory = "ALL";
        localStorage.setItem("nx_news_language", language);
        updateShell();
        window.loadNews();
      }));
      $("nxNewsRefresh")?.addEventListener("click", () => window.loadNews(true));
    }
    updateShell();
    return root;
  }

  function countsFor(items) {
    const counts = {ALL:items.length};
    for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }

  function updateShell() {
    const tab = $("tab-news");
    if (!tab) return;
    tab.classList.toggle("nx-news-urdu", language === "ur");
    const t = TEXT[language];
    if ($("nxNewsHeading")) $("nxNewsHeading").textContent = t.heading;
    if ($("nxNewsSub")) $("nxNewsSub").textContent = t.sub;
    if ($("nxNewsLive")) $("nxNewsLive").innerHTML = `<i></i> ${t.live}`;
    if ($("nxBreakingLabel")) $("nxBreakingLabel").textContent = t.breaking;
    if ($("nxNewsLanguageLabel")) $("nxNewsLanguageLabel").textContent = t.language;
    document.querySelectorAll("#nxNewsRoot [data-news-lang]").forEach(btn => btn.classList.toggle("active", btn.dataset.newsLang === language));

    const filters = $("nxNewsFilters");
    if (filters) {
      const counts = countsFor(currentItems);
      filters.innerHTML = "";
      Object.entries(t.categories).forEach(([cat,label]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nx-news-chip" + (cat === activeCategory ? " active" : "");
        btn.innerHTML = `${esc(label)}${currentItems.length ? `<span class="nx-news-count">${Number(counts[cat] || 0)}</span>` : ""}`;
        btn.addEventListener("click", () => {
          activeCategory = cat;
          updateShell();
          render(currentItems, false);
        });
        filters.appendChild(btn);
      });
    }
  }

  function media(item, feature=false) {
    const img = safeUrl(item.image || "");
    const cls = feature ? "nx-feature-media" : "nx-news-thumb";
    const fb = feature ? "nx-feature-fallback" : "nx-news-image-fallback";
    const initials = hasUrdu(item.source) ? "خبر" : (String(item.source || "NN").split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase() || "NN");
    if (img) return `<img class="${cls}" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="${fb}" style="display:none">${esc(initials)}</div>`;
    return `<div class="${fb}">${esc(initials)}</div>`;
  }

  function renderTicker(items) {
    const el = $("nxBreakingTrack");
    if (!el) return;
    el.innerHTML = items.slice(0,14).map(x => `<span><b>${esc(x.source)}</b>${esc(x.title)}</span>`).join("") || `<span>${language === "ur" ? "تازہ خبریں لوڈ ہو رہی ہیں…" : "Loading latest headlines…"}</span>`;
  }

  function normalizeItems(items) {
    const seen = new Set();
    const out = [];
    for (const raw of items) {
      if (!raw?.title) continue;
      if (language === "ur" && !hasUrdu(raw.title)) continue;
      if (language === "en" && hasUrdu(raw.title)) continue;
      const key = String(raw.title).normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(raw);
      if (out.length >= 80) break;
    }
    return out;
  }

  function render(items, normalize=true) {
    ensureRoot();
    const list = $("newsList");
    if (!list) return;
    const unique = normalize ? normalizeItems(items) : items;
    if (normalize) currentItems = unique;
    renderTicker(currentItems);
    updateShell();

    const t = TEXT[language];
    const clean = activeCategory === "ALL" ? currentItems : currentItems.filter(x => x.category === activeCategory);
    if (!clean.length) {
      list.innerHTML = `<div class="nx-news-empty" ${language === "ur" ? 'dir="rtl"' : ""}>${esc(t.empty)}</div>`;
      return;
    }

    const lead = clean[0];
    const rest = clean.slice(1,25);
    list.innerHTML = `<article class="nx-feature-story" data-i="0">${media(lead,true)}<div class="nx-feature-copy"><div class="nx-badge-row">${isBreaking(lead,0) ? `<span class="nx-news-breaking">● ${esc(t.breaking)}</span>` : ""}<span class="nx-news-category">${esc(t.categories[lead.category] || lead.category)}</span></div><div class="nx-feature-title">${esc(lead.title)}</div><div class="nx-feature-meta"><span class="nx-source-dot"></span><b>${esc(lead.source)}</b><span>•</span><span>${esc(timeAgo(lead.date))}</span><span>• ${esc(t.tap)}</span></div></div></article><div class="nx-news-grid">${rest.map((item,i) => `<article class="nx-news-card" data-i="${i+1}"><div class="nx-news-media">${media(item,false)}</div><div class="nx-news-card-body"><div class="nx-badge-row">${isBreaking(item,i+1) ? `<span class="nx-news-breaking">● ${esc(t.breaking)}</span>` : ""}<span class="nx-news-category">${esc(t.categories[item.category] || item.category)}</span></div><div class="nx-news-card-title">${esc(item.title)}</div>${item.description ? `<div class="nx-news-snippet">${esc(item.description)}</div>` : ""}<div class="nx-card-meta"><span class="nx-source-dot"></span><b>${esc(item.source)}</b><span>•</span><span>${esc(timeAgo(item.date))}</span></div><div class="nx-news-read"><span>${esc(t.read)}</span><span>→</span></div></div></article>`).join("")}</div>`;
    list.querySelectorAll("[data-i]").forEach(card => card.addEventListener("click", () => {
      const item = clean[Number(card.dataset.i) || 0];
      const url = safeUrl(item?.url);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }));
  }

  function googleRss(query, lang) {
    const isUr = lang === "ur";
    return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${isUr ? "ur" : "en-PK"}&gl=PK&ceid=PK:${isUr ? "ur" : "en"}`;
  }

  function feeds(lang) {
    if (lang === "ur") {
      return [
        {rss:"https://www.urdupoint.com/rss/urdupoint-national.rss",category:"PAKISTAN",source:"UrduPoint",lang:"ur"},
        {rss:googleRss("سندھ کراچی site:urdupoint.com OR site:jang.com.pk OR site:express.pk","ur"),category:"SINDH",source:"سندھ نیوز",lang:"ur"},
        {rss:"https://www.urdupoint.com/rss/urdupoint-business.rss",category:"BUSINESS",source:"UrduPoint",lang:"ur"},
        {rss:"https://www.urdupoint.com/rss/urdupoint-sports.rss",category:"SPORTS",source:"UrduPoint",lang:"ur"},
        {rss:googleRss("پاکستان ٹیکنالوجی site:urdupoint.com OR site:jang.com.pk OR site:express.pk","ur"),category:"TECH",source:"ٹیکنالوجی",lang:"ur"},
        {rss:"https://www.urdupoint.com/rss/urdupoint-showbiz.rss",category:"ENTERTAINMENT",source:"UrduPoint",lang:"ur"},
        {rss:"https://www.urdupoint.com/rss/urdupoint-int.rss",category:"WORLD",source:"UrduPoint",lang:"ur"},
        {rss:googleRss("پاکستان site:jang.com.pk OR site:express.pk","ur"),category:"PAKISTAN",source:"پاکستان نیوز",lang:"ur"}
      ];
    }
    return [
      {rss:googleRss("Pakistan","en"),category:"PAKISTAN",source:"Pakistan News",lang:"en"},
      {rss:"https://tribune.com.pk/feed/pakistan",category:"PAKISTAN",source:"Express Tribune",lang:"en"},
      {rss:googleRss("Sindh Karachi Hyderabad Sukkur","en"),category:"SINDH",source:"Sindh News",lang:"en"},
      {rss:googleRss("Pakistan business economy rupee dollar","en"),category:"BUSINESS",source:"Business",lang:"en"},
      {rss:googleRss("Pakistan cricket sports","en"),category:"SPORTS",source:"Sports",lang:"en"},
      {rss:googleRss("Pakistan technology mobile internet","en"),category:"TECH",source:"Technology",lang:"en"},
      {rss:googleRss("Pakistan entertainment film drama","en"),category:"ENTERTAINMENT",source:"Entertainment",lang:"en"},
      {rss:googleRss("world news","en"),category:"WORLD",source:"World News",lang:"en"}
    ];
  }

  async function fetchJson(url, timeoutMs=12000) {
    const c = new AbortController();
    const tm = setTimeout(() => c.abort(), timeoutMs);
    try {
      const r = await fetch(url, {cache:"no-store",signal:c.signal});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(tm); }
  }

  function mapJsonItem(a, feed) {
    const p = splitTitle(a.title, feed.source);
    const html = a.content || a.description || "";
    return {
      title:p.title,
      url:a.link || a.url || "",
      date:a.pubDate || "",
      source:p.source || feed.source,
      image:safeUrl(a.thumbnail || a.enclosure?.link || imageFromHtml(html)),
      description:plainText(html).slice(0,260),
      category:feed.category
    };
  }

  async function rss2json(feed) {
    const endpoint = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(feed.rss);
    const data = await fetchJson(endpoint, 12000);
    if (data?.status && data.status !== "ok") throw new Error(data.message || "RSS error");
    return (Array.isArray(data.items) ? data.items : []).map(a => mapJsonItem(a, feed));
  }

  async function allOrigins(feed) {
    const c = new AbortController();
    const tm = setTimeout(() => c.abort(), 12000);
    try {
      const r = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(feed.rss), {cache:"no-store",signal:c.signal});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const xml = await r.text();
      const doc = new DOMParser().parseFromString(xml,"text/xml");
      return [...doc.querySelectorAll("item")].map(item => {
        const p = splitTitle(item.querySelector("title")?.textContent || "", feed.source);
        const desc = item.querySelector("description")?.textContent || "";
        const img = item.querySelector("media\\:content, content")?.getAttribute("url") || item.querySelector("enclosure")?.getAttribute("url") || imageFromHtml(desc);
        return {
          title:p.title,
          url:item.querySelector("link")?.textContent || "",
          date:item.querySelector("pubDate")?.textContent || "",
          source:p.source || feed.source,
          image:safeUrl(img),
          description:plainText(desc).slice(0,260),
          category:feed.category
        };
      });
    } finally { clearTimeout(tm); }
  }

  function usableForFeed(items, feed) {
    return (Array.isArray(items) ? items : []).filter(item => {
      if (!item?.title) return false;
      return feed.lang === "ur" ? hasUrdu(item.title) : !hasUrdu(item.title);
    });
  }

  async function loadOneFeed(feed) {
    let primary = [];
    try { primary = usableForFeed(await rss2json(feed), feed); } catch (error) { console.warn("News primary feed failed", feed.category, error); }
    if (primary.length) return primary;

    try {
      const fallback = usableForFeed(await allOrigins(feed), feed);
      if (fallback.length) return fallback;
    } catch (error) {
      console.warn("News fallback feed failed", feed.category, error);
    }
    return [];
  }

  async function gather() {
    const results = await Promise.all(feeds(language).map(loadOneFeed));
    return results.flat();
  }

  window.loadNews = async function() {
    if (!ensureRoot()) return;
    const list = $("newsList");
    if (!list) return;
    const id = ++requestNo;
    const t = TEXT[language];
    list.innerHTML = `<div class="nx-news-loading" ${language === "ur" ? 'dir="rtl"' : ""}>${esc(t.loading)}</div>`;
    try {
      const items = await gather();
      if (id !== requestNo) return;
      if (!items.length) throw new Error("No stories");
      render(items, true);
    } catch (error) {
      console.warn("NexusNova News V7", error);
      if (id !== requestNo) return;
      currentItems = [];
      updateShell();
      list.innerHTML = `<div class="nx-news-empty" ${language === "ur" ? 'dir="rtl"' : ""}>${esc(t.offline)}</div>`;
    }
  };

  const boot = () => {
    if (!ensureRoot()) { setTimeout(boot,250); return; }
    window.loadNews();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(boot,80), {once:true});
  else setTimeout(boot,80);
})();