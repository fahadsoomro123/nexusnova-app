/* NexusNova Family Hub V1
   Local-first trusted family contacts + one-time location check-in.
   No continuous tracking and no location upload.
*/
(() => {
  "use strict";

  const KEY = "nexusnova_family_members_v1";

  const $ = id => document.getElementById(id);

  function storageKey() {
    const accountId = String(window.nexusAccountId || "");
    return accountId ? `${KEY}:${accountId}` : "";
  }

  function normalizePhone(raw) {
    let phone = String(raw || "").trim().replace(/[^\d+]/g, "");
    if (phone.startsWith("00")) phone = "+" + phone.slice(2);
    if (/^03\d{9}$/.test(phone)) phone = "+92" + phone.slice(1);
    return /^\+?\d{7,15}$/.test(phone) ? phone : "";
  }

  function read() {
    try {
      const key = storageKey();
      if (!key) return [];
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function write(items) {
    const key = storageKey();
    if (!key) return false;
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }

  window.addNexusFamilyMember = function () {
    const name = $("familyName")?.value.trim().slice(0, 80);
    const relation = $("familyRelation")?.value.trim().slice(0, 80);
    const phone = normalizePhone($("familyPhone")?.value);

    if (!name || !phone) {
      alert("Enter a name and a valid 7–15 digit phone number.");
      return;
    }

    const items = read();
    items.push({
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      relation,
      phone,
      createdAt: Date.now()
    });
    if (!write(items)) {
      alert("Please wait for your account to finish loading.");
      return;
    }

    if ($("familyName")) $("familyName").value = "";
    if ($("familyRelation")) $("familyRelation").value = "";
    if ($("familyPhone")) $("familyPhone").value = "";

    window.renderNexusFamily();
  };

  window.removeNexusFamilyMember = function (id) {
    write(read().filter(x => x.id !== id));
    window.renderNexusFamily();
  };

  window.renderNexusFamily = function () {
    const list = $("familyList");
    if (!list) return;

    const items = read();
    if (!items.length) {
      list.innerHTML = '<div class="status">No family members added yet.</div>';
      return;
    }

    list.innerHTML = items.map(item => {
      const phone = normalizePhone(item.phone);
      return `
        <div class="family-member">
          <div class="family-member-main">
            <strong>${esc(item.name)}</strong>
            <span>${esc(item.relation || "Family")}</span>
            ${item.phone ? `<small>${esc(item.phone)}</small>` : ""}
          </div>
          <div class="family-actions">
            ${phone ? `<a class="settings-btn" href="tel:${esc(phone)}">📞 Call</a>` : ""}
            ${phone ? `<a class="settings-btn" target="_blank" rel="noopener"
                href="https://wa.me/${encodeURIComponent(phone.replace(/^\+/, ""))}">💬 WhatsApp</a>` : ""}
            <button class="settings-btn danger"
              onclick="removeNexusFamilyMember('${esc(item.id)}')">Remove</button>
          </div>
        </div>
      `;
    }).join("");
  };

  window.createNexusFamilyCheckIn = function () {
    const out = $("familyCheckInStatus");
    if (!out) return;

    if (!navigator.geolocation) {
      out.textContent = "Location is not supported by this browser.";
      return;
    }

    out.textContent = "Getting your current location...";

    navigator.geolocation.getCurrentPosition(
      async position => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const link = `https://www.google.com/maps?q=${encodeURIComponent(lat + "," + lon)}`;

        try {
          await navigator.clipboard.writeText(link);
          out.innerHTML =
            `✅ Location check-in link copied.<br>` +
            `<a href="${esc(link)}" target="_blank" rel="noopener">Open map</a>`;
        } catch {
          out.innerHTML =
            `Location link ready:<br><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>`;
        }
      },
      error => {
        out.textContent =
          error.code === 1
            ? "Location permission was denied."
            : "Could not get your current location.";
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  window.addEventListener("load", () => window.renderNexusFamily());
  window.addEventListener("nexusaccountready", () => window.renderNexusFamily());
})();
