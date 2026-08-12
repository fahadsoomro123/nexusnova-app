/* NexusNova ULTIMATE FEATURE UPGRADE
   Safe additive layer:
   - fixes AI initialization/replies and real wallet-balance answers
   - robust voice input/output
   - stabilizes visible on-chain wallet balances after UI re-renders
   - replaces the fragile local news loader with multi-source fallback
   - adds camera capture for AI image analysis
   - keeps mining/auth/tasks/chat/location/family/emergency logic intact
*/
(() => {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0",
    authDomain: "nexusnova-6ade2.firebaseapp.com",
    projectId: "nexusnova-6ade2",
    storageBucket: "nexusnova-6ade2.firebasestorage.app",
    messagingSenderId: "49791194817",
    appId: "1:49791194817:web:07f28326e0f15979536640",
    measurementId: "G-YLPFKWSS12"
  };

  const SETTINGS_KEY = "nexusnova_settings";
  const getSettings = () => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); }
    catch { return {}; }
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const setAIStatus = (text, ok = true) => {
    const a = document.getElementById("aiConnectionText");
    const b = document.getElementById("aiStatus");
    if (a) a.textContent = text;
    if (b) {
      b.textContent = text;
      b.style.color = ok ? "var(--success,#22c55e)" : "var(--danger,#ef4444)";
    }
  };

  const addAIMessage = (text, type = "ai") => {
    const box = document.getElementById("aiBox");
    if (!box) return;
    const wrap = document.createElement("div");
    wrap.className = "ai-message" + (type === "user" ? " user" : "");
    const label = document.createElement("div");
    label.className = "ai-label";
    label.textContent = type === "user" ? "You" : "NexusNova AI";
    const bubble = document.createElement("div");
    bubble.className = "ai-bubble";
    bubble.textContent = String(text || "");
    wrap.append(label, bubble);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  };

  const cleanSpeechText = text => String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  function speak(text) {
    const settings = getSettings();
    if (settings.aiVoice === false) return;
    if (!("speechSynthesis" in window)) return;

    const clean = cleanSpeechText(text);
    if (!clean) return;

    const synth = window.speechSynthesis;
    synth.cancel();

    const language = settings.aiLanguage || "English";
    const lang = language === "Urdu" ? "ur-PK" :
                 language === "Roman Urdu" ? "en-PK" : "en-US";

    let voices = synth.getVoices() || [];
    const choose = () => {
      voices = synth.getVoices() || voices;
      const exact = voices.find(v => String(v.lang).toLowerCase() === lang.toLowerCase());
      if (exact) return exact;

      const preferred = voices.find(v =>
        /natural|online|neural|microsoft|google/i.test(v.name || "") &&
        (language === "Urdu"
          ? /ur|pk|urdu/i.test(`${v.lang} ${v.name}`)
          : /^en/i.test(v.lang || ""))
      );
      if (preferred) return preferred;

      return voices.find(v =>
        language === "Urdu"
          ? /ur|pk|urdu/i.test(`${v.lang} ${v.name}`)
          : /^en/i.test(v.lang || "")
      ) || voices[0] || null;
    };

    const run = () => {
      const u = new SpeechSynthesisUtterance(clean);
      const voice = choose();
      u.lang = lang;
      if (voice) u.voice = voice;
      u.rate = language === "Urdu" ? 0.90 : 0.94;
      u.pitch = 0.98;
      u.volume = 1;

      const status = document.getElementById("aiVoiceStatus");
      u.onstart = () => { if (status) status.textContent = "🔊 Speaking..."; };
      u.onend = () => { if (status) status.textContent = "Voice ready"; };
      u.onerror = () => { if (status) status.textContent = "Voice ready"; };
      synth.speak(u);
    };

    if (voices.length) setTimeout(run, 50);
    else {
      const once = () => {
        synth.removeEventListener("voiceschanged", once);
        run();
      };
      synth.addEventListener("voiceschanged", once);
      setTimeout(run, 900);
    }
  }

  /* ---------------- AI ---------------- */

  let model = null;
  let chat = null;
  let aiImageFile = null;
  let aiBusy = false;

  async function initAI() {
    try {
      const { initializeApp } =
        await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js");
      const { getAI, getGenerativeModel, GoogleAIBackend } =
        await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js");

      const app = initializeApp(FIREBASE_CONFIG, "nexusnova-ai-upgrade");
      const ai = getAI(app, { backend: new GoogleAIBackend() });

      model = getGenerativeModel(ai, {
        model: "gemini-3.6-flash",
        systemInstruction: {
          parts: [{
            text:
              "You are NexusNova AI, a friendly built-in assistant. " +
              "Reply naturally and briefly unless detail is requested. " +
              "Match the user's language. For Roman Urdu, answer in natural Roman Urdu. " +
              "You have read-only NexusNova context supplied in each request. " +
              "Never invent wallet balances, transactions, deposit addresses, mining earnings, prices or personal data. " +
              "When asked for an external wallet balance, use only supplied on-chain values. For NVX, never present an active-mining projection as a settled server balance. " +
              "Never ask for or expose private keys, seed phrases, passwords or secret credentials."
          }]
        },
        generationConfig: {
          temperature: 0.65,
          maxOutputTokens: 900
        }
      });

      setAIStatus("Gemini 3.6 Flash connected", true);
      return true;
    } catch (error) {
      console.error("NexusNova AI upgrade initialization:", error);
      setAIStatus("AI setup unavailable — check Firebase AI Logic/App Check", false);
      return false;
    }
  }

  function walletContext() {
    const cache = window.__nexusOnchainVisibleBalances || {};
    const address = window.nexusConnectedAddress ||
      window.ethereum?.selectedAddress || "";

    const entries = Object.entries(cache)
      .filter(([, v]) => Number.isFinite(Number(v)))
      .map(([k, v]) => `${k}=${Number(v).toLocaleString(undefined,{maximumFractionDigits:8})}`);

    const total = document.getElementById("walletTotalUsd")?.textContent?.trim() || "$ 0.00";
    const nvx = document.getElementById("balance")?.textContent?.trim() || "0";

    return [
      `External wallet: ${address ? `${address.slice(0,6)}...${address.slice(-4)}` : "not connected"}`,
      `Network: ${window.__nexusOnchainNetwork || "unknown"}`,
      `Real on-chain balances: ${entries.length ? entries.join(", ") : "not read yet"}`,
      `Wallet portfolio USD: ${total}`,
      `NexusNova NVX balance: ${nvx} NVX`
    ].join("\n");
  }

  function isBalanceQuestion(text) {
    return /(balance|amount|kitna|kitne|mere|mera|my|how much|show|dikha|wallet)/i.test(text) &&
           /(balance|amount|kitna|kitne|mere|mera|my|how much|show|dikha|wallet|eth|ethereum|usdt|usdc|bnb|matic|polygon|nvx|token)/i.test(text);
  }

  function deterministicBalance(text) {
    const cache = window.__nexusOnchainVisibleBalances || {};
    const address = window.nexusConnectedAddress || window.ethereum?.selectedAddress || "";
    const wanted = String(text).toLowerCase();

    if (/(nvx|nexusnova token)/i.test(text) && !/(wallet|eth|ethereum|usdt|usdc|bnb|matic|polygon)/i.test(text)) {
      const nvx = Number((document.getElementById("balance")?.textContent || "").replace(/,/g,""));
      if (Number.isFinite(nvx)) return `Aapka current NexusNova balance ${nvx.toFixed(4)} NVX hai.`;
    }

    if (!address) {
      return "Bhai, Rabby/MetaMask wallet abhi connected nahi hai. Wallet → Connect Wallet karo, phir main real on-chain balance bata dunga.";
    }

    const requested = ["ETH","BNB","MATIC","USDT","USDC"].filter(s => wanted.includes(s.toLowerCase()));
    const available = Object.entries(cache)
      .filter(([,v]) => Number.isFinite(Number(v)))
      .map(([s,v]) => [s, Number(v)]);

    if (!available.length) {
      return "Wallet connected hai, lekin real on-chain balance abhi read nahi hua. Wallet ko unlock rakho aur Refresh dabao; main fake balance nahi bataunga.";
    }

    const rows = requested.length
      ? available.filter(([s]) => requested.includes(s))
      : available;

    if (!rows.length) {
      return "Is connected network par requested asset ka real balance read nahi hua.";
    }

    const lines = rows.map(([s,v]) => `${s}: ${v.toLocaleString(undefined,{maximumFractionDigits:8})}`);
    return `Connected wallet ${address.slice(0,6)}...${address.slice(-4)}\n` +
           `Network: ${window.__nexusOnchainNetwork || "EVM"}\n` +
           lines.join("\n");
  }

  async function filePart(file) {
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = () => reject(new Error("Image could not be read."));
      r.readAsDataURL(file);
    });
    return { inlineData: { data, mimeType: file.type } };
  }

  window.handleAIImage = function(input) {
    const file = input?.files?.[0];
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type)) {
      alert("Please choose PNG, JPG or WebP.");
      input.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Please choose an image smaller than 10 MB.");
      input.value = "";
      return;
    }

    aiImageFile = file;
    const preview = document.getElementById("aiImagePreview");
    const img = document.getElementById("aiPreviewImg");
    const name = document.getElementById("aiImageName");
    if (preview && img && name) {
      if (img.src?.startsWith("blob:")) URL.revokeObjectURL(img.src);
      img.src = URL.createObjectURL(file);
      name.textContent = file.name;
      preview.style.display = "flex";
    }
    const status = document.getElementById("aiVoiceStatus");
    if (status) status.textContent = "📷 Image ready — ask AI about it.";
  };

  window.clearAIImage = function() {
    aiImageFile = null;
    const input = document.getElementById("aiImageInput");
    const img = document.getElementById("aiPreviewImg");
    if (input) input.value = "";
    if (img?.src?.startsWith("blob:")) URL.revokeObjectURL(img.src);
    if (img) img.removeAttribute("src");
    const preview = document.getElementById("aiImagePreview");
    if (preview) preview.style.display = "none";
  };

  window.sendAIMessage = async function() {
    const input = document.getElementById("aiInput");
    const button = document.getElementById("aiSendBtn");
    if (!input || !button || aiBusy) return;

    const text = input.value.trim();
    if (!text && !aiImageFile) return;

    aiBusy = true;
    button.disabled = true;
    button.textContent = "...";

    if (text) addAIMessage(text, "user");

    const image = aiImageFile;
    input.value = "";

    try {
      if (!model) {
        const ok = await initAI();
        if (!ok) throw new Error("AI initialization failed");
      }

      if (text && isBalanceQuestion(text) && !image) {
        const reply = deterministicBalance(text);
        addAIMessage(reply, "ai");
        speak(reply);
        return;
      }

      if (!chat) chat = model.startChat();

      const context =
        "NexusNova live context (read-only):\n" + walletContext() +
        "\n\nUser request:\n" + (text || "Analyze the attached image.");

      const content = image
        ? [context, await filePart(image)]
        : context;

      let result;
      try {
        result = await chat.sendMessage(content);
      } catch (firstError) {
        console.warn("NexusNova AI first request failed; retrying:", firstError);
        chat = model.startChat();
        result = await chat.sendMessage(content);
      }

      const reply = String(result?.response?.text?.() || "").trim() ||
        "Sorry bhai, AI ne is waqt empty response diya.";

      addAIMessage(reply, "ai");
      speak(reply);
      window.clearAIImage?.();
      setAIStatus("Gemini 3.6 Flash connected", true);
    } catch (error) {
      console.error("NexusNova AI request:", error);
      const raw = String(error?.message || error || "");
      const msg = /app.?check|403|permission|forbidden/i.test(raw)
        ? "AI request blocked by Firebase App Check. Firebase Console → App Check mein is web app ko configure/safelist karo."
        : "AI service temporarily unavailable. Existing wallet/app data ko change nahi kiya gaya.";
      addAIMessage(msg, "ai");
      setAIStatus("AI request failed", false);
    } finally {
      aiBusy = false;
      button.disabled = false;
      button.textContent = "Ask";
    }
  };

  /* Voice input: transcript -> optional auto-send, plus reliable output. */
  let recognition = null;
  let listening = false;

  window.toggleAIVoice = function() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById("aiVoiceBtn");
    const status = document.getElementById("aiVoiceStatus");

    if (!SR) {
      if (status) status.textContent = "Voice input needs Chrome/Edge speech recognition.";
      return;
    }

    if (listening && recognition) {
      recognition.stop();
      return;
    }

    recognition = new SR();
    const language = getSettings().aiLanguage || "English";
    recognition.lang = language === "Urdu" ? "ur-PK" :
      language === "Roman Urdu" ? "en-US" : "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalText = "";

    recognition.onstart = () => {
      listening = true;
      btn?.classList.add("active");
      if (status) status.textContent = "🎙️ Listening... speak now.";
    };

    recognition.onresult = event => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      const input = document.getElementById("aiInput");
      if (input) input.value = (finalText || text).trim();
    };

    recognition.onerror = event => {
      console.warn("NexusNova voice input:", event.error);
      if (status) status.textContent =
        event.error === "not-allowed" ? "🎙️ Microphone permission denied." : "Voice input stopped.";
    };

    recognition.onend = () => {
      listening = false;
      btn?.classList.remove("active");
      if (status && !finalText) status.textContent = "Voice ready";
      if (finalText.trim()) {
        const input = document.getElementById("aiInput");
        if (input) input.value = finalText.trim();
        setTimeout(() => window.sendAIMessage(), 250);
      }
    };

    try { recognition.start(); }
    catch (error) {
      console.warn("NexusNova recognition start:", error);
      listening = false;
    }
  };

  /* ---------------- Camera ---------------- */

  window.openNexusCamera = async function() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Camera is not supported in this browser.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "nexusCameraOverlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.96);display:flex;align-items:center;justify-content:center;padding:18px;";
    overlay.innerHTML = `
      <div style="width:min(720px,100%);background:#0f172a;border:1px solid #334155;border-radius:18px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <strong style="color:#fff">📷 NexusNova Camera</strong>
          <button id="nxCamClose" class="action-btn">Close</button>
        </div>
        <video id="nxCamVideo" autoplay playsinline style="width:100%;border-radius:12px;background:#000;max-height:65vh;object-fit:contain"></video>
        <button id="nxCamCapture" class="action-btn primary" style="width:100%;margin-top:10px">📸 Capture for AI</button>
        <canvas id="nxCamCanvas" style="display:none"></canvas>
      </div>`;
    document.body.appendChild(overlay);

    let stream;
    const close = () => {
      stream?.getTracks().forEach(t => t.stop());
      overlay.remove();
    };
    document.getElementById("nxCamClose")?.addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      const video = document.getElementById("nxCamVideo");
      video.srcObject = stream;

      document.getElementById("nxCamCapture")?.addEventListener("click", () => {
        const canvas = document.getElementById("nxCamCanvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) return;
          const file = new File([blob], `nexusnova-camera-${Date.now()}.jpg`, { type: "image/jpeg" });
          const input = document.getElementById("aiImageInput");
          if (input && window.DataTransfer) {
            try {
              const dt = new DataTransfer();
              dt.items.add(file);
              input.files = dt.files;
              window.handleAIImage(input);
            } catch (_) {
              window.handleAIImage({ files: [file] });
            }
          } else {
            window.handleAIImage({ files: [file] });
          }
          close();
        }, "image/jpeg", 0.92);
      });
    } catch (error) {
      close();
      alert("Camera permission was not granted: " + (error?.message || error));
    }
  };

  function addCameraButton() {
    const compose = document.querySelector(".ai-compose");
    if (!compose || document.getElementById("nexusCameraBtn")) return;
    const button = document.createElement("button");
    button.id = "nexusCameraBtn";
    button.type = "button";
    button.className = "ai-icon-btn";
    button.title = "Open camera";
    button.textContent = "📸";
    button.addEventListener("click", () => window.openNexusCamera());
    const send = document.getElementById("aiSendBtn");
    compose.insertBefore(button, send || null);

    const imageInput = document.getElementById("aiImageInput");
    if (imageInput) imageInput.setAttribute("capture", "environment");
  }

  /* ---------------- Wallet stability ---------------- */

  const walletSymbols = ["ETH","BNB","MATIC","USDT","USDC"];

  function findWalletRow(symbol) {
    const rows = [...document.querySelectorAll("#walletAssetList .coin-row")];
    return rows.find(row => {
      const text = row.querySelector(".coin-symbol")?.textContent || row.textContent || "";
      return new RegExp(`\\b${symbol}\\b`, "i").test(text);
    });
  }

  function repaintWalletFromCache() {
    const cache = window.__nexusOnchainVisibleBalances || {};
    const connected = Boolean(window.nexusConnectedAddress || window.ethereum?.selectedAddress);
    if (!connected) return;

    walletSymbols.forEach(symbol => {
      if (!Object.prototype.hasOwnProperty.call(cache, symbol)) return;
      const row = findWalletRow(symbol);
      const right = row?.lastElementChild;
      if (!right) return;

      const el =
        right.querySelector(".wallet-live-balance") ||
        right.querySelector(".nexus-onchain-primary");
      if (!el) return; // do not touch firstElementChild (that is the price)
      const amount = Number(cache[symbol]);
      el.classList.add("wallet-live-balance");
      el.textContent = `${amount.toLocaleString(undefined,{maximumFractionDigits:8})} ${symbol}`;
    });
  }

  function startWalletStability() {
    const list = document.getElementById("walletAssetList");
    if (!list) return;

    const observer = new MutationObserver(() => {
      clearTimeout(window.__nexusWalletPaintTimer);
      window.__nexusWalletPaintTimer = setTimeout(repaintWalletFromCache, 20);
    });
    observer.observe(list, { childList: true, subtree: true });

    [250,700,1500,3000,5000,10000].forEach(ms =>
      setTimeout(() => {
        repaintWalletFromCache();
        window.refreshNexusOnchainWallet?.();
      }, ms)
    );

    if (window.ethereum?.on) {
      window.ethereum.on("accountsChanged", () => setTimeout(() => window.refreshNexusOnchainWallet?.(), 400));
      window.ethereum.on("chainChanged", () => setTimeout(() => window.refreshNexusOnchainWallet?.(), 600));
    }
  }

  /* ---------------- News ---------------- */

  let newsRequest = 0;

  async function fetchJSON(url, timeout = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function sourceGDELT() {
    const data = await fetchJSON(
      "https://api.gdeltproject.org/api/v2/doc/doc?query=world&mode=artlist&format=json&maxrecords=20&timespan=24h"
    );
    return (data.articles || []).map(a => ({
      title: a.title, url: a.url, source: a.domain || "World News", date: a.seendate
    }));
  }

  async function sourceRSS(rss, source) {
    const data = await fetchJSON(
      "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rss)
    );
    return (data.items || []).map(a => ({
      title: a.title, url: a.link, source, date: a.pubDate
    }));
  }

  async function sourceAllOrigins(rss, source) {
    const res = await fetch(
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(rss),
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return [...doc.querySelectorAll("item")].map(item => ({
      title: item.querySelector("title")?.textContent || "",
      url: item.querySelector("link")?.textContent || "",
      source,
      date: item.querySelector("pubDate")?.textContent || ""
    }));
  }

  async function enhancedNews() {
    const list = document.getElementById("newsList");
    if (!list) return;

    const id = ++newsRequest;
    list.innerHTML = '<div class="status">Loading live world news...</div>';
    const status = document.getElementById("newsStatus");
    if (status) status.textContent = "Connecting...";

    const sources = [
      () => sourceGDELT(),
      () => sourceRSS("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC World"),
      () => sourceRSS("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", "Google News"),
      () => sourceAllOrigins("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC World")
    ];

    for (const load of sources) {
      try {
        const items = await load();
        if (id !== newsRequest) return;
        const clean = items.filter(x => x?.title).slice(0, 12);
        if (!clean.length) throw new Error("No articles");
        list.innerHTML = clean.map(item => `
          <div class="news-item">
            <div class="news-title">${esc(item.title)}</div>
            <div class="news-meta">${esc(item.source || "World News")}${item.date ? " • " + esc(item.date) : ""}</div>
            ${item.url ? `<button class="action-btn nexus-news-read" data-url="${esc(item.url)}" style="margin-top:7px;padding:7px 10px">Read News</button>` : ""}
          </div>`).join("");

        list.querySelectorAll(".nexus-news-read").forEach(btn => {
          btn.addEventListener("click", () => {
            try {
              const u = new URL(btn.dataset.url);
              if (u.protocol === "http:" || u.protocol === "https:") {
                window.open(u.href, "_blank", "noopener,noreferrer");
              }
            } catch (_) {}
          });
        });

        if (status) status.textContent = `Connected • ${clean.length} stories`;
        return;
      } catch (error) {
        console.warn("NexusNova news source failed:", error);
      }
    }

    if (id === newsRequest) {
      list.innerHTML = '<div class="status">Live news is temporarily unavailable. Tap Refresh to retry.</div>';
      if (status) status.textContent = "Offline";
    }
  }

  window.nexusLoadNewsEnhanced = enhancedNews;
  window.loadNews = enhancedNews;

  /* ---------------- Boot ---------------- */

  async function boot() {
    addCameraButton();
    startWalletStability();

    if (document.getElementById("newsList")) {
      setTimeout(enhancedNews, 900);
    }

    // AI initialization is lazy; this avoids slowing dashboard startup.
    const aiConnection = document.getElementById("aiConnectionText");
    if (aiConnection) aiConnection.textContent = "AI ready — tap Ask to connect";

    // If a wallet is already authorized, refresh after all renderers settle.
    [500, 1500, 3500].forEach(ms =>
      setTimeout(() => window.refreshNexusOnchainWallet?.(), ms)
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
