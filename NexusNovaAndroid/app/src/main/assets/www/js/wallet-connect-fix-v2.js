/* NexusNova Wallet Connect FIX V2
   Only fixes external EVM wallet connection.
   Does not modify mining, prices, market, tasks, ticker, or balances.
*/

(() => {
  "use strict";

  let activeProvider = null;
  let connecting = false;
  let connectTimer = null;

  const RABBY_TIMEOUT = 12000;

  function getButton() {
    return document.getElementById("connectWalletBtn");
  }

  function setStatus(message, ok = false) {
    const el = document.getElementById("walletActionStatus");
    if (!el) return;
    el.textContent = message;
    el.style.color = ok ? "#22c55e" : "";
  }

  function shortAddress(address) {
    return address
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : "---";
  }

  const chainNames = {
    "0x1": "Ethereum Mainnet",
    "0x38": "BNB Smart Chain",
    "0x89": "Polygon",
    "0xa4b1": "Arbitrum One",
    "0xa": "Optimism",
    "0xa86a": "Avalanche C-Chain",
    "0x2105": "Base",
    "0xaa36a7": "Ethereum Sepolia"
  };

  function render(address, chainId) {
    const box = document.getElementById("connectedWalletBox");
    const addressEl = document.getElementById("connectedWalletAddress");
    const networkEl = document.getElementById("connectedWalletNetwork");
    const button = getButton();

    if (!box || !addressEl || !networkEl || !button) return;

    if (address) {
      box.style.display = "block";
      addressEl.textContent = shortAddress(address);
      networkEl.textContent =
        chainNames[String(chainId || "").toLowerCase()] ||
        (chainId ? `EVM Network • ${chainId}` : "Connected");

      button.textContent = "🔗 Wallet Connected";
      button.disabled = true;
    } else {
      box.style.display = "none";
      addressEl.textContent = "---";
      networkEl.textContent = "---";
      button.textContent = "🔗 Connect Wallet";
      button.disabled = false;
    }
  }

  function candidates() {
    const eth = window.ethereum;
    if (!eth) return [];

    const list = Array.isArray(eth.providers)
      ? eth.providers.slice()
      : [eth];

    // Rabby first when it explicitly identifies itself.
    list.sort((a, b) => {
      const ar = a?.isRabby ? 1 : 0;
      const br = b?.isRabby ? 1 : 0;
      return br - ar;
    });

    return list;
  }

  async function pickProvider() {
    const list = candidates();

    if (!list.length) {
      setStatus(
        "No browser wallet detected. Open Rabby/MetaMask in this browser."
      );
      return null;
    }

    // Prefer a provider that already has an authorized account.
    for (const p of list) {
      try {
        const accounts = await p.request({ method: "eth_accounts" });
        if (accounts?.length) return p;
      } catch (_) {}
    }

    // Otherwise prefer Rabby, then first injected provider.
    return list.find(p => p?.isRabby) || list[0];
  }

  function finishButton() {
    const button = getButton();
    if (button) {
      button.disabled = false;
      button.textContent = "🔗 Connect Wallet";
    }
  }

  async function requestWithTimeout(provider, method, params = []) {
    return await Promise.race([
      provider.request({ method, params }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Wallet request timed out. Open Rabby and approve the connection.")),
          RABBY_TIMEOUT
        )
      )
    ]);
  }

  async function connectFix() {
    if (connecting) return;

    connecting = true;

    const button = getButton();
    if (button) {
      button.disabled = true;
      button.textContent = "Connecting...";
    }

    clearTimeout(connectTimer);
    connectTimer = setTimeout(() => {
      connecting = false;
      finishButton();
      setStatus(
        "Connection timed out. Make sure Rabby is unlocked and approve the connection."
      );
    }, RABBY_TIMEOUT + 1000);

    try {
      const provider = await pickProvider();

      if (!provider) {
        throw new Error("No EVM wallet provider detected.");
      }

      activeProvider = provider;

      // IMPORTANT:
      // First check existing permission. This prevents unnecessary
      // eth_requestAccounts calls that can get stuck in embedded previews.
      let accounts = await provider.request({
        method: "eth_accounts"
      });

      if (!accounts?.length) {
        setStatus("Opening wallet approval...");

        accounts = await requestWithTimeout(
          provider,
          "eth_requestAccounts"
        );
      }

      if (!accounts?.length) {
        throw new Error("No wallet account returned.");
      }

      const address = accounts[0];
      const chainId = await requestWithTimeout(
        provider,
        "eth_chainId"
      );

      // Keep compatibility with the existing blockchain module.
      try {
        if (typeof window.disconnectNexusWallet === "function") {
          // Do not call disconnect here; only update the existing globals
          // when they are exposed by the original module.
        }
      } catch (_) {}

      // Reproduce the original module's state through its accessible UI.
      render(address, chainId);

      setStatus(
        `External wallet connected • ${shortAddress(address)} • ${
          chainNames[String(chainId).toLowerCase()] || "EVM Network"
        }`,
        true
      );

      // Save a lightweight local reference only; no private key is stored.
      try {
        localStorage.setItem(
          "nexusnova_external_wallet",
          JSON.stringify({
            address,
            chainId,
            provider: provider?.isRabby ? "Rabby" : "EVM",
            updatedAt: Date.now()
          })
        );
      } catch (_) {}

      // Tell the existing blockchain module about the connection when
      // its internal variables are exposed through the UI.
      window.nexusConnectedAddress = address;
      window.nexusConnectedChainId = chainId;

      if (typeof window.nexusOnExternalWalletConnected === "function") {
        try {
          window.nexusOnExternalWalletConnected(provider, address, chainId);
        } catch (_) {}
      }

      // Immediately refresh the visible wallet after the user connects.
      // This avoids leaving the UI on 0.000000 while the background timer waits.
      if (typeof window.refreshNexusOnchainWallet === "function") {
        try {
          await window.refreshNexusOnchainWallet();
        } catch (_) {}
      }

    } catch (error) {
      console.error("NEXUS WALLET CONNECT FIX V2:", error);

      finishButton();

      if (error?.code === 4001) {
        setStatus("Wallet connection was rejected.");
      } else {
        setStatus(
          error?.message || "Wallet connection failed. Try again."
        );
      }
    } finally {
      clearTimeout(connectTimer);
      connecting = false;
    }
  }

  function disconnectFix() {
    activeProvider = null;

    try {
      localStorage.removeItem("nexusnova_external_wallet");
    } catch (_) {}

    window.nexusConnectedAddress = null;
    window.nexusConnectedChainId = null;

    render(null, null);
    setStatus("Wallet disconnected. No blockchain transaction was sent.");
  }

  function bindProviderEvents(provider) {
    if (!provider?.on) return;

    provider.on("accountsChanged", async accounts => {
      if (!accounts?.length) {
        disconnectFix();
        return;
      }

      try {
        const chainId = await provider.request({
          method: "eth_chainId"
        });

        render(accounts[0], chainId);
        setStatus("Wallet account changed.", true);
        window.nexusConnectedAddress = accounts[0];
        window.nexusConnectedChainId = chainId;
      } catch (_) {}
    });

    provider.on("chainChanged", chainId => {
      const address = window.nexusConnectedAddress;
      if (address) {
        render(address, chainId);
        setStatus("Wallet network changed.", true);
        window.nexusConnectedChainId = chainId;
      }
    });
  }

  async function boot() {
    // Override only the connect/disconnect handlers.
    window.connectNexusWallet = connectFix;
    window.disconnectNexusWallet = disconnectFix;

    const provider = await pickProvider();
    if (!provider) return;

    activeProvider = provider;
    bindProviderEvents(provider);

    // Restore an already-authorized connection without opening a popup.
    try {
      const accounts = await provider.request({
        method: "eth_accounts"
      });

      if (accounts?.length) {
        const chainId = await provider.request({
          method: "eth_chainId"
        });

        window.nexusConnectedAddress = accounts[0];
        window.nexusConnectedChainId = chainId;
        render(accounts[0], chainId);
        setStatus("Wallet already connected.", true);
      }
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
