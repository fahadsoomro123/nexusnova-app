/*
 * NexusNova Natural Voice Layer V1
 * --------------------------------
 * Keeps browser speech recognition for input, but isolates speech output.
 * It selects the best available high-quality system voice and avoids
 * competing speakAIReply implementations.
 */
(() => {
  "use strict";

  const state = {
    voices: [],
    selected: null,
    enabled: true,
    loadingTimer: null
  };

  const preferredNames = [
    /Microsoft.*(Jenny|Aria|Guy|Sonia|Ryan|Zira|David|Mark)/i,
    /Google.*(US English|UK English|Urdu|Hindi)/i,
    /(Natural|Neural|Online|Premium|Enhanced)/i,
    /(Samantha|Karen|Daniel|Moira|Alex)/i
  ];

  function loadVoices() {
    state.voices = window.speechSynthesis?.getVoices?.() || [];
    if (!state.selected && state.voices.length) state.selected = chooseVoice();
    return state.voices;
  }

  function chooseVoice(lang = "") {
    const voices = state.voices.length
      ? state.voices
      : (window.speechSynthesis?.getVoices?.() || []);
    if (!voices.length) return null;
    if (!state.voices.length) state.voices = voices;

    const wantUrdu = /^ur/i.test(lang);
    const wantEnglish = /^en/i.test(lang);

    const score = (v) => {
      let s = 0;
      const name = String(v.name || "");
      const vl = String(v.lang || "");
      if (wantUrdu && /^ur/i.test(vl)) s += 100;
      if (wantEnglish && /^en/i.test(vl)) s += 60;
      if (v.localService === false) s += 15;
      for (let i=0;i<preferredNames.length;i++) {
        if (preferredNames[i].test(name)) s += 35 - i*5;
      }
      if (/en-US/i.test(vl)) s += 8;
      if (/ur-PK/i.test(vl)) s += 25;
      return s;
    };

    return [...voices].sort((a,b)=>score(b)-score(a))[0] || voices[0];
  }

  function detectLang(text) {
    const t = String(text || "");
    if (/[\u0600-\u06FF]/.test(t)) return "ur-PK";
    // Roman Urdu is usually spoken more naturally by an English voice than
    // by a robotic Urdu system voice, so keep it English unless Urdu script exists.
    return "en-US";
  }

  function splitSentences(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?۔؟])\s+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function stop() {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }

  function speak(text, options = {}) {
    if (!state.enabled || !("speechSynthesis" in window)) return false;

    stop();

    const clean = String(text || "").trim();
    if (!clean) return false;

    const lang = options.lang || detectLang(clean);
    const voice = options.voice || chooseVoice(lang);
    const chunks = splitSentences(clean);

    let index = 0;
    const speakNext = () => {
      if (index >= chunks.length) return;

      const u = new SpeechSynthesisUtterance(chunks[index++]);
      u.lang = lang;
      if (voice) u.voice = voice;

      // Conversational settings, deliberately avoiding the fast/robotic range.
      u.rate = Number.isFinite(options.rate) ? options.rate : 0.94;
      u.pitch = Number.isFinite(options.pitch) ? options.pitch : 1.02;
      u.volume = Number.isFinite(options.volume) ? options.volume : 1;

      u.onend = speakNext;
      u.onerror = (e) => {
        console.warn("NexusNova voice output:", e);
        // If a selected voice fails, retry once using browser default.
        if (u.voice) {
          try {
            const fallback = new SpeechSynthesisUtterance(chunks[index-1]);
            fallback.lang = lang;
            fallback.rate = 0.94;
            fallback.pitch = 1.02;
            fallback.volume = 1;
            fallback.onend = speakNext;
            window.speechSynthesis.speak(fallback);
          } catch (_) {}
        }
      };

      try { window.speechSynthesis.speak(u); } catch (_) {}
    };

    speakNext();
    return true;
  }

  window.NexusNovaVoice = {
    speak,
    stop,
    refreshVoices: loadVoices,
    chooseVoice,
    setEnabled(v) { state.enabled = !!v; },
    isEnabled() { return state.enabled; },
    getVoices() { return [...state.voices]; }
  };

  if ("speechSynthesis" in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      state.selected = null;
      loadVoices();
    };
    // Some Chromium builds populate voices only after a short delay.
    state.loadingTimer = setInterval(() => {
      if (loadVoices().length) clearInterval(state.loadingTimer);
    }, 500);
    setTimeout(() => clearInterval(state.loadingTimer), 10000);
  }

  console.log("NexusNova natural voice layer loaded.");
})();
