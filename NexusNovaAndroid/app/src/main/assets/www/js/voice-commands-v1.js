/* NexusNova Voice Commands V1
   Browser speech recognition command router.
   Does not replace AI voice input.
*/
(() => {
  "use strict";

  let recognition = null;
  let active = false;

  const $ = id => document.getElementById(id);

  function status(text) {
    const el = $("nexusVoiceCommandStatus");
    if (el) el.textContent = text;
  }

  function normalize(text) {
    return String(text || "").toLowerCase().trim();
  }

  function route(command) {
    const c = normalize(command);

    const routes = [
      [["wallet", "open wallet"], "wallet"],
      [["market", "open market"], "market"],
      [["tasks", "open tasks", "rewards"], "tasks"],
      [["news", "open news"], "news"],
      [["gold", "gold fx", "forex"], "finance"],
      [["chat", "open chat"], "chat"],
      [["ai", "open ai", "assistant"], "ai"],
      [["location", "open location"], "location"],
      [["emergency", "open emergency", "sos"], "emergency"],
      [["family", "open family"], "family"],
      [["settings", "open settings"], "about"],
      [["profile", "open profile"], "profile"],
      [["mine", "mining", "open mining"], "home"]
    ];

    for (const [words, tab] of routes) {
      if (words.some(w => c === w || c.includes(w))) {
        window.switchTab?.(tab, null);
        status(`✓ Opened ${tab}`);
        return true;
      }
    }

    if (c.includes("refresh news")) {
      window.loadNews?.();
      status("✓ Refreshing news");
      return true;
    }

    if (c.includes("connect wallet")) {
      window.connectNexusWallet?.();
      status("✓ Opening wallet connection");
      return true;
    }

    if (c.includes("disconnect wallet")) {
      window.disconnectNexusWallet?.();
      status("✓ Wallet disconnected");
      return true;
    }

    if (c.includes("start mining") || c === "start") {
      document.getElementById("mineBtn")?.click();
      status("✓ Start mining command sent");
      return true;
    }

    if (c.includes("stop mining") || c === "stop") {
      status("Mining sessions finish automatically after 24 hours; early stop is not enabled.");
      return true;
    }

    return false;
  }

  window.toggleNexusVoiceCommands = function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      status("Voice commands are not supported in this browser.");
      return;
    }

    if (active && recognition) {
      recognition.stop();
      return;
    }

    recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      active = true;
      const btn = $("nexusVoiceCommandBtn");
      if (btn) btn.textContent = "🛑 Stop";
      status("🎤 Listening... say: “open wallet”, “open family”, “refresh news”");
    };

    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (!route(transcript)) {
        status(`Heard: "${transcript}" — command not recognized`);
      }
    };

    recognition.onerror = event => {
      status(`Voice command error: ${event.error || "unknown error"}`);
    };

    recognition.onend = () => {
      active = false;
      const btn = $("nexusVoiceCommandBtn");
      if (btn) btn.textContent = "🎤 Commands";
      if (!$("nexusVoiceCommandStatus")?.textContent?.startsWith("✓")) {
        status("Voice commands ready");
      }
    };

    recognition.start();
  };
})();
