/**
 * NexusNova Tools Hub v1
 * Notes, To-Do, Calculator, Unit Converter, Expense Tracker,
 * Pomodoro, BMI, Tip Calculator, World Clock, QR tools
 * All data in localStorage. Consistent with NexusNova dark UI.
 */
(function () {
  "use strict";

  const K = {
    notes: "nexus_notes_v1",
    todos: "nexus_todos_v1",
    expenses: "nexus_expenses_v1",
    pomodoro: "nexus_pomodoro_v1",
  };

  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }
  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function money(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  /* ========== TOOLS SUB-NAV ========== */
  window.nexusShowTool = function (id) {
    document.querySelectorAll(".nexus-tool-panel").forEach((p) => (p.style.display = "none"));
    document.querySelectorAll(".nexus-tool-chip").forEach((c) => c.classList.remove("active"));
    const panel = document.getElementById("tool-" + id);
    const chip = document.querySelector('.nexus-tool-chip[data-tool="' + id + '"]');
    if (panel) panel.style.display = "block";
    if (chip) chip.classList.add("active");
    if (id === "notes") renderNotes();
    if (id === "todo") renderTodos();
    if (id === "expense") renderExpenses();
    if (id === "world") renderWorldClocks();
    if (id === "weather") nexusLoadWeather();
    if (id === "prayer") nexusLoadPrayer();
    if (id === "bills") { renderBills(); scheduleBillChecks(); }
    if (id === "brief") { /* wait for user click */ }
  };

  /* ========== NOTES ========== */
  window.nexusAddNote = function () {
    const title = (document.getElementById("noteTitle")?.value || "").trim();
    const body = (document.getElementById("noteBody")?.value || "").trim();
    if (!title && !body) return;
    const list = load(K.notes, []);
    list.unshift({ id: uid(), title: title || "Untitled", body, at: new Date().toISOString() });
    save(K.notes, list);
    if (document.getElementById("noteTitle")) document.getElementById("noteTitle").value = "";
    if (document.getElementById("noteBody")) document.getElementById("noteBody").value = "";
    renderNotes();
  };
  window.nexusDeleteNote = function (id) {
    save(K.notes, load(K.notes, []).filter((n) => n.id !== id));
    renderNotes();
  };
  function renderNotes() {
    const box = document.getElementById("notesList");
    if (!box) return;
    const list = load(K.notes, []);
    if (!list.length) {
      box.innerHTML = '<div class="muted-tools">No notes yet. Write something above.</div>';
      return;
    }
    box.innerHTML = list
      .map(
        (n) => `
      <div class="tool-item">
        <div class="tool-item-head">
          <strong>${esc(n.title)}</strong>
          <button class="tool-del" onclick="nexusDeleteNote('${n.id}')">✕</button>
        </div>
        <div class="tool-item-body">${esc(n.body).replace(/\n/g, "<br>")}</div>
        <div class="tool-item-meta">${new Date(n.at).toLocaleString()}</div>
      </div>`
      )
      .join("");
  }

  /* ========== TO-DO ========== */
  window.nexusAddTodo = function () {
    const text = (document.getElementById("todoInput")?.value || "").trim();
    if (!text) return;
    const list = load(K.todos, []);
    list.unshift({ id: uid(), text, done: false, at: new Date().toISOString() });
    save(K.todos, list);
    document.getElementById("todoInput").value = "";
    renderTodos();
  };
  window.nexusToggleTodo = function (id) {
    const list = load(K.todos, []);
    const t = list.find((x) => x.id === id);
    if (t) t.done = !t.done;
    save(K.todos, list);
    renderTodos();
  };
  window.nexusDeleteTodo = function (id) {
    save(K.todos, load(K.todos, []).filter((x) => x.id !== id));
    renderTodos();
  };
  window.nexusClearDoneTodos = function () {
    save(K.todos, load(K.todos, []).filter((x) => !x.done));
    renderTodos();
  };
  function renderTodos() {
    const box = document.getElementById("todoList");
    if (!box) return;
    const list = load(K.todos, []);
    const left = list.filter((x) => !x.done).length;
    const stats = document.getElementById("todoStats");
    if (stats) stats.textContent = left + " remaining · " + list.length + " total";
    if (!list.length) {
      box.innerHTML = '<div class="muted-tools">No tasks. Add one above.</div>';
      return;
    }
    box.innerHTML = list
      .map(
        (t) => `
      <div class="tool-item todo-row ${t.done ? "done" : ""}">
        <label class="todo-check">
          <input type="checkbox" ${t.done ? "checked" : ""} onchange="nexusToggleTodo('${t.id}')">
          <span>${esc(t.text)}</span>
        </label>
        <button class="tool-del" onclick="nexusDeleteTodo('${t.id}')">✕</button>
      </div>`
      )
      .join("");
  }

  /* ========== CALCULATOR ========== */
  let calcExpr = "";
  const MAX_CALC_EXPR_LENGTH = 160;
  const MAX_CALC_OPERATIONS = 128;

  function evaluateCalculatorExpression(expression) {
    const source = String(expression || "").replace(/\s+/g, "");
    if (!source || source.length > MAX_CALC_EXPR_LENGTH || !/^[0-9+\-*/().%]+$/.test(source)) {
      throw new Error("Invalid calculator expression");
    }

    let index = 0;
    let depth = 0;
    let operations = 0;
    const next = () => source[index] || "";
    const countOperation = () => {
      operations += 1;
      if (operations > MAX_CALC_OPERATIONS) throw new Error("Expression too complex");
    };

    const parsePrimary = () => {
      if (next() === "(") {
        depth += 1;
        if (depth > 32) throw new Error("Expression too deeply nested");
        index += 1;
        const value = parseExpression();
        if (next() !== ")") throw new Error("Unclosed parenthesis");
        index += 1;
        depth -= 1;
        return value;
      }

      const start = index;
      let sawDigit = false;
      let sawDecimal = false;
      while (/[0-9.]/.test(next())) {
        if (next() === ".") {
          if (sawDecimal) break;
          sawDecimal = true;
        } else {
          sawDigit = true;
        }
        index += 1;
      }
      if (!sawDigit) throw new Error("Expected a number");
      const value = Number(source.slice(start, index));
      if (!Number.isFinite(value)) throw new Error("Invalid number");
      return value;
    };

    const parseUnary = () => {
      if (next() === "+") {
        index += 1;
        return parseUnary();
      }
      if (next() === "-") {
        index += 1;
        return -parseUnary();
      }
      return parsePrimary();
    };

    const parseFactor = () => {
      let value = parseUnary();
      while (next() === "%") {
        countOperation();
        index += 1;
        value /= 100;
      }
      return value;
    };

    const parseTerm = () => {
      let value = parseFactor();
      while (next() === "*" || next() === "/") {
        const operator = next();
        countOperation();
        index += 1;
        const right = parseFactor();
        if (operator === "/" && right === 0) throw new Error("Division by zero");
        value = operator === "*" ? value * right : value / right;
        if (!Number.isFinite(value)) throw new Error("Invalid result");
      }
      return value;
    };

    const parseExpression = () => {
      let value = parseTerm();
      while (next() === "+" || next() === "-") {
        const operator = next();
        countOperation();
        index += 1;
        const right = parseTerm();
        value = operator === "+" ? value + right : value - right;
        if (!Number.isFinite(value)) throw new Error("Invalid result");
      }
      return value;
    };

    const result = parseExpression();
    if (index !== source.length || !Number.isFinite(result)) {
      throw new Error("Invalid calculator expression");
    }
    return result;
  }

  window.nexusCalcPress = function (val) {
    const display = document.getElementById("calcDisplay");
    if (!display) return;
    if (val === "C") {
      calcExpr = "";
      display.textContent = "0";
      return;
    }
    if (val === "⌫") {
      calcExpr = calcExpr.slice(0, -1);
      display.textContent = calcExpr || "0";
      return;
    }
    if (val === "=") {
      try {
        const result = evaluateCalculatorExpression(calcExpr);
        if (Number.isFinite(result)) {
          calcExpr = String(Number(result.toPrecision(12)));
          display.textContent = calcExpr;
        } else {
          display.textContent = "Error";
          calcExpr = "";
        }
      } catch {
        display.textContent = "Error";
        calcExpr = "";
      }
      return;
    }
    if (typeof val !== "string" || !/^[0-9+\-*/().%]$/.test(val) ||
        calcExpr.length >= MAX_CALC_EXPR_LENGTH) return;
    calcExpr += val;
    display.textContent = calcExpr;
  };

  /* ========== UNIT CONVERTER ========== */
  const units = {
    length: { m: 1, km: 0.001, cm: 100, mm: 1000, mi: 0.000621371, yd: 1.09361, ft: 3.28084, in: 39.3701 },
    weight: { kg: 1, g: 1000, mg: 1e6, lb: 2.20462, oz: 35.274, ton: 0.001 },
    temp: { C: "C", F: "F", K: "K" },
    data: { B: 1, KB: 1 / 1024, MB: 1 / 1024 ** 2, GB: 1 / 1024 ** 3, TB: 1 / 1024 ** 4 },
  };
  window.nexusConvertUnits = function () {
    const cat = document.getElementById("unitCat")?.value || "length";
    const from = document.getElementById("unitFrom")?.value;
    const to = document.getElementById("unitTo")?.value;
    const val = parseFloat(document.getElementById("unitVal")?.value);
    const out = document.getElementById("unitResult");
    if (!out || isNaN(val)) {
      if (out) out.textContent = "—";
      return;
    }
    if (cat === "temp") {
      let c = val;
      if (from === "F") c = ((val - 32) * 5) / 9;
      if (from === "K") c = val - 273.15;
      let r = c;
      if (to === "F") r = (c * 9) / 5 + 32;
      if (to === "K") r = c + 273.15;
      out.textContent = r.toFixed(4) + " " + to;
      return;
    }
    const table = units[cat];
    if (!table || !(from in table) || !(to in table)) {
      out.textContent = "—";
      return;
    }
    const base = val / table[from];
    const result = base * table[to];
    out.textContent = result.toPrecision(8).replace(/\.?0+$/, "") + " " + to;
  };
  window.nexusUnitCatChange = function () {
    const cat = document.getElementById("unitCat")?.value || "length";
    const keys = Object.keys(units[cat] || {});
    const from = document.getElementById("unitFrom");
    const to = document.getElementById("unitTo");
    if (!from || !to) return;
    from.innerHTML = keys.map((k) => `<option value="${k}">${k}</option>`).join("");
    to.innerHTML = keys.map((k) => `<option value="${k}">${k}</option>`).join("");
    if (keys[1]) to.value = keys[1];
    nexusConvertUnits();
  };

  /* ========== EXPENSE TRACKER ========== */
  window.nexusAddExpense = function () {
    const amount = parseFloat(document.getElementById("expAmount")?.value);
    const cat = document.getElementById("expCat")?.value || "Other";
    const note = (document.getElementById("expNote")?.value || "").trim();
    if (!amount || amount <= 0) {
      alert("Enter a valid amount");
      return;
    }
    const list = load(K.expenses, []);
    list.unshift({ id: uid(), amount, cat, note, at: new Date().toISOString() });
    save(K.expenses, list);
    document.getElementById("expAmount").value = "";
    document.getElementById("expNote").value = "";
    renderExpenses();
  };
  window.nexusDeleteExpense = function (id) {
    save(K.expenses, load(K.expenses, []).filter((x) => x.id !== id));
    renderExpenses();
  };
  function renderExpenses() {
    const box = document.getElementById("expenseList");
    const totalEl = document.getElementById("expenseTotal");
    const monthEl = document.getElementById("expenseMonth");
    if (!box) return;
    const list = load(K.expenses, []);
    const now = new Date();
    const monthList = list.filter((e) => {
      const d = new Date(e.at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const total = list.reduce((s, e) => s + Number(e.amount), 0);
    const monthTotal = monthList.reduce((s, e) => s + Number(e.amount), 0);
    if (totalEl) totalEl.textContent = "$" + money(total);
    if (monthEl) monthEl.textContent = "$" + money(monthTotal);
    if (!list.length) {
      box.innerHTML = '<div class="muted-tools">No expenses yet.</div>';
      return;
    }
    box.innerHTML = list
      .slice(0, 50)
      .map(
        (e) => `
      <div class="tool-item">
        <div class="tool-item-head">
          <strong>$${money(e.amount)}</strong>
          <span class="exp-cat">${esc(e.cat)}</span>
          <button class="tool-del" onclick="nexusDeleteExpense('${e.id}')">✕</button>
        </div>
        <div class="tool-item-body">${esc(e.note) || "—"}</div>
        <div class="tool-item-meta">${new Date(e.at).toLocaleString()}</div>
      </div>`
      )
      .join("");
  }

  /* ========== POMODORO ========== */
  let pomoTimer = null;
  let pomoLeft = 25 * 60;
  let pomoRunning = false;
  let pomoMode = "focus"; // focus | break
  function updatePomoUI() {
    const el = document.getElementById("pomoDisplay");
    const label = document.getElementById("pomoLabel");
    if (!el) return;
    const m = Math.floor(pomoLeft / 60);
    const s = pomoLeft % 60;
    el.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    if (label) label.textContent = pomoMode === "focus" ? "Focus Time" : "Break Time";
  }
  window.nexusPomoStart = function () {
    if (pomoRunning) return;
    pomoRunning = true;
    const btn = document.getElementById("pomoStartBtn");
    if (btn) btn.textContent = "Running...";
    pomoTimer = setInterval(() => {
      pomoLeft--;
      updatePomoUI();
      if (pomoLeft <= 0) {
        clearInterval(pomoTimer);
        pomoRunning = false;
        try {
          if (Notification.permission === "granted") {
            new Notification("NexusNova Pomodoro", { body: pomoMode === "focus" ? "Focus done! Take a break." : "Break over. Back to focus." });
          }
        } catch {}
        // auto switch
        if (pomoMode === "focus") {
          pomoMode = "break";
          pomoLeft = 5 * 60;
        } else {
          pomoMode = "focus";
          pomoLeft = 25 * 60;
        }
        updatePomoUI();
        if (btn) btn.textContent = "Start";
      }
    }, 1000);
  };
  window.nexusPomoPause = function () {
    if (pomoTimer) clearInterval(pomoTimer);
    pomoRunning = false;
    const btn = document.getElementById("pomoStartBtn");
    if (btn) btn.textContent = "Resume";
  };
  window.nexusPomoReset = function (mins) {
    if (pomoTimer) clearInterval(pomoTimer);
    pomoRunning = false;
    pomoMode = "focus";
    pomoLeft = (mins || 25) * 60;
    updatePomoUI();
    const btn = document.getElementById("pomoStartBtn");
    if (btn) btn.textContent = "Start";
  };

  /* ========== BMI ========== */
  window.nexusCalcBMI = function () {
    const h = parseFloat(document.getElementById("bmiHeight")?.value);
    const w = parseFloat(document.getElementById("bmiWeight")?.value);
    const out = document.getElementById("bmiResult");
    if (!out || !h || !w) {
      if (out) out.innerHTML = "—";
      return;
    }
    const m = h / 100;
    const bmi = w / (m * m);
    let cat = "Normal";
    let color = "#22c55e";
    if (bmi < 18.5) {
      cat = "Underweight";
      color = "#3b82f6";
    } else if (bmi < 25) {
      cat = "Normal";
      color = "#22c55e";
    } else if (bmi < 30) {
      cat = "Overweight";
      color = "#f59e0b";
    } else {
      cat = "Obese";
      color = "#ef4444";
    }
    out.innerHTML = `<span style="color:${color};font-size:28px;font-weight:bold">${bmi.toFixed(1)}</span><br><span style="color:${color}">${cat}</span>`;
  };

  /* ========== TIP CALCULATOR ========== */
  window.nexusCalcTip = function () {
    const bill = parseFloat(document.getElementById("tipBill")?.value) || 0;
    const pct = parseFloat(document.getElementById("tipPct")?.value) || 0;
    const people = Math.max(1, parseInt(document.getElementById("tipPeople")?.value, 10) || 1);
    const tip = (bill * pct) / 100;
    const total = bill + tip;
    const each = total / people;
    const el = document.getElementById("tipResult");
    if (el) {
      el.innerHTML = `
        <div>Tip: <b>$${money(tip)}</b></div>
        <div>Total: <b>$${money(total)}</b></div>
        <div>Per person: <b>$${money(each)}</b></div>`;
    }
  };

  /* ========== WORLD CLOCK ========== */
  const cities = [
    { name: "Karachi", tz: "Asia/Karachi" },
    { name: "Dubai", tz: "Asia/Dubai" },
    { name: "London", tz: "Europe/London" },
    { name: "New York", tz: "America/New_York" },
    { name: "Tokyo", tz: "Asia/Tokyo" },
    { name: "Istanbul", tz: "Europe/Istanbul" },
  ];
  function renderWorldClocks() {
    const box = document.getElementById("worldClockList");
    if (!box) return;
    const now = new Date();
    box.innerHTML = cities
      .map((c) => {
        let time = "—";
        try {
          time = now.toLocaleTimeString("en-GB", { timeZone: c.tz, hour: "2-digit", minute: "2-digit", second: "2-digit" });
        } catch {}
        return `<div class="world-row"><span>${c.name}</span><strong>${time}</strong></div>`;
      })
      .join("");
  }

  /* ========== QR (Scanner uses camera + Generator) ========== */
  window.nexusGenerateQR = function () {
    const text = (document.getElementById("qrText")?.value || "").trim();
    const wrap = document.getElementById("qrOut");
    if (!wrap) return;
    if (!text) {
      wrap.innerHTML = '<div class="muted-tools">Enter text or URL</div>';
      return;
    }
    if (!confirm("Generating this QR sends its text to the configured QR service. Continue?")) {
      wrap.textContent = "QR not generated. Text was not sent.";
      return;
    }
    const image = new Image(200, 200);
    image.alt = "QR";
    image.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(text);
    image.style.cssText = "border-radius:10px;background:#fff;padding:8px";
    wrap.replaceChildren(image);
  };

  // Simple QR scanner via BarcodeDetector if available, else file input fallback
  window.nexusStartQRScan = async function () {
    const status = document.getElementById("qrScanStatus");
    const video = document.getElementById("qrVideo");
    if (!video) return;
    try {
      if (!window.BarcodeDetector) {
        if (status) status.textContent = "Live scan not supported. Use image upload below.";
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream;
      video.style.display = "block";
      await video.play();
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      if (status) status.textContent = "Point camera at QR...";
      const loop = async () => {
        if (!video.srcObject) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length) {
            const val = codes[0].rawValue;
            if (status) status.textContent = "Found: " + val;
            document.getElementById("qrText").value = val;
            stream.getTracks().forEach((t) => t.stop());
            video.srcObject = null;
            video.style.display = "none";
            return;
          }
        } catch {}
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      if (status) status.textContent = "Camera permission denied or unavailable.";
    }
  };
  window.nexusStopQRScan = function () {
    const video = document.getElementById("qrVideo");
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      video.style.display = "none";
    }
    const status = document.getElementById("qrScanStatus");
    if (status) status.textContent = "Scanner stopped.";
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  /* ========== WEATHER ========== */
  window.nexusLoadWeather = async function () {
    const status = document.getElementById("weatherStatus");
    const box = document.getElementById("weatherBox");
    if (status) status.textContent = "Loading...";
    try {
      // Geolocation optional; fallback Karachi
      let lat = 24.86, lon = 67.00, place = "Karachi";
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        place = "Your location";
      } catch {}

      // Open-Meteo (no API key)
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature` +
        `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("weather api");
      const data = await r.json();
      const c = data.current || {};
      const code = c.weather_code;
      const desc = weatherCodeText(code);
      const icon = weatherCodeIcon(code);

      let dailyHtml = "";
      if (data.daily?.time) {
        dailyHtml = data.daily.time
          .map((t, i) => {
            const d = new Date(t + "T12:00:00");
            const day = d.toLocaleDateString(undefined, { weekday: "short" });
            return `<div class="wx-day"><span>${day}</span><span>${weatherCodeIcon(data.daily.weather_code[i])}</span><span>${Math.round(data.daily.temperature_2m_max[i])}° / ${Math.round(data.daily.temperature_2m_min[i])}°</span></div>`;
          })
          .join("");
      }

      if (box) {
        box.innerHTML = `
          <div class="wx-main">
            <div class="wx-icon">${icon}</div>
            <div>
              <div class="wx-temp">${Math.round(c.temperature_2m)}°C</div>
              <div class="muted-tools">${desc} · ${place}</div>
              <div class="muted-tools">Feels ${Math.round(c.apparent_temperature)}° · Humidity ${c.relative_humidity_2m}% · Wind ${Math.round(c.wind_speed_10m)} km/h</div>
            </div>
          </div>
          <div class="wx-daily">${dailyHtml}</div>`;
      }
      if (status) status.textContent = "Updated " + new Date().toLocaleTimeString();
    } catch (e) {
      if (status) status.textContent = "Could not load weather. Check connection.";
      if (box) box.innerHTML = '<div class="muted-tools">Weather unavailable right now.</div>';
    }
  };
  function weatherCodeText(code) {
    const m = {0:"Clear",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Drizzle",61:"Rain",63:"Rain",65:"Heavy rain",71:"Snow",80:"Showers",95:"Thunderstorm"};
    return m[code] || "Weather";
  }
  function weatherCodeIcon(code) {
    if (code === 0 || code === 1) return "☀️";
    if (code === 2 || code === 3) return "⛅";
    if (code >= 45 && code < 50) return "🌫️";
    if (code >= 51 && code < 70) return "🌧️";
    if (code >= 71 && code < 80) return "❄️";
    if (code >= 80) return "⛈️";
    return "🌤️";
  }

  /* ========== PRAYER TIMES ========== */
  window.nexusLoadPrayer = async function () {
    const status = document.getElementById("prayerStatus");
    const box = document.getElementById("prayerBox");
    if (status) status.textContent = "Loading...";
    try {
      let lat = 24.8607, lon = 67.0011, city = "Karachi";
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        city = "Your location";
      } catch {}

      // AlAdhan free API
      const today = new Date();
      const dateStr = `${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}`;
      const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=1`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("prayer api");
      const json = await r.json();
      const t = json?.data?.timings || {};
      const names = ["Fajr","Sunrise","Dhuhr","Asr","Maghrib","Isha"];
      if (box) {
        box.innerHTML = names.map(n => `
          <div class="prayer-row">
            <span>${n}</span>
            <strong>${(t[n] || "--").slice(0,5)}</strong>
          </div>`).join("") + `<div class="muted-tools" style="margin-top:8px">${city} · ${json?.data?.date?.readable || ""}</div>`;
      }
      if (status) status.textContent = "Prayer times loaded";
    } catch (e) {
      if (status) status.textContent = "Could not load prayer times.";
      if (box) box.innerHTML = '<div class="muted-tools">Prayer API unavailable. Try again later.</div>';
    }
  };

  /* ========== BILL REMINDERS ========== */
  const BILL_KEY = "nexus_bills_v1";
  window.nexusAddBill = function () {
    const title = (document.getElementById("billTitle")?.value || "").trim();
    const amount = parseFloat(document.getElementById("billAmount")?.value) || 0;
    const due = document.getElementById("billDue")?.value;
    if (!title || !due) {
      alert("Enter bill name and due date");
      return;
    }
    const list = load(BILL_KEY, []);
    list.push({ id: uid(), title, amount, due, done: false });
    save(BILL_KEY, list);
    document.getElementById("billTitle").value = "";
    document.getElementById("billAmount").value = "";
    document.getElementById("billDue").value = "";
    renderBills();
    scheduleBillChecks();
  };
  window.nexusToggleBill = function (id) {
    const list = load(BILL_KEY, []);
    const b = list.find(x => x.id === id);
    if (b) b.done = !b.done;
    save(BILL_KEY, list);
    renderBills();
  };
  window.nexusDeleteBill = function (id) {
    save(BILL_KEY, load(BILL_KEY, []).filter(x => x.id !== id));
    renderBills();
  };
  function renderBills() {
    const box = document.getElementById("billsList");
    if (!box) return;
    const list = load(BILL_KEY, []).sort((a,b) => a.due.localeCompare(b.due));
    if (!list.length) {
      box.innerHTML = '<div class="muted-tools">No bill reminders yet.</div>';
      return;
    }
    const today = new Date().toISOString().slice(0,10);
    box.innerHTML = list.map(b => {
      const overdue = !b.done && b.due < today;
      const soon = !b.done && b.due === today;
      return `
        <div class="tool-item ${b.done ? "done" : ""} ${overdue ? "bill-overdue" : ""}">
          <div class="tool-item-head">
            <label class="todo-check">
              <input type="checkbox" ${b.done?"checked":""} onchange="nexusToggleBill('${b.id}')">
              <span>${esc(b.title)}${b.amount? " · $"+money(b.amount):""}</span>
            </label>
            <button class="tool-del" onclick="nexusDeleteBill('${b.id}')">✕</button>
          </div>
          <div class="tool-item-meta">Due ${b.due}${overdue?" · OVERDUE":soon?" · TODAY":""}</div>
        </div>`;
    }).join("");
  }
  function scheduleBillChecks() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(()=>{});
    }
    const list = load(BILL_KEY, []).filter(b => !b.done);
    const today = new Date().toISOString().slice(0,10);
    list.forEach(b => {
      if (b.due <= today && Notification.permission === "granted") {
        try {
          new Notification("NexusNova Bill Reminder", {
            body: `${b.title}${b.amount? " · $"+money(b.amount):""} due ${b.due}`,
          });
        } catch {}
      }
    });
  }
  window.nexusEnableBillNotif = function () {
    if (!("Notification" in window)) {
      alert("Notifications not supported in this browser");
      return;
    }
    Notification.requestPermission().then(p => {
      const s = document.getElementById("billNotifStatus");
      if (s) s.textContent = p === "granted" ? "Notifications enabled ✓" : "Permission: " + p;
      if (p === "granted") scheduleBillChecks();
    });
  };

  /* ========== PDF / IMAGE TOOLS ========== */
  window.nexusCompressImage = function (input) {
    const file = input?.files?.[0];
    const out = document.getElementById("imgToolOut");
    if (!file || !out) return;
    out.textContent = "Processing...";
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 1280;
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { out.textContent = "Failed"; return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "nexus-compressed.jpg";
        a.textContent = `Download compressed (${Math.round(blob.size/1024)} KB)`;
        a.className = "tool-btn primary";
        a.style.display = "inline-block";
        a.style.marginTop = "10px";
        a.style.textAlign = "center";
        a.style.textDecoration = "none";
        out.innerHTML = "";
        out.appendChild(a);
        const prev = document.createElement("img");
        prev.src = a.href;
        prev.style.cssText = "max-width:100%;border-radius:10px;margin-top:10px";
        out.appendChild(prev);
      }, "image/jpeg", 0.72);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { out.textContent = "Could not load image"; };
    img.src = url;
  };

  window.nexusMergeTextToPdf = function () {
    // Lightweight pure-JS minimal PDF (text only) — no external lib
    const text = (document.getElementById("pdfText")?.value || "").trim();
    const out = document.getElementById("pdfToolOut");
    if (!text) { alert("Enter some text"); return; }
    const lines = [];
    const maxLen = 90;
    text.split(/\n/).forEach(para => {
      let s = para;
      while (s.length > maxLen) {
        lines.push(s.slice(0, maxLen));
        s = s.slice(maxLen);
      }
      lines.push(s || " ");
    });
    // Build minimal PDF
    const escPdf = (t) => t.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
    let y = 800;
    let content = "BT /F1 11 Tf 50 " + y + " Td\n";
    lines.slice(0, 60).forEach((ln, i) => {
      if (i) content += "0 -14 Td\n";
      content += `(${escPdf(ln)}) Tj\n`;
    });
    content += "ET";
    const objs = [];
    objs.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
    objs.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
    objs.push("3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n");
    objs.push(`4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream\nendobj\n`);
    objs.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objs.forEach(o => {
      offsets.push(pdf.length);
      pdf += o;
    });
    const xrefPos = pdf.length;
    pdf += `xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objs.length; i++) {
      pdf += String(offsets[i]).padStart(10,"0") + " 00000 n \n";
    }
    pdf += `trailer<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    const blob = new Blob([pdf], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nexus-note.pdf";
    a.textContent = "Download PDF";
    a.className = "tool-btn primary";
    a.style.display = "inline-block";
    a.style.textAlign = "center";
    a.style.textDecoration = "none";
    if (out) { out.innerHTML = ""; out.appendChild(a); }
  };

  /* ========== AI DAILY BRIEF ========== */
  window.nexusAIDailyBrief = async function () {
    const box = document.getElementById("briefBox");
    const status = document.getElementById("briefStatus");
    if (status) status.textContent = "Building your brief...";
    if (box) box.innerHTML = '<div class="muted-tools">Collecting weather, prayer, expenses, tasks...</div>';

    const parts = [];
    // Weather snippet
    try {
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=24.86&longitude=67.00&current=temperature_2m,weather_code&timezone=auto");
      const d = await r.json();
      parts.push(`Weather (Karachi area): ${Math.round(d.current?.temperature_2m)}°C, ${weatherCodeText(d.current?.weather_code)}.`);
    } catch { parts.push("Weather: unavailable."); }

    // Tasks
    const todos = load(K.todos, []).filter(t => !t.done);
    parts.push(todos.length ? `Open tasks (${todos.length}): ` + todos.slice(0,5).map(t=>t.text).join("; ") : "No open tasks.");

    // Expenses this month
    const now = new Date();
    const exps = load(K.expenses, []).filter(e => {
      const d = new Date(e.at);
      return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    });
    const sum = exps.reduce((s,e)=>s+Number(e.amount),0);
    parts.push(`This month expenses: $${money(sum)} (${exps.length} entries).`);

    // Bills due soon
    const today = now.toISOString().slice(0,10);
    const bills = load(BILL_KEY, []).filter(b => !b.done && b.due <= today);
    parts.push(bills.length ? `Bills due/overdue: ` + bills.map(b=>b.title).join(", ") : "No bills due today.");

    const context = parts.join("\n");

    // Prefer existing AI speak/send if available
    const prompt = `You are NexusNova daily assistant. Give a short, friendly daily brief in simple English (or Roman Urdu if user prefers). Include practical next steps. Context:\n${context}\n\nWrite 5-8 short lines.`;

    // Try page2 / ultimate AI if exposed
    try {
      if (typeof window.sendAIMessage === "function") {
        const input = document.getElementById("aiInput") || document.querySelector("#tab-ai input, #tab-ai textarea");
        if (input) {
          input.value = prompt;
          // switch to AI tab optional
        }
      }
    } catch {}

    // Local fallback brief (always works offline-ish)
    const brief = [
      "📋 Your NexusNova Daily Brief",
      "",
      ...parts,
      "",
      "Tips:",
      "• Clear one important task first.",
      "• Check wallet & market if you trade.",
      "• Stay consistent with focus timer.",
      "",
      "Open AI tab and paste a question for deeper help."
    ].join("\n");

    if (box) box.innerHTML = `<pre class="brief-pre">${esc(brief)}</pre>
      <button class="tool-btn primary" onclick="nexusCopyBrief()">Copy brief</button>
      <button class="tool-btn ghost" onclick="nexusSpeakBrief()">🔊 Speak</button>`;
    window.__nexusLastBrief = brief;
    if (status) status.textContent = "Brief ready";
    // Try speak
    try {
      if (typeof window.speakAIReply === "function") window.speakAIReply(brief);
      else if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(brief);
        window.speechSynthesis.speak(u);
      }
    } catch {}
  };
  window.nexusCopyBrief = function () {
    const t = window.__nexusLastBrief || "";
    navigator.clipboard?.writeText(t).then(()=>alert("Copied")).catch(()=>{});
  };
  window.nexusSpeakBrief = function () {
    const t = window.__nexusLastBrief || "";
    if (typeof window.speakAIReply === "function") window.speakAIReply(t);
    else if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(t));
    }
  };


  /* ========== INIT ========== */
  function init() {
    // default tool
    if (document.getElementById("tool-notes")) {
      nexusShowTool("notes");
    }
    nexusUnitCatChange();
    updatePomoUI();
    renderWorldClocks();
    setInterval(renderWorldClocks, 1000);
    // request notif for pomodoro (optional)
    if ("Notification" in window && Notification.permission === "default") {
      // don't force
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 600));
  } else {
    setTimeout(init, 600);
  }

  // Hook into switchTab if tools opened
  const _origSwitch = window.switchTab;
  if (typeof _origSwitch === "function") {
    window.switchTab = function (name, btn) {
      _origSwitch(name, btn);
      if (name === "tools") {
        nexusShowTool(document.querySelector(".nexus-tool-chip.active")?.dataset?.tool || "notes");
      }
    };
  }
})();

  /* ========== CALLER / NUMBER LOOKUP (merged) ========== */

(() => {
  const load = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
  const ACCOUNT_SCOPED_NATIVE_ACTIONS = new Set(["saveContact", "deleteContact"]);
  const postNativeAction = (action, payload = {}) => {
    if (typeof window.nexusPostNativeAction === "function") {
      return window.nexusPostNativeAction(action, payload);
    }
    if (typeof window.NexusAndroid?.postMessage !== "function") return false;
    try {
      const message = { action, ...payload };
      if (ACCOUNT_SCOPED_NATIVE_ACTIONS.has(action)) {
        const accountId = String(window.nexusAccountId || "").trim();
        if (!accountId || accountId.length > 128) return false;
        message.accountId = accountId;
      }
      window.NexusAndroid.postMessage(JSON.stringify(message));
      return true;
    } catch (error) {
      console.warn("NexusNova native bridge:", error);
      return false;
    }
  };

  const PHONEBOOK_KEY = "nexus_phonebook_v1";

  function accountScopedKey(base) {
    const accountId = String(window.nexusAccountId || "");
    return accountId ? `${base}:${accountId}` : "";
  }

  function normalizePhone(raw) {
    let s = String(raw || "").replace(/[^\d+]/g, "");
    if (s.startsWith("00")) s = "+" + s.slice(2);
    // Pakistan local 03xx → +92
    if (/^03\d{9}$/.test(s)) s = "+92" + s.slice(1);
    if (/^3\d{9}$/.test(s)) s = "+92" + s;
    return s;
  }
  function isValidPhone(raw) {
    return /^\+?\d{10,15}$/.test(normalizePhone(raw));
  }

  function guessRegion(phone) {
    const p = phone.replace(/\s/g, "");
    const map = [
      ["+92", "Pakistan"], ["+91", "India"], ["+971", "UAE"], ["+966", "Saudi Arabia"],
      ["+1", "USA/Canada"], ["+44", "UK"], ["+90", "Turkey"], ["+86", "China"],
      ["+61", "Australia"], ["+49", "Germany"], ["+33", "France"], ["+81", "Japan"],
    ];
    for (const [code, name] of map) {
      if (p.startsWith(code)) return { code, country: name };
    }
    if (/^0?3\d{9}$/.test(p.replace("+",""))) return { code: "+92", country: "Pakistan" };
    return { code: "", country: "Unknown" };
  }

  function loadPhonebook() {
    const key = accountScopedKey(PHONEBOOK_KEY);
    return key ? load(key, []) : [];
  }
  function savePhonebook(list) {
    const key = accountScopedKey(PHONEBOOK_KEY);
    if (key) save(key, list);
  }

  // Also pull family / emergency contacts if present in localStorage
  function collectAppContacts() {
    const out = [];
    try {
      const famKey = accountScopedKey("nexusnova_family_members_v1");
      const fam = JSON.parse((famKey && localStorage.getItem(famKey)) || "[]");
      (Array.isArray(fam) ? fam : []).forEach(c => {
        const num = c.phone || c.number || c.mobile || "";
        const name = c.name || c.title || "Family";
        if (num) out.push({ name, phone: normalizePhone(num), address: c.address || c.note || "Family Hub", source: "Family" });
      });
    } catch {}
    try {
      const emergencyKey = accountScopedKey("nexusnovaEmergencyContacts");
      const em = JSON.parse((emergencyKey && localStorage.getItem(emergencyKey)) || "[]");
      (Array.isArray(em) ? em : []).forEach(c => {
        const num = c.phone || c.number || "";
        if (num) out.push({ name: c.name || "Emergency", phone: normalizePhone(num), address: c.relation || "Emergency contact", source: "Emergency" });
      });
    } catch {}
    return out;
  }

  window.nexusLookupNumber = async function () {
    const input = document.getElementById("callerNumber");
    const box = document.getElementById("callerResult");
    const status = document.getElementById("callerStatus");
    const raw = (input?.value || "").trim();
    if (!raw) {
      alert("Phone number daalo");
      return;
    }
    const phone = normalizePhone(raw);
    if (!isValidPhone(phone)) {
      if (status) status.textContent = "Enter a valid phone number (10–15 digits).";
      if (box) box.innerHTML = "";
      return;
    }
    if (status) status.textContent = "Looking up...";
    if (box) box.innerHTML = "";

    const region = guessRegion(phone);
    const book = loadPhonebook();
    const appContacts = collectAppContacts();
    const all = [...book, ...appContacts];

    // Exact / partial match
    const digits = phone.replace(/\D/g, "");
    let match = all.find(c => {
      const d = String(c.phone || "").replace(/\D/g, "");
      return d && (d === digits || d.endsWith(digits.slice(-10)) || digits.endsWith(d.slice(-10)));
    });

    // Free-ish online hint: abstractapi / numverify need keys — skip.
    // Use local + region only; optional public placeholder
    let onlineName = null;
    let onlineLoc = null;

    // Try a lightweight public endpoint pattern (may fail CORS — handled)
    try {
      // Country only already have; no reliable free no-key global CNAM in browser
    } catch {}

    if (match) {
      if (box) {
        box.innerHTML = `
          <div class="caller-card known">
            <div class="caller-badge">✓ Saved / Known</div>
            <div class="caller-name">${esc(match.name)}</div>
            <div class="caller-phone">${esc(match.phone || phone)}</div>
            <div class="caller-addr">${esc(match.address || "—")}</div>
            <div class="muted-tools">Source: ${esc(match.source || "Phonebook")}</div>
          </div>`;
      }
      if (status) status.textContent = "Match found in your NexusNova contacts";
      return;
    }

    // Unknown number UI
    if (box) {
      box.innerHTML = `
        <div class="caller-card unknown">
          <div class="caller-badge warn">⚠ Unknown number</div>
          <div class="caller-name">Unknown caller</div>
          <div class="caller-phone">${esc(phone)}</div>
          <div class="caller-addr">${esc(region.country)}${region.code ? " · " + region.code : ""}</div>
          <p class="muted-tools" style="margin-top:10px">
            Global name/address databases (Truecaller-style) paid APIs mangte hain.
            Is number ko apni phonebook mein save karo — agli baar naam + address dikhega.
          </p>
          <input id="saveCallerName" class="tool-input" placeholder="Name (e.g. Ahmed Khan)">
          <input id="saveCallerAddr" class="tool-input" placeholder="Address / note (optional)">
          <button class="tool-btn primary" onclick="nexusSaveCallerFromLookup('${esc(phone).replace(/'/g, "\\'")}')">Save to Phonebook</button>
        </div>`;
    }
    if (status) status.textContent = "Unknown — save karke next time identify hoga";
  };

  window.nexusSaveCallerFromLookup = function (phone) {
    const name = (document.getElementById("saveCallerName")?.value || "").trim();
    const address = (document.getElementById("saveCallerAddr")?.value || "").trim();
    if (!name) {
      alert("Name likho");
      return;
    }
    if (!isValidPhone(phone)) {
      alert("Valid phone number daalo");
      return;
    }
    const list = loadPhonebook();
    const norm = normalizePhone(phone);
    const existing = list.findIndex(c => normalizePhone(c.phone) === norm);
    const row = {
      id: existing >= 0 && typeof list[existing].id === "string" ? list[existing].id : uid(),
      name,
      phone: norm,
      address,
      source: "Phonebook",
      at: new Date().toISOString()
    };
    if (existing >= 0) list[existing] = { ...list[existing], ...row };
    else list.unshift(row);
    savePhonebook(list);
    postNativeAction("saveContact", { contactId: row.id, name, phone: norm, address });
    renderPhonebook();
    if (document.getElementById("callerNumber")) document.getElementById("callerNumber").value = norm;
    nexusLookupNumber();
  };

  window.nexusAddPhonebook = function () {
    const name = (document.getElementById("pbName")?.value || "").trim();
    const phone = normalizePhone(document.getElementById("pbPhone")?.value || "");
    const address = (document.getElementById("pbAddr")?.value || "").trim();
    if (!name || !isValidPhone(phone)) {
      alert("Valid name aur number zaroori hain");
      return;
    }
    const list = loadPhonebook();
    const row = { id: uid(), name, phone, address, source: "Phonebook", at: new Date().toISOString() };
    list.unshift(row);
    savePhonebook(list);
    postNativeAction("saveContact", { contactId: row.id, name, phone, address });
    document.getElementById("pbName").value = "";
    document.getElementById("pbPhone").value = "";
    document.getElementById("pbAddr").value = "";
    renderPhonebook();
  };

  window.nexusDeletePhonebook = function (id) {
    const removed = loadPhonebook().find(c => c.id === id);
    savePhonebook(loadPhonebook().filter(c => c.id !== id));
    if (typeof removed?.id === "string") {
      postNativeAction("deleteContact", { contactId: removed.id });
    }
    renderPhonebook();
  };

  function renderPhonebook() {
    const box = document.getElementById("phonebookList");
    if (!box) return;
    const list = loadPhonebook();
    if (!list.length) {
      box.innerHTML = '<div class="muted-tools">Abhi koi number save nahi. Unknown call ke baad yahan save karo.</div>';
      return;
    }
    box.innerHTML = list.map(c => `
      <div class="tool-item">
        <div class="tool-item-head">
          <strong>${esc(c.name)}</strong>
          <button class="tool-del" onclick="nexusDeletePhonebook('${c.id}')">✕</button>
        </div>
        <div class="tool-item-body">${esc(c.phone)}</div>
        <div class="tool-item-meta">${esc(c.address || "—")}</div>
      </div>`).join("");
  }

  window.nexusSimulateIncoming = function () {
    const n = (document.getElementById("callerNumber")?.value || "").trim() || "+923001234567";
    const phone = normalizePhone(n);
    if (!isValidPhone(phone)) {
      alert("Valid phone number daalo");
      return;
    }
    if (document.getElementById("callerNumber")) document.getElementById("callerNumber").value = phone;
    const overlay = document.getElementById("nexusCallOverlay");
    if (!overlay) return;
    // Run lookup then show overlay
    const book = [...loadPhonebook(), ...collectAppContacts()];
    const digits = phone.replace(/\D/g, "");
    const match = book.find(c => {
      const d = String(c.phone || "").replace(/\D/g, "");
      return d && (d === digits || d.endsWith(digits.slice(-10)) || digits.endsWith(d.slice(-10)));
    });
    const region = guessRegion(phone);
    document.getElementById("callOverlayName").textContent = match ? match.name : "Unknown number";
    document.getElementById("callOverlayPhone").textContent = phone;
    document.getElementById("callOverlayAddr").textContent = match
      ? (match.address || match.source || "")
      : (region.country + " · Not in your phonebook");
    overlay.classList.add("show");
  };
  window.nexusCloseCallOverlay = function () {
    document.getElementById("nexusCallOverlay")?.classList.remove("show");
  };

  if (typeof window.NexusAndroid?.postMessage === "function") {
    try {
      const btn=document.getElementById("androidCallerSetupBtn");
      if(btn) btn.style.display="block";
    } catch {}
  }

  window.addEventListener("nexusaccountready", () => {
    try { renderPhonebook(); } catch (_) {}
  });

})();
