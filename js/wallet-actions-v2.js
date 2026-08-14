/* NexusNova Wallet Actions V3
   True non-custodial external-wallet actions.
   - Deposit uses the connected EVM wallet address on the active chain.
   - Send/withdraw is signed by the user's injected wallet via eth_sendTransaction.
   - No private keys, seed phrases, custodial balances, or fake deposit addresses.
   - No Firebase Functions / Blaze dependency for normal external-wallet transfers.
*/
(() => {
  "use strict";
  if (window.__nxWalletActionsV3) return;
  window.__nxWalletActionsV3 = true;

  const ERC20_TRANSFER = "a9059cbb";

  // Only assets whose current issuer/native-chain configuration is explicitly
  // supported here are enabled for value transfers. Unsupported/read-only
  // assets remain visible elsewhere in the wallet but are never guessed here.
  const CHAINS = {
    "0x1": {
      name: "Ethereum Mainnet",
      native: { symbol: "ETH", decimals: 18 },
      tokens: {
        USDT: { contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
        USDC: { contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 }
      }
    },
    "0x38": {
      name: "BNB Smart Chain",
      native: { symbol: "BNB", decimals: 18 },
      tokens: {}
    },
    "0x89": {
      name: "Polygon PoS",
      native: { symbol: "POL", decimals: 18 },
      tokens: {
        USDC: { contract: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 }
      }
    },
    "0xa4b1": {
      name: "Arbitrum One",
      native: { symbol: "ETH", decimals: 18 },
      tokens: {
        USDC: { contract: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 }
      }
    },
    "0xa": {
      name: "OP Mainnet",
      native: { symbol: "ETH", decimals: 18 },
      tokens: {
        USDC: { contract: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 }
      }
    },
    "0x2105": {
      name: "Base",
      native: { symbol: "ETH", decimals: 18 },
      tokens: {
        USDC: { contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 }
      }
    },
    "0xa86a": {
      name: "Avalanche C-Chain",
      native: { symbol: "AVAX", decimals: 18 },
      tokens: {
        USDT: { contract: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", decimals: 6 },
        USDC: { contract: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 }
      }
    }
  };

  const $ = id => document.getElementById(id);

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function status(message, ok = false) {
    const el = $("walletActionStatus");
    if (!el) return;
    el.innerHTML = message;
    el.style.color = ok ? "#22c55e" : "";
  }

  function provider() {
    const eth = window.ethereum;
    if (!eth) return null;
    const list = Array.isArray(eth.providers) ? eth.providers : [eth];
    const address = String(window.nexusConnectedAddress || "").toLowerCase();
    if (address) {
      const authorized = list.find(p => p?.selectedAddress?.toLowerCase?.() === address);
      if (authorized) return authorized;
    }
    return list.find(p => p?.isRabby) || list[0] || null;
  }

  async function connection() {
    const p = provider();
    if (!p) throw new Error("No EVM wallet detected. Connect Rabby or MetaMask first.");
    let accounts = await p.request({ method: "eth_accounts" });
    if (!accounts?.length && typeof window.connectNexusWallet === "function") {
      await window.connectNexusWallet();
      accounts = await p.request({ method: "eth_accounts" });
    }
    const address = accounts?.[0] || window.nexusConnectedAddress || "";
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("Connect an EVM wallet first.");
    const chainId = String(await p.request({ method: "eth_chainId" })).toLowerCase();
    const chain = CHAINS[chainId];
    if (!chain) throw new Error(`This EVM network (${chainId}) is not enabled for NexusNova transfers yet.`);
    window.nexusConnectedAddress = address;
    window.nexusConnectedChainId = chainId;
    return { p, address, chainId, chain };
  }

  function closeModal() {
    $("nexusWalletActionModal")?.remove();
  }

  function modal(title, body) {
    closeModal();
    const wrap = document.createElement("div");
    wrap.id = "nexusWalletActionModal";
    wrap.innerHTML = `
      <div class="nx-wallet-modal-backdrop" style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="width:min(460px,100%);max-height:90vh;overflow:auto;background:#101827;color:#fff;border:1px solid #26364d;border-radius:18px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.5);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
            <div><div style="font-size:10px;letter-spacing:.14em;color:#60a5fa;font-weight:900;">NON-CUSTODIAL WALLET</div><h2 style="margin:4px 0 0;font-size:20px;">${esc(title)}</h2></div>
            <button id="nexusModalClose" type="button" style="border:0;background:transparent;color:#94a3b8;font-size:26px;cursor:pointer;">×</button>
          </div>
          ${body}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    $("nexusModalClose")?.addEventListener("click", closeModal);
    wrap.querySelector(".nx-wallet-modal-backdrop")?.addEventListener("click", e => {
      if (e.target === e.currentTarget) closeModal();
    });
    return wrap;
  }

  function assetOptions(chain) {
    return [chain.native.symbol, ...Object.keys(chain.tokens)];
  }

  function selectHtml(id, values) {
    return `<select id="${id}" style="width:100%;padding:12px;margin:6px 0 14px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;">${values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select>`;
  }

  function decimalToUnits(raw, decimals) {
    const text = String(raw || "").trim();
    if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error("Enter a valid decimal amount.");
    const [wholeRaw, fractionRaw = ""] = text.split(".");
    if (fractionRaw.length > decimals) throw new Error(`Maximum ${decimals} decimal places are allowed.`);
    const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
    const fraction = (fractionRaw + "0".repeat(decimals)).slice(0, decimals);
    const units = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction || "0");
    if (units <= 0n) throw new Error("Amount must be greater than zero.");
    return units;
  }

  function pad64(hexWithout0x) {
    return String(hexWithout0x).replace(/^0x/, "").padStart(64, "0");
  }

  async function copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      if (button) button.textContent = "✓ Copied";
    } catch (_) {
      if (button) button.textContent = "Copy failed";
    }
  }

  async function deposit() {
    try {
      const { address, chain } = await connection();
      const assets = assetOptions(chain);
      modal("Receive / Deposit", `
        <div style="padding:11px 12px;border-radius:12px;background:#0b1220;margin-bottom:14px;font-size:12px;line-height:1.55;color:#cbd5e1;">
          <strong style="color:#fff;">Active network:</strong> ${esc(chain.name)}<br>
          This is your connected wallet address. NexusNova never holds your private key.
        </div>
        <label style="display:block;font-size:13px;">Asset to receive</label>
        ${selectHtml("nxDepositAsset", assets)}
        <div id="nxDepositWarning" style="font-size:12px;color:#fbbf24;margin-bottom:12px;"></div>
        <div style="word-break:break-all;font-family:monospace;padding:13px;border-radius:10px;background:#070d18;border:1px solid #243248;">${esc(address)}</div>
        <button id="nxCopyDeposit" type="button" style="width:100%;padding:12px;margin-top:12px;border:1px solid #00d9b5;border-radius:10px;background:transparent;color:#00d9b5;font-weight:800;cursor:pointer;">Copy Wallet Address</button>
      `);
      const asset = $("nxDepositAsset");
      const warning = $("nxDepositWarning");
      const paint = () => { warning.textContent = `Only send ${asset.value} on ${chain.name} to this address. Sending another network can cause permanent loss.`; };
      asset?.addEventListener("change", paint); paint();
      $("nxCopyDeposit")?.addEventListener("click", e => copy(address, e.currentTarget));
      status(`<strong>Receive address ready</strong><br>${esc(chain.name)} • ${esc(address.slice(0,6))}...${esc(address.slice(-4))}`, true);
    } catch (e) {
      modal("Wallet Connection Required", `<div style="color:#fca5a5;line-height:1.6;">${esc(e?.message || "Connect your wallet first.")}</div><button id="nxWalletConnectFromModal" type="button" style="width:100%;padding:12px;margin-top:15px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer;">Connect Wallet</button>`);
      $("nxWalletConnectFromModal")?.addEventListener("click", async () => { try { await window.connectNexusWallet?.(); closeModal(); } catch (_) {} });
    }
  }

  async function withdraw() {
    try {
      const { p, address, chain } = await connection();
      const assets = assetOptions(chain);
      modal("Send / Withdraw", `
        <div style="padding:11px 12px;border-radius:12px;background:#0b1220;margin-bottom:14px;font-size:12px;line-height:1.55;color:#cbd5e1;">
          <strong style="color:#fff;">From:</strong> ${esc(address.slice(0,8))}...${esc(address.slice(-6))}<br>
          <strong style="color:#fff;">Network:</strong> ${esc(chain.name)}<br>
          Your wallet will show the final transaction confirmation and network fee before sending.
        </div>
        <label style="display:block;font-size:13px;">Asset</label>
        ${selectHtml("nxWithdrawAsset", assets)}
        <label style="display:block;font-size:13px;">Amount</label>
        <input id="nxWithdrawAmount" type="text" inputmode="decimal" placeholder="0.00" style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0 14px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;">
        <label style="display:block;font-size:13px;">Destination EVM address</label>
        <input id="nxWithdrawAddress" type="text" placeholder="0x..." style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0 14px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;">
        <button id="nxWithdrawSubmit" type="button" style="width:100%;padding:13px;border:0;border-radius:10px;background:#00d9b5;color:#061016;font-weight:900;cursor:pointer;">Review in Wallet</button>
        <div id="nxWithdrawResult" style="margin-top:14px;padding:12px;border-radius:10px;background:#0b1220;color:#94a3b8;font-size:13px;line-height:1.5;">Nothing is sent until you approve the transaction inside your wallet.</div>
      `);

      $("nxWithdrawSubmit")?.addEventListener("click", async () => {
        const result = $("nxWithdrawResult");
        const asset = $("nxWithdrawAsset")?.value || "";
        const amount = $("nxWithdrawAmount")?.value || "";
        const destination = String($("nxWithdrawAddress")?.value || "").trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(destination)) {
          result.innerHTML = `<span style="color:#f87171;">Enter a valid EVM destination address.</span>`;
          return;
        }
        if (destination.toLowerCase() === address.toLowerCase()) {
          result.innerHTML = `<span style="color:#f87171;">Destination is the same as your connected wallet.</span>`;
          return;
        }
        try {
          let tx;
          if (asset === chain.native.symbol) {
            const units = decimalToUnits(amount, chain.native.decimals);
            tx = { from: address, to: destination, value: "0x" + units.toString(16) };
          } else {
            const token = chain.tokens[asset];
            if (!token) throw new Error(`${asset} transfer is not enabled on ${chain.name}.`);
            const units = decimalToUnits(amount, token.decimals);
            const data = "0x" + ERC20_TRANSFER + pad64(destination.slice(2).toLowerCase()) + pad64(units.toString(16));
            tx = { from: address, to: token.contract, data, value: "0x0" };
          }
          result.textContent = "Waiting for wallet confirmation...";
          const hash = await p.request({ method: "eth_sendTransaction", params: [tx] });
          result.innerHTML = `<span style="color:#22c55e;">✓ Transaction submitted.</span><br><span style="word-break:break-all;font-family:monospace;">${esc(hash)}</span><br><small>Confirmation time depends on ${esc(chain.name)}.</small>`;
          status(`<strong>Transaction submitted</strong><br>${esc(asset)} • ${esc(chain.name)}`, true);
          setTimeout(() => window.refreshNexusOnchainWallet?.(), 1800);
        } catch (e) {
          const rejected = e?.code === 4001;
          result.innerHTML = `<span style="color:#f87171;">${esc(rejected ? "Transaction cancelled in wallet." : (e?.message || "Transaction could not be submitted."))}</span>`;
        }
      });
    } catch (e) {
      modal("Wallet Connection Required", `<div style="color:#fca5a5;line-height:1.6;">${esc(e?.message || "Connect your wallet first.")}</div><button id="nxWalletConnectFromModal" type="button" style="width:100%;padding:12px;margin-top:15px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer;">Connect Wallet</button>`);
      $("nxWalletConnectFromModal")?.addEventListener("click", async () => { try { await window.connectNexusWallet?.(); closeModal(); } catch (_) {} });
    }
  }

  function install() {
    window.handleDeposit = deposit;
    window.handleWithdraw = withdraw;
    window.nexusSecureWalletWithdraw = withdraw;
    window.nexusWalletActionsVersion = "non-custodial-v3";
  }

  install();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  window.addEventListener("load", install, { once: true });
  console.log("NexusNova Wallet Actions V3 loaded — non-custodial wallet-native transfers active.");
})();