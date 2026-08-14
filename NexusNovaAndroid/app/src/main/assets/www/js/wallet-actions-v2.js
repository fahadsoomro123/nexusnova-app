/* NexusNova Wallet Actions V2
   FINAL UI FIX
   - No legacy alert() popups
   - Deposit + Withdraw modal UI
   - Uses existing Firebase app/auth when available
   - No private keys in browser
*/
(() => {
  "use strict";

  const NETWORKS = {
    "Ethereum Mainnet": "0x1",
    "BNB Smart Chain": "0x38",
    "Polygon": "0x89",
    "Arbitrum One": "0xa4b1",
    "Optimism": "0xa",
    "Base": "0x2105"
  };

  const ASSETS = ["USDT", "USDC", "ETH", "BTC", "BNB", "SOL"];

  function $(id) {
    return document.getElementById(id);
  }

  function status(message, ok = false) {
    const el = $("walletActionStatus");
    if (!el) return;
    el.innerHTML = message;
    el.style.color = ok ? "#22c55e" : "";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function closeModal() {
    $("nexusWalletActionModal")?.remove();
  }

  function modal(title, body) {
    closeModal();

    const wrap = document.createElement("div");
    wrap.id = "nexusWalletActionModal";
    wrap.innerHTML = `
      <div style="
        position:fixed;inset:0;z-index:99999;
        background:rgba(0,0,0,.72);
        display:flex;align-items:center;justify-content:center;
        padding:20px;">
        <div style="
          width:min(440px,100%);
          max-height:90vh;overflow:auto;
          background:#101827;color:#fff;
          border:1px solid #26364d;
          border-radius:16px;
          padding:20px;
          box-shadow:0 20px 60px rgba(0,0,0,.5);">

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h2 style="margin:0;font-size:20px;">${esc(title)}</h2>
            <button id="nexusModalClose" type="button"
              style="border:0;background:transparent;color:#94a3b8;font-size:24px;cursor:pointer;">×</button>
          </div>

          ${body}
        </div>
      </div>
    `;

    document.body.appendChild(wrap);
    $("nexusModalClose")?.addEventListener("click", closeModal);

    wrap.firstElementChild?.addEventListener("click", e => {
      if (e.target === wrap.firstElementChild) closeModal();
    });

    return wrap;
  }

  function selectHtml(id, values, selected) {
    return `
      <select id="${id}" style="
        width:100%;padding:12px;margin:6px 0 14px;
        border-radius:10px;border:1px solid #334155;
        background:#0f172a;color:#fff;">
        ${values.map(v =>
          `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(v)}</option>`
        ).join("")}
      </select>
    `;
  }

  async function firebaseCallable(name, data) {
    try {
      if(typeof window.nexusRequireAppCheck !== "function"){
        throw new Error("App Check is unavailable. Reload the app after it has been configured.");
      }
      await window.nexusRequireAppCheck();
      const [{ getApps }, { getFunctions, httpsCallable }] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js")
      ]);

      const apps = getApps();
      if (!apps.length) throw new Error("Firebase app is not initialized.");

      const functions = getFunctions(apps[0]);
      const fn = httpsCallable(functions, name);
      const result = await fn(data);
      return result?.data ?? {};
    } catch (e) {
      console.error("NexusNova Firebase callable:", name, e);
      throw e;
    }
  }

  function connectedAddress() {
    return (
      window.nexusConnectedAddress ||
      window.ethereum?.selectedAddress ||
      ""
    );
  }

  function deposit() {
    const body = `
      <label style="display:block;font-size:13px;">Asset</label>
      ${selectHtml("nxDepositAsset", ASSETS, "USDT")}

      <label style="display:block;font-size:13px;">Network</label>
      ${selectHtml("nxDepositNetwork", Object.keys(NETWORKS), "Ethereum Mainnet")}

      <button id="nxDepositContinue" type="button" style="
        width:100%;padding:13px;border:0;border-radius:10px;
        background:#00d9b5;color:#061016;font-weight:700;cursor:pointer;">
        Get Deposit Address
      </button>

      <div id="nxDepositResult" style="
        margin-top:14px;padding:12px;border-radius:10px;
        background:#0b1220;color:#94a3b8;font-size:13px;">
        Choose the asset and network, then request the deposit address.
      </div>
    `;

    modal("Deposit", body);

    $("nxDepositContinue")?.addEventListener("click", async () => {
      const asset = $("nxDepositAsset").value;
      const network = $("nxDepositNetwork").value;
      const result = $("nxDepositResult");

      result.textContent = "Requesting deposit address...";

      try {
        const data = await firebaseCallable("getDepositAddress", {
          asset,
          network
        });

        const address =
          data?.address ||
          data?.depositAddress ||
          data?.result?.address ||
          "";

        if (!address) {
          result.innerHTML =
            `<span style="color:#f59e0b;">
              Backend responded, but no deposit address is configured for ${esc(asset)} on ${esc(network)}.
            </span>`;
          return;
        }

        result.innerHTML = `
          <div style="color:#22c55e;margin-bottom:8px;">
            Deposit address ready
          </div>
          <div style="word-break:break-all;font-family:monospace;margin-bottom:10px;">
            ${esc(address)}
          </div>
          <button id="nxCopyDeposit" type="button" style="
            width:100%;padding:10px;border:1px solid #00d9b5;
            border-radius:9px;background:transparent;color:#00d9b5;cursor:pointer;">
            Copy Address
          </button>
        `;

        $("nxCopyDeposit")?.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(address);
            $("nxCopyDeposit").textContent = "✓ Address Copied";
          } catch {
            $("nxCopyDeposit").textContent = "Copy failed";
          }
        });

        status(
          `<strong>Deposit address ready</strong><br>${esc(asset)} • ${esc(network)}`,
          true
        );
      } catch (e) {
        result.innerHTML = `
          <span style="color:#f87171;">
            ${esc(e?.message || "Deposit service is not configured yet.")}
          </span>
        `;
      }
    });
  }

  function withdraw() {
    const address = connectedAddress();

    const body = `
      <label style="display:block;font-size:13px;">Asset</label>
      ${selectHtml("nxWithdrawAsset", ASSETS, "USDT")}

      <label style="display:block;font-size:13px;">Network</label>
      ${selectHtml("nxWithdrawNetwork", Object.keys(NETWORKS), "Ethereum Mainnet")}

      <label style="display:block;font-size:13px;">Amount</label>
      <input id="nxWithdrawAmount" type="number" min="0" step="any"
        placeholder="0.00"
        style="width:100%;padding:12px;margin:6px 0 14px;
        border-radius:10px;border:1px solid #334155;
        background:#0f172a;color:#fff;">

      <label style="display:block;font-size:13px;">Destination wallet address</label>
      <input id="nxWithdrawAddress" type="text"
        placeholder="0x..."
        value="${esc(address)}"
        style="width:100%;padding:12px;margin:6px 0 14px;
        border-radius:10px;border:1px solid #334155;
        background:#0f172a;color:#fff;">

      <button id="nxWithdrawSubmit" type="button" style="
        width:100%;padding:13px;border:0;border-radius:10px;
        background:#00d9b5;color:#061016;font-weight:700;cursor:pointer;">
        Submit Withdrawal Request
      </button>

      <div id="nxWithdrawResult" style="
        margin-top:14px;padding:12px;border-radius:10px;
        background:#0b1220;color:#94a3b8;font-size:13px;">
        Your request will be submitted for secure server-side processing.
      </div>
    `;

    modal("Withdraw", body);

    $("nxWithdrawSubmit")?.addEventListener("click", async () => {
      const asset = $("nxWithdrawAsset").value;
      const network = $("nxWithdrawNetwork").value;
      const amount = $("nxWithdrawAmount").value.trim();
      const destination = $("nxWithdrawAddress").value.trim();
      const result = $("nxWithdrawResult");

      if (!amount || Number(amount) <= 0) {
        result.innerHTML = `<span style="color:#f87171;">Enter a valid amount.</span>`;
        return;
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(destination)) {
        result.innerHTML =
          `<span style="color:#f87171;">Enter a valid EVM destination address.</span>`;
        return;
      }

      result.textContent = "Submitting withdrawal request...";

      try {
        const data = await firebaseCallable("requestWithdrawal", {
          asset,
          network,
          amount,
          destination
        });

        result.innerHTML = `
          <span style="color:#22c55e;">
            ✓ Withdrawal request submitted.
          </span>
          ${data?.requestId ? `<br>Request ID: ${esc(data.requestId)}` : ""}
        `;

        status(
          `<strong>Withdrawal request submitted</strong><br>${esc(asset)} • ${esc(amount)} • ${esc(network)}`,
          true
        );
      } catch (e) {
        result.innerHTML = `
          <span style="color:#f87171;">
            ${esc(e?.message || "Withdrawal service is not configured yet.")}
          </span>
        `;
      }
    });
  }

  function installWalletActionHandlers() {
    window.handleDeposit = deposit;
    window.handleWithdraw = withdraw;
    window.nexusSecureWalletWithdraw = withdraw;
  }

  // page2.js is a module, so an immediate assignment from this classic script
  // can be overwritten later. Re-assert after modules and again at window load.
  installWalletActionHandlers();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installWalletActionHandlers, { once: true });
  }
  window.addEventListener("load", installWalletActionHandlers, { once: true });

  console.log("NexusNova Wallet Actions V2 loaded — secure callable handlers active.");
})();
