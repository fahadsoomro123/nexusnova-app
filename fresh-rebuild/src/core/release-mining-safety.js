import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { claimDailyRewardCloudflare } from './nova-mining-rewards-store.js';
import { firebaseApp, requireFirebaseUser } from './firebase-backend.js';
import { nativeAds } from './native-ads.js';
import { adPolicy } from './ad-policy.js';

const functions = getFunctions(firebaseApp, 'us-central1');
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
    text(dailyStatus, 'Daily Reward is ready • secure server claim, no ad required.');
  }

  const vaultButton = root.querySelector?.('[data-vault-watch]');
  if (vaultButton) text(vaultButton, 'OPEN 10X');
  const badge = root.querySelector?.('.nx-vault-life-badge span');
  if (badge) text(badge, 'Milestone premium pool');
  const hint = root.querySelector?.('.nx-vault-life-hint');
  const hintText = hint?.textContent || '';
  if (hint && !/10X:\s*Booster\s*45\b/i.test(hintText)) {
    hint.innerHTML = '<b>Normal:</b> NVX 60 • Booster 18 • Rain 17 • Warp 5 &nbsp; · &nbsp; <em>10X: Booster 45 • Rain 42.5 • Warp 12.5</em>';
  }
}

function statusFor(button, selector) {
  return button?.closest('.nx-app-body, .nx-vault-life, [data-app-mount], .nx-screen')?.querySelector(selector)
    || document.querySelector(selector);
}

function cleanCallableError(error, fallback) {
  const raw = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
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
  text(status, 'Confirming Daily Reward with secure server…');
  try {
    const data = await claimDailyRewardCloudflare({ source:'fresh-rebuild-release-direct' });
    const reward = Number(data?.reward);
    const balance = Number(data?.balance);
    if (!(reward > 0) || !Number.isFinite(balance)) throw new Error('Secure Daily Reward response was invalid.');
    text(status, `✓ +${reward} NVX confirmed by secure server.`);
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
    const user = await requireFirebaseUser({ verified:true });
    text(status, nativeAds.status().testMode ? 'Opening Google TEST rewarded ad…' : 'Opening rewarded ad…');
    const result = await nativeAds.showRewarded({ purpose:'task-watch-ad', userId:user.uid });
    if (!result.earned) {
      text(status, 'Ad closed before completion. No NVX or mining reward was changed.');
      return;
    }
    text(status, nativeAds.status().testMode || result.testMode
      ? '✓ TEST rewarded ad completed. No NVX or mining reward was credited.'
      : '✓ Rewarded ad completed. No NVX or mining reward was credited.');
  } catch (error) {
    text(status, error?.message || 'Rewarded ad unavailable.');
  } finally {
    busySupportAd = false;
    button.disabled = false;
  }
}

async function runVaultAction(button, { name, data = {}, label, adAction, rewardResult = false } = {}) {
  if (busyVaultAction || button.disabled) return;
  busyVaultAction = true;
  const status = statusFor(button, '[data-vault-status]');
  text(status, `${label} • secure request…`);
  try {
    await requireFirebaseUser({ write:true });
    const call = httpsCallable(functions, name);
    const response = await call(data);
    const result = response?.data || {};
    text(status, rewardResult
      ? `✓ ${rewardLabel(result.reward)} received.`
      : `✓ ${label} completed.`);
    await adPolicy.showMiningActionAd(adAction);
  } catch (error) {
    text(status, cleanCallableError(error, `${label} could not be completed.`));
  } finally {
    busyVaultAction = false;
  }
}

async function openMilestone10x(button) {
  if (busyVault10x || button.disabled) return;
  busyVault10x = true;
  button.disabled = true;
  const status = statusFor(button, '[data-vault-status]');
  text(status, 'Opening earned 10X Vault…');
  try {
    await requireFirebaseUser({ write:true });
    const call = httpsCallable(functions, 'openNovaVaultBoosted');
    const response = await call({ source:'normal-vault-milestone' });
    const reward = response?.data?.reward || {};
    const label = String(reward.type || 'premium reward').replace(/-/g, ' ');
    text(status, `✓ 10X ${label} received.`);
    await adPolicy.showMiningActionAd('vault-10x');
  } catch (error) {
    const raw = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
    text(status, raw || '10X credit is not ready yet. Open normal Vaults to earn it.');
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
      name:'openNovaVault',
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
      name:'useNovaBoost',
      data:{ kind:'booster' },
      label:'Booster',
      adAction:'booster-use'
    });
    return;
  }

  const rain = target.closest('[data-vault-rain-use]');
  if (rain) {
    event.preventDefault();
    event.stopImmediatePropagation();
    runVaultAction(rain, {
      name:'useNovaBoost',
      data:{ kind:'rain' },
      label:'Nova Rain',
      adAction:'rain-use'
    });
    return;
  }

  const warp = target.closest('[data-vault-warp-use]');
  if (warp) {
    event.preventDefault();
    event.stopImmediatePropagation();
    runVaultAction(warp, {
      name:'useNovaTimeWarp',
      label:'Time Warp',
      adAction:'time-warp-use'
    });
    return;
  }

  const vault10x = target.closest('[data-vault-watch]');
  if (vault10x) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openMilestone10x(vault10x);
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
