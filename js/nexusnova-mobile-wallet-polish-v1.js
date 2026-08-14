/* NexusNova Mobile + Wallet Polish v1
   UI-only layer: no wallet provider or balance logic is replaced. */
(() => {
  "use strict";
  if (window.__nxMobileWalletPolishV1) return;
  window.__nxMobileWalletPolishV1 = true;

  const ZERO_PREF = "nexusnova_wallet_hide_zero_v1";
  const $ = id => document.getElementById(id);

  function installStyles(){
    if (document.getElementById("nxMobileWalletPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "nxMobileWalletPolishStyles";
    style.textContent = `
      html,body{scroll-behavior:smooth!important;overscroll-behavior-y:contain}
      body{touch-action:pan-y;-webkit-tap-highlight-color:transparent}
      .main,.wallet-assets-scroll,.chat-box,.ai-box,.nx-scripture-reader,.more-menu.show{
        scroll-behavior:smooth!important;-webkit-overflow-scrolling:touch
      }
      .bottom-dock{transform:translateZ(0);backface-visibility:hidden;will-change:transform}
      .dock-item,.more-item,.action-btn,.refresh-btn{touch-action:manipulation}
      .mi-icon svg{transform:scale(.88);transform-origin:center}
      #tab-wallet .coin-row .mi-icon svg{transform:scale(.84)}
      #nxHideZeroBalances{display:inline-flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}
      #nxHideZeroBalances.active{
        color:#fff!important;border-color:rgba(57,180,255,.7)!important;
        background:linear-gradient(135deg,#116ce7,#27a3ff)!important;
        box-shadow:0 8px 20px rgba(22,126,255,.22)
      }
      @media(max-width:700px){
        body{padding-bottom:118px!important}
        .bottom-dock{
          left:8px!important;right:8px!important;bottom:12px!important;border-radius:19px!important;
          overflow:hidden!important;box-shadow:0 12px 30px rgba(0,0,0,.45),0 0 0 1px rgba(85,159,255,.18)!important
        }
        .dock-inner{padding:2px 3px 4px!important}
        .dock-item{padding:8px 2px 7px!important;min-height:58px!important}
        .dock-item .mi-icon{margin-bottom:1px!important}
        .more-menu{bottom:88px!important}
        .more-menu.show{max-height:calc(100dvh - 112px)!important;overflow-y:auto!important}
        .main{padding-bottom:22px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function getWalletParts(){
    const wallet = $("tab-wallet");
    const list = $("walletAssetList");
    if (!wallet || !list) return {};
    const assetCard = list.closest(".card");
    const actionCard = [...wallet.querySelectorAll(":scope > .card")].find(card =>
      /wallet actions/i.test(card.querySelector("h3")?.textContent || "")
    );
    return { wallet, list, assetCard, actionCard };
  }

  function moveWalletActionsAboveAssets(){
    const { assetCard, actionCard } = getWalletParts();
    if (!assetCard || !actionCard || assetCard.parentNode !== actionCard.parentNode) return;
    if (actionCard.nextElementSibling !== assetCard) {
      assetCard.parentNode.insertBefore(actionCard, assetCard);
    }
  }

  function readBalance(row){
    const explicit = row.querySelector(".wallet-live-balance,[data-balance],.wallet-balance,.asset-balance,.wallet-asset-balance");
    const explicitText = String(explicit?.textContent || "").trim();
    if (explicitText) {
      const match = explicitText.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
      if (match) return Number(match[0]);
    }

    const right = row.lastElementChild;
    if (!right) return null;
    const lines = String(right.innerText || right.textContent || "")
      .split(/\n+/).map(v => v.trim()).filter(Boolean).reverse();
    for (const line of lines) {
      if (/^[≈$]/.test(line)) continue;
      const match = line.replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s+\S+/);
      if (match) return Number(match[1]);
    }
    return null;
  }

  function applyZeroFilter(){
    const { list } = getWalletParts();
    if (!list) return;
    const enabled = localStorage.getItem(ZERO_PREF) === "1";
    const btn = $("nxHideZeroBalances");
    if (btn) {
      btn.setAttribute("aria-pressed", enabled ? "true" : "false");
      btn.classList.toggle("active", enabled);
      const label = btn.querySelector("span:last-child");
      if (label) label.textContent = enabled ? "Show all" : "Hide zero";
    }
    list.querySelectorAll(":scope > .coin-row").forEach(row => {
      const amount = readBalance(row);
      row.style.display = enabled && amount !== null && Math.abs(amount) < 1e-12 ? "none" : "";
    });
  }

  function ensureZeroToggle(){
    const { assetCard } = getWalletParts();
    if (!assetCard || $("nxHideZeroBalances")) return;
    const header = assetCard.querySelector(".market-header") || assetCard;
    const btn = document.createElement("button");
    btn.id = "nxHideZeroBalances";
    btn.type = "button";
    btn.className = "refresh-btn";
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = '<span class="mi-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 4l16 16"/></svg></span><span>Hide zero</span>';
    const refresh = header.querySelector(".refresh-btn");
    if (refresh?.parentNode === header) header.insertBefore(btn, refresh);
    else header.appendChild(btn);
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("aria-pressed") !== "true";
      localStorage.setItem(ZERO_PREF, next ? "1" : "0");
      applyZeroFilter();
    });
  }

  function install(){
    installStyles();
    moveWalletActionsAboveAssets();
    ensureZeroToggle();
    applyZeroFilter();

    const { list } = getWalletParts();
    if (list && !list.__nxPolishObserver) {
      const observer = new MutationObserver(() => {
        moveWalletActionsAboveAssets();
        ensureZeroToggle();
        applyZeroFilter();
      });
      observer.observe(list, { childList:true, subtree:true, characterData:true });
      list.__nxPolishObserver = observer;
    }
  }

  window.nexusApplyWalletZeroFilter = applyZeroFilter;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once:true });
  else install();
  window.addEventListener("load", () => setTimeout(install, 250), { once:true });
  setTimeout(install, 1200);
})();
