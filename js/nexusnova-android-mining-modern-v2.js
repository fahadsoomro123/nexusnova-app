/* NexusNova Android Mining Modern v3
   Presentation-only Android polish. Reads secure mining/Vault state but never
   writes timestamps, balances, rewards, Firestore, or ad outcomes. */
(() => {
  'use strict';
  if (window.__nxAndroidMiningModernV2) return;
  window.__nxAndroidMiningModernV2 = true;
  window.nexusAndroidMiningModernVersion = 'mining-modern-v3-visible';

  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const STYLE_ID = 'nxAndroidMiningModernV2Style';
  const PULSE_ID = 'nxMiningSessionPulseV2';
  const MINE_RAIL_ID = 'nxModernMineRail';
  let latestVault = { pendingVaults:0 };
  let renderTimer = null;

  const $ = id => document.getElementById(id);

  function installStyle(){
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PULSE_ID}{margin:10px auto 14px;width:min(100%,560px);padding:11px 12px;border:1px solid rgba(74,166,255,.25);border-radius:18px;background:radial-gradient(circle at 90% 0%,rgba(53,180,255,.13),transparent 38%),linear-gradient(135deg,rgba(4,15,31,.94),rgba(7,27,49,.88));box-shadow:inset 0 1px rgba(255,255,255,.045),0 13px 30px rgba(0,0,0,.22);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#dff2ff;min-height:58px}
      .nx-mp-row{display:flex;align-items:center;justify-content:space-between;gap:9px;min-width:0}.nx-mp-label{display:flex;align-items:center;gap:7px;min-width:0;font-size:9px;font-weight:950;letter-spacing:.13em;color:#9cc9ef;white-space:nowrap}.nx-mp-dot{width:7px;height:7px;border-radius:50%;background:#29d98a;box-shadow:0 0 13px rgba(41,217,138,.75)}.nx-mp-dot.syncing{background:#5aa9ff;box-shadow:0 0 13px rgba(65,155,255,.7);animation:nxPulseDot 1s ease-in-out infinite}.nx-mp-chips{display:flex;justify-content:flex-end;gap:5px;flex-wrap:wrap}.nx-mp-chip{padding:4px 7px;border-radius:999px;border:1px solid rgba(97,183,255,.19);background:rgba(33,117,194,.10);font-size:8px;font-weight:900;letter-spacing:.04em;color:#a8d7ff;white-space:nowrap}.nx-mp-chip.boost{border-color:rgba(90,223,255,.24);background:rgba(21,163,200,.11);color:#75e9ff}.nx-mp-chip.vault{border-color:rgba(200,133,255,.24);background:rgba(145,70,220,.11);color:#dab2ff}.nx-mp-chip.warn{border-color:rgba(255,202,103,.22);background:rgba(255,174,49,.09);color:#ffd68e}
      .nx-mp-track{height:6px;margin-top:9px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}.nx-mp-track i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#248cff,#2edcb4);box-shadow:0 0 12px rgba(52,190,255,.34);transition:width .45s ease}.nx-mp-foot{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:8px;color:#6d8da9}.nx-mp-foot strong{color:#a3d5f7;font-weight:850}
      #mineBtn{position:relative!important;overflow:hidden!important}#${MINE_RAIL_ID}{position:absolute;left:24px;right:24px;bottom:9px;height:4px;border-radius:999px;background:rgba(255,255,255,.13);overflow:hidden;pointer-events:none;z-index:3}#${MINE_RAIL_ID} i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5bc9ff,#50f1c2);box-shadow:0 0 13px rgba(70,230,214,.48);transition:width .45s ease}.nx-modern-live-chip{position:absolute;right:14px;top:12px;z-index:3;padding:4px 7px;border-radius:999px;border:1px solid rgba(120,236,210,.24);background:rgba(16,120,102,.16);color:#8ff4d8;font-size:7px;font-weight:950;letter-spacing:.09em;pointer-events:none}.nx-modern-live-chip.sync{border-color:rgba(97,183,255,.22);background:rgba(28,98,170,.16);color:#9acfff}
      @keyframes nxPulseDot{50%{opacity:.4;transform:scale(.8)}}
      @media(max-width:700px){body .bottom-dock{left:10px!important;right:10px!important;bottom:10px!important;border-radius:22px!important;overflow:hidden!important;padding:0!important;max-height:82px!important;background:rgba(1,6,13,.965)!important;backdrop-filter:blur(20px) saturate(125%)!important;-webkit-backdrop-filter:blur(20px) saturate(125%)!important}body .bottom-dock .dock-inner{height:72px!important;padding:4px!important;align-items:stretch!important}body .bottom-dock .dock-item{min-height:64px!important;height:64px!important;padding:6px 2px 5px!important;border-radius:17px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;line-height:1!important}body .bottom-dock .dock-item span{font-size:9px!important;margin-top:3px!important;letter-spacing:.02em!important}.bottom-dock .dock-item .mi-icon{margin:0!important;line-height:1!important}body{padding-bottom:calc(148px + env(safe-area-inset-bottom))!important}body .main{padding-bottom:calc(148px + env(safe-area-inset-bottom))!important}#${PULSE_ID}{border-radius:16px;padding:10px}.nx-mp-label{font-size:8px}.nx-mp-chip{font-size:7px;padding:4px 6px}}
      @media(max-width:390px){.nx-mp-row{align-items:flex-start;flex-direction:column}.nx-mp-chips{justify-content:flex-start}.nx-mp-foot{font-size:7px}.nx-modern-live-chip{right:10px;top:10px}}
      @media(prefers-reduced-motion:reduce){.nx-mp-track i,#${MINE_RAIL_ID} i{transition:none!important}.nx-mp-dot.syncing{animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureMineChrome(){
    const button = $('mineBtn');
    if (!button) return;
    if (!button.querySelector('.nx-modern-live-chip')) {
      const chip = document.createElement('span');
      chip.className = 'nx-modern-live-chip sync';
      chip.id = 'nxModernLiveChip';
      chip.textContent = 'SECURE SYNC';
      button.appendChild(chip);
    }
    if (!$(MINE_RAIL_ID)) {
      const rail = document.createElement('span');
      rail.id = MINE_RAIL_ID;
      rail.innerHTML = '<i id="nxModernMineRailFill"></i>';
      button.appendChild(rail);
    }
  }

  function ensurePulse(){
    installStyle();
    ensureMineChrome();
    let pulse = $(PULSE_ID);
    const timer = $('timer');
    if (!timer?.parentNode) return pulse || null;
    if (!pulse) {
      pulse = document.createElement('section');
      pulse.id = PULSE_ID;
      pulse.setAttribute('aria-label','Mining session status');
      pulse.innerHTML = `<div class="nx-mp-row"><div class="nx-mp-label"><i class="nx-mp-dot syncing" id="nxMpDot"></i><span id="nxMpLabel">RESTORING SECURE SESSION</span></div><div class="nx-mp-chips" id="nxMpChips"><span class="nx-mp-chip">SYNCING</span></div></div><div class="nx-mp-track" aria-hidden="true"><i id="nxMpProgress"></i></div><div class="nx-mp-foot"><span id="nxMpProgressText">Loading authoritative mining state…</span><strong id="nxMpSyncText">FIRESTORE</strong></div>`;
      timer.insertAdjacentElement('afterend', pulse);
    }
    // Other modules also insert after #timer. Keep Session Pulse directly above
    // Nova Time Boosts on every render so the modernization is always visible.
    const boostPanel = $('nxMiningBoostPanel');
    if (boostPanel?.parentNode && pulse.parentNode === boostPanel.parentNode && pulse.nextElementSibling !== boostPanel) {
      boostPanel.parentNode.insertBefore(pulse, boostPanel);
    }
    return pulse;
  }

  function testRewardStatus(){ try { return window.NexusNovaTestRewards?.status?.() || {}; } catch (_) { return {}; } }
  function miningStatus(){ try { return window.nexusSecureMiningState?.() || {}; } catch (_) { return {}; } }
  function vaultCount(){ const test=Math.max(0,Math.floor(Number(testRewardStatus().pendingVaults)||0)); const real=Math.max(0,Math.floor(Number(latestVault.pendingVaults??latestVault.pending??0)||0)); return test+real; }

  function render(){
    const pulse = ensurePulse();
    if (!pulse) return;
    const state = miningStatus();
    const known = state.known === true;
    const active = state.active === true || state.miningActive === true;
    const startedAt = Number(state.startedAt ?? state.miningStartedAt) || 0;
    const previewOffset = Math.max(0, Number(state.previewOffsetMs) || 0);
    const vaults = vaultCount();
    const chip = $('nxModernLiveChip');
    const dot = $('nxMpDot');

    if (!known) {
      pulse.style.display='';
      if ($('nxMpLabel')) $('nxMpLabel').textContent='RESTORING SECURE SESSION';
      if ($('nxMpChips')) $('nxMpChips').innerHTML='<span class="nx-mp-chip">SYNCING</span>';
      if ($('nxMpProgress')) $('nxMpProgress').style.width='18%';
      if ($('nxMpProgressText')) $('nxMpProgressText').textContent='Loading authoritative mining state…';
      if ($('nxMpSyncText')) $('nxMpSyncText').textContent='FIRESTORE';
      dot?.classList.add('syncing');
      if(chip){chip.textContent='SECURE SYNC';chip.classList.add('sync');}
      return;
    }

    dot?.classList.remove('syncing');
    if (!active || startedAt <= 0) {
      pulse.style.display='';
      if ($('nxMpLabel')) $('nxMpLabel').textContent='MINING READY';
      if ($('nxMpChips')) $('nxMpChips').innerHTML='<span class="nx-mp-chip">SECURE READY</span>';
      if ($('nxMpProgress')) $('nxMpProgress').style.width='0%';
      if ($('nxMpProgressText')) $('nxMpProgressText').textContent='Start a 24H session when ready';
      if ($('nxMpSyncText')) $('nxMpSyncText').textContent='FIRESTORE VERIFIED';
      if ($('nxModernMineRailFill')) $('nxModernMineRailFill').style.width='0%';
      if(chip){chip.textContent='SECURE READY';chip.classList.remove('sync');}
      return;
    }

    const authoritativeElapsed = Math.max(0, Date.now() - startedAt);
    const effectiveElapsed = Math.min(DAY, authoritativeElapsed + previewOffset);
    const percent = Math.max(0, Math.min(100, (effectiveElapsed / DAY) * 100));
    const securePercent = Math.max(0, Math.min(100, (authoritativeElapsed / DAY) * 100));
    const boostHours = Math.round(previewOffset / HOUR);
    const chips = ['<span class="nx-mp-chip">SYNCED</span>'];
    if (boostHours > 0) chips.push(`<span class="nx-mp-chip boost">TEST BOOST −${boostHours}H</span>`);
    if (vaults > 0) chips.push(`<span class="nx-mp-chip vault">${vaults} VAULT${vaults===1?'':'S'} READY</span>`);
    if (effectiveElapsed >= DAY && authoritativeElapsed < DAY) chips.push('<span class="nx-mp-chip warn">PREVIEW COMPLETE</span>');
    if ($('nxMpLabel')) $('nxMpLabel').textContent='SESSION PULSE';
    if ($('nxMpChips')) $('nxMpChips').innerHTML=chips.join('');
    if ($('nxMpProgress')) $('nxMpProgress').style.width=`${percent.toFixed(2)}%`;
    if ($('nxModernMineRailFill')) $('nxModernMineRailFill').style.width=`${percent.toFixed(2)}%`;
    if ($('nxMpProgressText')) $('nxMpProgressText').textContent=boostHours>0?`Effective session ${percent.toFixed(0)}% • secure ${securePercent.toFixed(0)}%`:`Session progress ${percent.toFixed(0)}%`;
    if ($('nxMpSyncText')) $('nxMpSyncText').textContent=boostHours>0?'TEST PREVIEW • SECURE CLOCK KEPT':'FIRESTORE VERIFIED';
    if(chip){chip.textContent=boostHours>0?`LIVE • −${boostHours}H`:'SECURE LIVE';chip.classList.remove('sync');}
  }

  window.addEventListener('nexusnova:nova-vault-state', event => { latestVault=event?.detail&&typeof event.detail==='object'?event.detail:latestVault; render(); });
  window.addEventListener('nexusnova:test-reward-state', render);
  window.addEventListener('nexusnova:native-ad-event', () => setTimeout(render,80));
  window.addEventListener('visibilitychange', () => { if(!document.hidden) render(); });
  window.addEventListener('pageshow', render);

  function boot(){ ensurePulse(); render(); clearInterval(renderTimer); renderTimer=setInterval(render,750); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
