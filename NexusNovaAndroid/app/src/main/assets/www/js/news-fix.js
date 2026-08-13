/* NexusNova NEWS FIX V5
   Clean bilingual premium newsroom.
   Urdu and English use language-specific feeds; categories are assigned by feed
   instead of guessing from Latin-only text, so Pakistan/Sindh/World filters stay reliable.
*/
(() => {
  "use strict";
  if (window.__nxPremiumNewsV5) return;
  window.__nxPremiumNewsV5 = true;
  window.__nxPremiumNewsV4 = true;
  window.__nxPremiumNewsV3 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  let requestNo = 0;
  let currentItems = [];
  let activeCategory = "ALL";
  let language = localStorage.getItem("nx_news_language") === "en" ? "en" : "ur";

  const TEXT = {
    en: {
      heading:"Pakistan Live News Desk",
      sub:"Pakistan • Sindh • business • sports • technology • entertainment • world",
      breaking:"BREAKING NEWS",
      live:"LIVE",
      language:"News language",
      loading:"Connecting to English news sources…",
      offline:"Live news is temporarily unavailable. Tap Refresh to retry.",
      read:"READ FULL STORY",
      tap:"Tap to read full story",
      status:"English News Desk",
      empty:"No stories are available in this section right now.",
      categories:{ALL:"All News",PAKISTAN:"Pakistan",SINDH:"Sindh",BUSINESS:"Business",SPORTS:"Sports",TECH:"Tech",ENTERTAINMENT:"Entertainment",WORLD:"World"}
    },
    ur: {
      heading:"پاکستان لائیو نیوز ڈیسک",
      sub:"پاکستان • سندھ • کاروبار • کھیل • ٹیکنالوجی • شوبز • دنیا",
      breaking:"بریکنگ نیوز",
      live:"لائیو",
      language:"خبروں کی زبان",
      loading:"اردو نیوز ذرائع سے رابطہ ہو رہا ہے…",
      offline:"اردو خبریں عارضی طور پر دستیاب نہیں۔ Refresh کر کے دوبارہ کوشش کریں۔",
      read:"مکمل خبر پڑھیں",
      tap:"مکمل خبر پڑھنے کے لیے کھولیں",
      status:"اردو نیوز ڈیسک",
      empty:"اس حصے میں اس وقت کوئی خبر دستیاب نہیں۔",
      categories:{ALL:"تمام خبریں",PAKISTAN:"پاکستان",SINDH:"سندھ",BUSINESS:"کاروبار",SPORTS:"کھیل",TECH:"ٹیکنالوجی",ENTERTAINMENT:"شوبز",WORLD:"دنیا"}
    }
  };

  const safeHttpUrl = value => {
    try {
      const u = new URL(String(value || ""));
      return (u.protocol === "https:" || u.protocol === "http:") ? u.href : "";
    } catch (_) { return ""; }
  };

  const containsUrdu = text => /[\u0600-\u06FF]/.test(String(text || ""));

  function plainText(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return String(doc.body?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function imageFromHtml(html) {
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      return safeHttpUrl(doc.querySelector("img")?.getAttribute("src") || "");
    } catch (_) { return ""; }
  }

  function splitGoogleTitle(title, fallbackSource) {
    const text = String(title || "").trim();
    const parts = text.split(/\s+-\s+/);
    if (parts.length > 1) {
      const source = parts.pop().trim();
      return {title:parts.join(" - ").trim(), source:source || fallbackSource};
    }
    return {title:text, source:fallbackSource};
  }

  function normalizeDate(value) {
    const d = new Date(value || "");
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function timeAgo(value) {
    const d = normalizeDate(value);
    if (!d) return language === "ur" ? "تازہ خبر" : "Live update";
    const diff = Math.max(0, Date.now() - d.getTime());
    const mins = Math.floor(diff / 60000);
    if (language === "ur") {
      if (mins < 1) return "ابھی";
      if (mins < 60) return `${mins} منٹ پہلے`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} گھنٹے پہلے`;
      return `${Math.floor(hours / 24)} دن پہلے`;
    }
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function isBreaking(item, index) {
    const d = normalizeDate(item.date);
    if (d && Date.now() - d.getTime() <= 6 * 3600e3) return true;
    return index < 4;
  }

  function fallbackInitials(source) {
    const text = String(source || "NN").trim();
    if (containsUrdu(text)) return "خبر";
    return text.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase() || "NN";
  }

  function articleMedia(item, cls) {
    const img = safeHttpUrl(item.image || "");
    const fallbackClass = cls === "nx-feature-media" ? "nx-feature-fallback" : "nx-news-image-fallback";
    const fallback = esc(fallbackInitials(item.source));
    if (img) {
      return `<img class="${cls}" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="${fallbackClass}" style="display:none">${fallback}</div>`;
    }
    return `<div class="${fallbackClass}">${fallback}</div>`;
  }

  function openArticle(item) {
    const url = safeHttpUrl(item?.url);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function setStatus(text) {
    const el = $("newsStatus");
    if (el) el.textContent = text;
  }

  function injectStyle() {
    if ($("nxPremiumNewsStyleV5")) return;
    document.getElementById("nxPremiumNewsStyle")?.remove();
    const style = document.createElement("style");
    style.id = "nxPremiumNewsStyleV5";
    style.textContent = `
      #tab-news{--nxNewsBlue:#38bdf8;--nxNewsRed:#ff3158;--nxNewsGold:#fbbf24;--nxNewsGreen:#22c55e;--nxNewsPurple:#a78bfa}
      #tab-news>.card{background:linear-gradient(180deg,rgba(8,16,30,.97),rgba(7,12,22,.99));border:1px solid rgba(56,189,248,.2);box-shadow:0 24px 60px rgba(0,0,0,.36);overflow:hidden}
      #tab-news .market-header.nx-news-legacy-hidden>div{display:none!important}
      #tab-news .market-header.nx-news-legacy-hidden{justify-content:flex-end!important;margin:0 0 8px!important}
      .nx-news-masthead{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin:4px 0 14px}
      .nx-news-kicker{font-size:10px;letter-spacing:.18em;color:#38bdf8;font-weight:950}
      .nx-news-heading{font-size:23px;line-height:1.15;font-weight:950;margin-top:4px;background:linear-gradient(90deg,#fff,#7dd3fc,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent}
      .nx-news-sub{font-size:11px;color:#94a3b8;margin-top:7px;line-height:1.55}
      .nx-news-live{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(239,68,68,.35);background:rgba(127,29,29,.22);border-radius:999px;color:#fecaca;font-size:10px;font-weight:950;white-space:nowrap}
      .nx-news-live i{width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 14px #ef4444;animation:nxNewsPulse 1.15s infinite}
      @keyframes nxNewsPulse{50%{opacity:.35;transform:scale(.72)}}
      .nx-breaking-strip{display:grid;grid-template-columns:auto 1fr;border-radius:11px;overflow:hidden;border:1px solid rgba(239,68,68,.35);background:#090f1a;margin-bottom:10px;min-height:42px}
      .nx-breaking-label{display:flex;align-items:center;padding:0 13px;background:linear-gradient(135deg,#ef233c,#b90432);font-size:10px;font-weight:950;color:#fff;white-space:nowrap}
      .nx-breaking-window{overflow:hidden;display:flex;align-items:center}
      .nx-breaking-track{display:inline-flex;align-items:center;white-space:nowrap;min-width:max-content;animation:nxNewsTicker 48s linear infinite}
      .nx-breaking-track span{font-size:11px;color:#e2e8f0;padding:0 28px 0 12px}
      .nx-breaking-track b{color:#38bdf8;margin-right:7px}
      @keyframes nxNewsTicker{from{transform:translateX(8%)}to{transform:translateX(-100%)}}
      .nx-news-language-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;padding:9px 10px;border:1px solid rgba(56,189,248,.16);background:rgba(8,15,28,.82);border-radius:12px}
      .nx-news-language-label{font-size:10px;color:#94a3b8;font-weight:850}
      .nx-news-language-switch{display:flex;gap:6px}
      .nx-news-lang-btn,.nx-news-chip{border:1px solid rgba(148,163,184,.22);background:#111827;color:#cbd5e1;font-weight:900}
      .nx-news-lang-btn{border-radius:9px;padding:7px 12px;font-size:11px}
      .nx-news-lang-btn.active,.nx-news-chip.active{background:linear-gradient(135deg,#0ea5e9,#2563eb);border-color:transparent;color:#fff;box-shadow:0 8px 20px rgba(37,99,235,.23)}
      .nx-news-filters{display:flex;gap:7px;overflow:auto;padding:1px 0 12px;scrollbar-width:none}
      .nx-news-filters::-webkit-scrollbar{display:none}
      .nx-news-chip{border-radius:999px;padding:7px 11px;font-size:10px;white-space:nowrap}
      .nx-feature-story{position:relative;min-height:320px;border-radius:17px;overflow:hidden;border:1px solid rgba(255,255,255,.1);margin-bottom:14px;background:#0f172a;cursor:pointer;isolation:isolate}
      .nx-feature-media,.nx-news-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0b1220}
      .nx-feature-story:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(1,7,17,.05) 20%,rgba(2,8,20,.54) 55%,rgba(2,8,20,.98) 100%);z-index:1}
      .nx-feature-fallback,.nx-news-image-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 18% 22%,rgba(56,189,248,.24),transparent 33%),radial-gradient(circle at 82% 18%,rgba(167,139,250,.22),transparent 29%),linear-gradient(135deg,#07111f,#10192d);color:rgba(255,255,255,.18);font-size:54px;font-weight:950}
      .nx-feature-copy{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:23px}
      .nx-badge-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:9px}
      .nx-news-breaking{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#ef233c,#b90432);color:#fff;padding:5px 8px;border-radius:6px;font-size:9px;font-weight:950}
      .nx-news-category{display:inline-flex;padding:5px 8px;border-radius:6px;background:rgba(14,165,233,.17);border:1px solid rgba(56,189,248,.32);color:#7dd3fc;font-size:9px;font-weight:900}
      .nx-feature-title{font-size:22px;line-height:1.25;font-weight:950;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.48)}
      .nx-feature-meta,.nx-card-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:#cbd5e1;font-size:10px;margin-top:10px}
      .nx-source-dot{width:5px;height:5px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8}
      .nx-news-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .nx-news-card{position:relative;overflow:hidden;border:1px solid rgba(148,163,184,.14);border-radius:15px;background:linear-gradient(180deg,rgba(17,24,39,.96),rgba(8,14,25,.99));box-shadow:0 14px 32px rgba(0,0,0,.24);transition:.2s ease;cursor:pointer}
      .nx-news-card:hover{transform:translateY(-2px);border-color:rgba(56,189,248,.34);box-shadow:0 18px 42px rgba(0,0,0,.34)}
      .nx-news-media{position:relative;height:175px;overflow:hidden;background:#0b1220}
      .nx-news-media:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(5,10,20,.52))}
      .nx-news-card-body{padding:13px}
      .nx-news-card-title{font-size:14px;line-height:1.45;font-weight:900;color:#f8fafc;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .nx-news-snippet{font-size:11px;line-height:1.55;color:#94a3b8;margin-top:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .nx-news-read{display:flex;align-items:center;justify-content:space-between;margin-top:11px;padding-top:10px;border-top:1px solid rgba(148,163,184,.11);color:#38bdf8;font-size:10px;font-weight:950}
      .nx-news-card.cat-SINDH .nx-news-category{color:#86efac;border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.13)}
      .nx-news-card.cat-BUSINESS .nx-news-category{color:#fde68a;border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.12)}
      .nx-news-card.cat-SPORTS .nx-news-category{color:#f0abfc;border-color:rgba(217,70,239,.3);background:rgba(217,70,239,.11)}
      .nx-news-card.cat-TECH .nx-news-category{color:#a5b4fc;border-color:rgba(129,140,248,.35);background:rgba(129,140,248,.12)}
      .nx-news-card.cat-ENTERTAINMENT .nx-news-category{color:#f9a8d4;border-color:rgba(236,72,153,.32);background:rgba(236,72,153,.11)}
      .nx-news-card.cat-WORLD .nx-news-category{color:#67e8f9;border-color:rgba(34,211,238,.3);background:rgba(34,211,238,.1)}
      .nx-news-empty{padding:30px 15px;text-align:center;color:#94a3b8;border:1px dashed rgba(148,163,184,.2);border-radius:14px}
      #tab-news.nx-news-urdu .nx-news-heading,#tab-news.nx-news-urdu .nx-news-sub,#tab-news.nx-news-urdu .nx-feature-title,#tab-news.nx-news-urdu .nx-news-card-title,#tab-news.nx-news-urdu .nx-news-snippet{direction:rtl;text-align:right;font-family:"Noto Nastaliq Urdu","Noto Sans Arabic","Segoe UI",Arial,sans-serif}
      #tab-news.nx-news-urdu .nx-feature-meta,#tab-news.nx-news-urdu .nx-card-meta,#tab-news.nx-news-urdu .nx-news-read{direction:rtl}
      #tab-news.nx-news-urdu .nx-breaking-track{direction:rtl}
      @media(max-width:680px){.nx-news-grid{grid-template-columns:1fr}.nx-feature-story{min-height:285px}.nx-feature-title{font-size:19px}.nx-news-media{height:195px}.nx-news-masthead{align-items:flex-start}.nx-news-heading{font-size:21px}}
    `;
    document.head.appendChild(style);
  }

  function cleanLegacyHeaders(tab) {
    tab.querySelectorAll(".market-header").forEach(header => {
      const refresh = header.querySelector(".refresh-news");
      if (refresh) {
        header.classList.add("nx-news-legacy-hidden");
      } else {
        header.style.display = "none";
      }
    });
  }

  function installShell() {
    const tab = $("tab-news");
    const list = $("newsList");
    if (!tab || !list) return false;
    injectStyle();
    cleanLegacyHeaders(tab);

    let mast = $("nxNewsMasthead");
    if (!mast) {
      mast = document.createElement("div");
      mast.id = "nxNewsMasthead";
      mast.innerHTML = `
        <div class="nx-news-masthead">
          <div>
            <div class="nx-news-kicker">NEXUSNOVA NEWSROOM</div>
            <div class="nx-news-heading"></div>
            <div class="nx-news-sub"></div>
          </div>
          <div class="nx-news-live"><i></i></div>
        </div>
        <div class="nx-breaking-strip">
          <div class="nx-breaking-label"></div>
          <div class="nx-breaking-window"><div id="nxBreakingTrack" class="nx-breaking-track"></div></div>
        </div>
        <div id="nxNewsLanguageBar" class="nx-news-language-bar"></div>
        <div id="nxNewsFilters" class="nx-news-filters"></div>`;
      list.parentElement?.insertBefore(mast, list);
    }
    updateShell();
    return true;
  }

  function updateShell() {
    const tab = $("tab-news");
    const mast = $("nxNewsMasthead");
    const bar = $("nxNewsLanguageBar");
    const filters = $("nxNewsFilters");
    if (!tab || !mast || !bar || !filters) return;

    const t = TEXT[language];
    tab.classList.toggle("nx-news-urdu", language === "ur");
    mast.querySelector(".nx-news-heading").textContent = t.heading;
    mast.querySelector(".nx-news-sub").textContent = t.sub;
    mast.querySelector(".nx-breaking-label").textContent = t.breaking;
    mast.querySelector(".nx-news-live").innerHTML = `<i></i> ${t.live}`;

    bar.innerHTML = `
      <div class="nx-news-language-label">${esc(t.language)}</div>
      <div class="nx-news-language-switch">
        <button type="button" class="nx-news-lang-btn ${language === "ur" ? "active" : ""}" data-news-lang="ur">اردو</button>
        <button type="button" class="nx-news-lang-btn ${language === "en" ? "active" : ""}" data-news-lang="en">English</button>
      </div>`;

    bar.querySelectorAll("[data-news-lang]").forEach(button => {
      button.addEventListener("click", () => {
        const next = button.dataset.newsLang === "en" ? "en" : "ur";
        if (next === language) return;
        language = next;
        activeCategory = "ALL";
        localStorage.setItem("nx_news_language", language);
        updateShell();
        window.loadNews();
      });
    });

    filters.innerHTML = "";
    Object.entries(t.categories).forEach(([cat,label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nx-news-chip" + (cat === activeCategory ? " active" : "");
      button.dataset.newsCategory = cat;
      button.textContent = label;
      button.addEventListener("click", () => {
        activeCategory = cat;
        filters.querySelectorAll(".nx-news-chip").forEach(x => x.classList.toggle("active", x === button));
        render(currentItems);
      });
      filters.appendChild(button);
    });
  }

  function renderTicker(items) {
    const track = $("nxBreakingTrack");
    if (!track) return;
    const top = items.slice(0, 14);
    track.innerHTML = top.length
      ? top.map(item => `<span><b>${esc(item.source)}</b>${esc(item.title)}</span>`).join("")
      : `<span>${language === "ur" ? "تازہ خبریں لوڈ ہو رہی ہیں…" : "Loading latest headlines…"}</span>`;
  }

  function render(items) {
    installShell();
    const list = $("newsList");
    if (!list) return;

    const unique = [];
    const seen = new Set();
    for (const raw of items) {
      if (!raw?.title) continue;
      const key = String(raw.title).normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();
      if (!key || seen.has(key)) continue;
      if (language === "ur" && !containsUrdu(raw.title)) continue;
      if (language === "en" && containsUrdu(raw.title)) continue;
      seen.add(key);
      unique.push({...raw, category:raw.category || "PAKISTAN"});
      if (unique.length >= 56) break;
    }

    currentItems = unique;
    renderTicker(unique);
    const t = TEXT[language];
    const clean = activeCategory === "ALL" ? unique : unique.filter(item => item.category === activeCategory);

    if (!clean.length) {
      list.innerHTML = `<div class="nx-news-empty" ${language === "ur" ? 'dir="rtl"' : ""}>${esc(t.empty)}</div>`;
      setStatus(language === "ur" ? `${t.status} • ${unique.length} خبریں لوڈ ہوئیں` : `${t.status} • ${unique.length} stories loaded`);
      return;
    }

    const lead = clean[0];
    const rest = clean.slice(1, 25);
    const leadBreaking = isBreaking(lead,0);

    list.innerHTML = `
      <article class="nx-feature-story" data-news-index="0">
        ${articleMedia(lead,"nx-feature-media")}
        <div class="nx-feature-copy">
          <div class="nx-badge-row">${leadBreaking ? `<span class="nx-news-breaking">● ${esc(t.breaking)}</span>` : ""}<span class="nx-news-category">${esc(t.categories[lead.category] || lead.category)}</span></div>
          <div class="nx-feature-title">${esc(lead.title)}</div>
          <div class="nx-feature-meta"><span class="nx-source-dot"></span><b>${esc(lead.source)}</b><span>•</span><span>${esc(timeAgo(lead.date))}</span><span>• ${esc(t.tap)}</span></div>
        </div>
      </article>
      <div class="nx-news-grid">${rest.map((item,index) => {
        const breaking = isBreaking(item,index+1);
        return `<article class="nx-news-card cat-${esc(item.category)}" data-news-index="${index+1}">
          <div class="nx-news-media">${articleMedia(item,"nx-news-thumb")}</div>
          <div class="nx-news-card-body">
            <div class="nx-badge-row">${breaking ? `<span class="nx-news-breaking">● ${esc(t.breaking)}</span>` : ""}<span class="nx-news-category">${esc(t.categories[item.category] || item.category)}</span></div>
            <div class="nx-news-card-title">${esc(item.title)}</div>
            ${item.description ? `<div class="nx-news-snippet">${esc(item.description)}</div>` : ""}
            <div class="nx-card-meta"><span class="nx-source-dot"></span><b>${esc(item.source)}</b><span>•</span><span>${esc(timeAgo(item.date))}</span></div>
            <div class="nx-news-read"><span>${esc(t.read)}</span><span>→</span></div>
          </div>
        </article>`;
      }).join("")}</div>`;

    list.querySelectorAll("[data-news-index]").forEach(card => {
      card.addEventListener("click", () => openArticle(clean[Number(card.dataset.newsIndex) || 0]));
    });

    const sourceCount = new Set(unique.map(x => x.source).filter(Boolean)).size;
    setStatus(language === "ur"
      ? `${t.status} • ${unique.length} خبریں • ${sourceCount} ذرائع`
      : `${t.status} • ${unique.length} stories • ${sourceCount} sources`);
  }

  async function fetchJson(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url,{cache:"no-store",signal:controller.signal});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  async function rss2json(feed) {
    const endpoint = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(feed.rss);
    const data = await fetchJson(endpoint);
    if (data?.status && data.status !== "ok") throw new Error(data.message || "RSS service failed");
    return (Array.isArray(data.items) ? data.items : []).map(a => {
      const parsed = splitGoogleTitle(a.title, feed.source);
      const html = a.content || a.description || "";
      return {
        title:parsed.title,
        url:a.link || a.url || "",
        date:a.pubDate || "",
        source:parsed.source || feed.source,
        image:safeHttpUrl(a.thumbnail || a.enclosure?.link || imageFromHtml(html)),
        description:plainText(html).slice(0,260),
        category:feed.category
      };
    });
  }

  async function allOriginsRss(feed) {
    const target = "https://api.allorigins.win/raw?url=" + encodeURIComponent(feed.rss);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),12000);
    try {
      const res = await fetch(target,{cache:"no-store",signal:controller.signal});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml,"text/xml");
      return [...doc.querySelectorAll("item")].map(item => {
        const parsed = splitGoogleTitle(item.querySelector("title")?.textContent || "",feed.source);
        const descriptionHtml = item.querySelector("description")?.textContent || "";
        const media = item.querySelector("media\\:content,content")?.getAttribute("url")
          || item.querySelector("enclosure")?.getAttribute("url")
          || imageFromHtml(descriptionHtml);
        return {
          title:parsed.title,
          url:item.querySelector("link")?.textContent || "",
          date:item.querySelector("pubDate")?.textContent || "",
          source:parsed.source || feed.source,
          image:safeHttpUrl(media),
          description:plainText(descriptionHtml).slice(0,260),
          category:feed.category
        };
      });
    } finally { clearTimeout(timer); }
  }

  const googleFeed = (query, lang, category, source) => {
    const locale = lang === "ur" ? "hl=ur&gl=PK&ceid=PK:ur" : "hl=en-PK&gl=PK&ceid=PK:en";
    return {rss:`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`,category,source};
  };

  function feedsForLanguage(lang) {
    if (lang === "ur") {
      return [
        googleFeed("پاکستان", "ur", "PAKISTAN", "پاکستان نیوز"),
        googleFeed("سندھ کراچی حیدرآباد سکھر", "ur", "SINDH", "سندھ نیوز"),
        googleFeed("پاکستان کاروبار معیشت ڈالر سونا", "ur", "BUSINESS", "کاروبار"),
        googleFeed("پاکستان کرکٹ کھیل", "ur", "SPORTS", "کھیل"),
        googleFeed("پاکستان ٹیکنالوجی موبائل انٹرنیٹ", "ur", "TECH", "ٹیکنالوجی"),
        googleFeed("پاکستان شوبز فلم ڈرامہ", "ur", "ENTERTAINMENT", "شوبز"),
        googleFeed("عالمی خبریں دنیا", "ur", "WORLD", "عالمی خبریں")
      ];
    }
    return [
      googleFeed("Pakistan latest news", "en", "PAKISTAN", "Pakistan News"),
      googleFeed("Sindh Karachi Hyderabad Sukkur latest news", "en", "SINDH", "Sindh News"),
      googleFeed("Pakistan business economy rupee dollar gold", "en", "BUSINESS", "Business News"),
      googleFeed("Pakistan cricket sports", "en", "SPORTS", "Sports News"),
      googleFeed("Pakistan technology mobile internet AI", "en", "TECH", "Tech News"),
      googleFeed("Pakistan entertainment showbiz film drama", "en", "ENTERTAINMENT", "Entertainment"),
      googleFeed("world latest news", "en", "WORLD", "World News"),
      {rss:"https://tribune.com.pk/feed/pakistan",category:"PAKISTAN",source:"Express Tribune"}
    ];
  }

  async function gatherSources() {
    const feeds = feedsForLanguage(language);
    const primary = await Promise.allSettled(feeds.map(rss2json));
    const merged = primary.flatMap(result => result.status === "fulfilled" ? result.value : []);
    const failedFeeds = feeds.filter((_,index) => primary[index]?.status !== "fulfilled");

    if (failedFeeds.length) {
      const fallback = await Promise.allSettled(failedFeeds.map(allOriginsRss));
      merged.push(...fallback.flatMap(result => result.status === "fulfilled" ? result.value : []));
    }
    return merged;
  }

  window.loadNews = async function() {
    if (!installShell()) return;
    const list = $("newsList");
    if (!list) return;
    const id = ++requestNo;
    const t = TEXT[language];
    list.innerHTML = `<div class="status" ${language === "ur" ? 'dir="rtl"' : ""}>${esc(t.loading)}</div>`;
    setStatus(t.loading);

    try {
      const items = await gatherSources();
      if (id !== requestNo) return;
      if (!items.length) throw new Error("No stories returned");
      render(items);
    } catch (error) {
      console.warn("NexusNova News V5:",error);
      if (id !== requestNo) return;
      list.innerHTML = `<div class="nx-news-empty" ${language === "ur" ? 'dir="rtl"' : ""}>${esc(t.offline)}</div>`;
      setStatus(language === "ur" ? "اردو نیوز عارضی طور پر آف لائن" : "News desk temporarily offline");
    }
  };

  const boot = () => {
    if (!installShell()) return setTimeout(boot,250);
    window.loadNews();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",() => setTimeout(boot,80),{once:true});
  } else {
    setTimeout(boot,80);
  }
})();