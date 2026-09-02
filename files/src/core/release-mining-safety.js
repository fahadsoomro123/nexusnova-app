import {
  claimDailyRewardCloudflare,
  openNovaVaultCloudflare,
  openNovaVaultBoostedCloudflare,
  useNovaBoostCloudflare,
  useNovaTimeWarpCloudflare
} from './nova-mining-rewards-store.js';
import { requireFirebaseUser } from './firebase-backend.js';
import { nativeAds } from './native-ads.js';
import { adPolicy } from './ad-policy.js';

let busyDaily = false;
let busySupportAd = false;
let busyVault10x = false;
let busyVaultAction = false;

function text(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function adCopy() {
  return nativeAds.status().testMode
    ? 'TEST rewarded ad • no NVX or mining reward.'
    : 'Optional rewarded ad • no NVX or mining reward.';
}

function patchVisibleCopy(root = document) {
  const watch = root.querySelector?.('[data-watch-ad]');
  if (watch) text(watch, nativeAds.status().testMode ? 'WATCH TEST AD' : 'WATCH AD');
  const watchStatus = root.querySelector?.('[data-watch-status]');
  if (watchStatus && !/Preparing|Opening|completed|closed|unavailable|timed out/i.test(watchStatus.textContent || '')) text(watchStatus, adCopy());

  const dailyStatus = root.querySelector?.('[data-daily-status]');
  if (dailyStatus && /TEST rewarded ad|current gate/i.test(dailyStatus.textContent || '')) {
    text(dailyStatus, 'Daily Reward is ready • secure Cloudflare claim, no ad required.');
  }

  const vaultButton = root.querySelector?.('[data-vault-watch]');
  if (vaultButton) text(vaultButton, 'OPEN 10X');
  const badge = root.querySelector?.('.nx-vault-life-badge span');
  if (badge) text(badge, 'Better odds');
  const hint = root.querySelector?.('.nx-vault-life-hint');
  const hintText = hint?.textContent || '';
  if (hint && !/10X:\s*NVX\s*13\b/i.test(hintText)) {
    hint.innerHTML = '<b>Normal:</b> NVX 60 • Booster 18 • Rain 17 • Warp 5 &nbsp; · &nbsp; <em>10X: NVX 13 • Booster 39 • Rain 37 • Warp 11</em>';
  }
}

function statusFor(button, selector) {
  return button?.closest('.nx-app-body, .nx-vault-life, [data-app-mount], .nx-screen')?.querySelector(selector)
    || document.querySelector(selector);
}

function cleanCloudflareError(error, fallback) {
  const raw = String(error?.message || '').replace(/^Cloudflare:\s*/i, '').trim();
  return raw || fallback;
}

function rewardLabel(reward = {}) {
  const type = String(reward.type || 'reward').replace(/-/g, ' ');
  const amount = Number(reward.amount);
  return Number.isFinite(amount) && amount > 0 ? `${type} ${amount}` : type;
}

async function directDailyClaim(button) {
  if (busyDaily || button.disabled) return;
  busyDaily = true;
  button.disabled = true;
  const status = statusFor(button, '[data-daily-status]');
  text(status, 'Confirming Daily Reward with Cloudflare…');
  try {
    const data = await claimDailyRewardCloudflare({ source:'fresh-rebuild-cloudflare-v2' });
    const reward = Number(data?.reward);
    const balance = Number(data?.balance);
    if (!(reward > 0) || !Number.isFinite(balance)) throw new Error('Secure Daily Reward response was invalid.');
    text(status, `✓ +${reward} NVX confirmed by Cloudflare.`);
  } catch (error) {
    text(status, error?.message || 'Daily Reward could not be completed.');
    button.disabled = false;
  } finally {
    busyDaily = false;
  }
}

async function showSupportRewardedAd(button) {
  if (busySupportAd) return;
  busySupportAd = true;
  button.disabled = true;
  const status = statusFor(button, '[data-watch-status]');
  text(status, 'Preparing rewarded ad…');
  try {
    const testMode = nativeAds.status().testMode === true;
    let userId = '';

    // TEST rewarded ads are diagnostics only and credit no value, so they must
    // remain testable even while Firebase/Auth/App Check is having an outage.
    if (!testMode) {
      const user = await requireFirebaseUser({ verified:true });
      userId = user.uid;
    }

    text(status, testMode ? 'Opening Google TEST rewarded ad…' : 'Opening rewarded ad…');
    const result = await nativeAds.showRewarded({ purpose:'task-watch-ad', userId });
    if (!result.earned) {
      text(status, 'Ad closed before completion. No NVX or mining reward was changed.');
      return;
    }
    text(status, testMode || result.testMode
      ? '✓ TEST rewarded ad completed. No NVX or mining reward was credited.'
      : '✓ Rewarded ad completed. No NVX or mining reward was credited.');
  } catch (error) {
    text(status, error?.message || 'Rewarded ad unavailable.');
  } finally {
    busySupportAd = false;
    button.disabled = false;
  }
}

async function runVaultAction(button, { call, data = {}, label, adAction, rewardResult = false, boostHours = 0 } = {}) {
  if (busyVaultAction || button.disabled || typeof call !== 'function') return;
  busyVaultAction = true;
  button.disabled = true;
  const status = statusFor(button, '[data-vault-status]');
  text(status, `${label} • Cloudflare secure request…`);
  try {
    const result = await call(data);
    if (boostHours > 0) {
      const startedAt = Number(result?.miningStartedAt);
      const remainingInventory = Number(result?.inventory?.[data?.kind === 'rain' ? 'rain' : 'booster']);
      if (!Number.isFinite(startedAt) || startedAt <= 0 || !Number.isFinite(remainingInventory) || remainingInventory < 0) {
        throw new Error(`Secure ${label} response was invalid. No success was confirmed.`);
      }
      text(status, `✓ ${label} applied • mining timer −${boostHours}h • ${remainingInventory} left.`);
    } else {
      text(status, rewardResult
        ? `✓ ${rewardLabel(result.reward)} received.`
        : `✓ ${label} completed.`);
    }
    await adPolicy.showMiningActionAd(adAction);
  } catch (error) {
    text(status, cleanCloudflareError(error, `${label} could not be completed.`));
  } finally {
    busyVaultAction = false;
    button.disabled = false;
  }
}

async function open10x(button) {
  if (busyVault10x || button.disabled) return;
  busyVault10x = true;
  button.disabled = true;
  const status = statusFor(button, '[data-vault-status]');
  text(status, 'Opening 10X Vault through Cloudflare…');
  try {
    const result = await openNovaVaultBoostedCloudflare({ source:'fresh-rebuild-cloudflare-v2' });
    text(status, `✓ 10X ${rewardLabel(result?.reward || {})} received.`);
    await adPolicy.showMiningActionAd('vault-10x');
  } catch (error) {
    text(status, cleanCloudflareError(error, '10X Vault could not be completed.'));
  } finally {
    busyVault10x = false;
    button.disabled = false;
  }
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const daily = target.closest('[data-daily-claim]');
  if (daily) {
    event.preventDefault();
    event.stopImmediatePropagation();
    directDailyClaim(daily);
    return;
  }

  const watch = target.closest('[data-watch-ad]');
  if (watch) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showSupportRewardedAd(watch);
    return;
  }

  const normalVault = target.closest('[data-vault-open]');
  if (normalVault) {
    event.preventDefault();
    event.stopImmediatePropagation();
    runVaultAction(normalVault, {
      call:openNovaVaultCloudflare,
      label:'Vault',
      adAction:'vault-open',
      rewardResult:true
    });
    return;
  }

  const booster = target.closest('[data-vault-boost]');
  if (booster) {
    event.preventDefault();
    event.stopImmediatePropagation();
    runVaultAction(booster, {
      call:useNovaBoostCloudflare,
      data:{ kind:'booster' },
      label:'Booster',
      adAction:'booster-use',
      boostHours:2
    });
    return;
  }

  const rain = target.closest('[data-vault-rain-use]');
  if (rain) {
    event.preventDefault();
    event.stopImmediatePropagation();
    runVaultAction(rain, {
      call:useNovaBoostCloudflare,
      data:{ kind:'rain' },
      label:'Nova Rain',
      adAction:'rain-use',
      boostHours:2
    });
    return;
  }

  const warp = target.closest('[data-vault-warp-use]');
  if (warp) {
    event.preventDefault();
    event.stopImmediatePropagation();
    runVaultAction(warp, {
      call:useNovaTimeWarpCloudflare,
      label:'Time Warp',
      adAction:'time-warp-use'
    });
    return;
  }

  const vault10x = target.closest('[data-vault-watch]');
  if (vault10x) {
    event.preventDefault();
    event.stopImmediatePropagation();
    open10x(vault10x);
  }
}, true);

const observer = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node instanceof Element) patchVisibleCopy(node);
    }
  }
  patchVisibleCopy(document);
});
observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });

nativeAds.subscribe(detail => {
  if (String(detail?.event || '') === 'status') patchVisibleCopy(document);
});
patchVisibleCopy(document);
nativeAds.requestStatus();
