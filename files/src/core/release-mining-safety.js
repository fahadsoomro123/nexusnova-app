import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { claimDailyRewardCloudflare } from './nova-mining-rewards-store.js';
import { firebaseApp, requireFirebaseUser } from './firebase-backend.js';
import { nativeAds } from './native-ads.js';

const functions = getFunctions(firebaseApp, 'us-central1');
let busyDaily = false;
let busySupportAd = false;
let busyVault10x = false;

function text(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function patchVisibleCopy(root = document) {
  const watch = root.querySelector?.('[data-watch-ad]');
  if (watch) text(watch, 'WATCH AD');
  const watchStatus = root.querySelector?.('[data-watch-status]');
  if (watchStatus) text(watchStatus, 'Optional support ad • no NVX or mining reward.');

  const dailyStatus = root.querySelector?.('[data-daily-status]');
  if (dailyStatus && /TEST rewarded ad|current gate/i.test(dailyStatus.textContent || '')) {
    text(dailyStatus, 'Daily Reward is ready • secure server claim, no ad required.');
  }

  const vaultButton = root.querySelector?.('[data-vault-watch]');
  if (vaultButton) text(vaultButton, 'OPEN 10X');
  const badge = root.querySelector?.('.nx-vault-life-badge span');
  if (badge) text(badge, 'Milestone premium pool');
  const hint = root.querySelector?.('.nx-vault-life-hint');
  if (hint && /10X weighted premium pool|Normal:/i.test(hint.textContent || '')) {
    hint.innerHTML = '<b>Normal:</b> NVX 60 • Booster 18 • Rain 17 • Warp 5 &nbsp; · &nbsp; <em>10X: Booster 45 • Rain 42.5 • Warp 12.5</em>';
  }
}

function statusFor(button, selector) {
  return button?.closest('.nx-app-body, .nx-vault-life, [data-app-mount], .nx-screen')?.querySelector(selector)
    || document.querySelector(selector);
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

function waitForSupportAd(status) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok, message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      off();
      if (message) text(status, message);
      ok ? resolve() : reject(new Error(message || 'Ad unavailable.'));
    };
    const off = nativeAds.subscribe(detail => {
      const type = String(detail?.event || '');
      const placement = String(detail?.placement || '');
      if (placement && placement !== 'tasks-support') return;
      if (type === 'interstitial-opened') text(status, 'Ad opened • thank you for supporting NexusNova.');
      else if (type === 'interstitial-dismissed') finish(true, '✓ Thanks for supporting NexusNova.');
      else if (type === 'interstitial-skipped') finish(false, detail?.reason === 'cooldown' ? 'Ad cooldown active. Try again later.' : 'Ad is not available right now.');
      else if (type === 'interstitial-failed' || type === 'interstitial-unavailable') finish(false, 'Ad is not available right now.');
    });
    const timer = setTimeout(() => finish(false, 'Ad request timed out.'), 20_000);
  });
}

async function showSupportAd(button) {
  if (busySupportAd) return;
  busySupportAd = true;
  button.disabled = true;
  const status = statusFor(button, '[data-watch-status]');
  text(status, 'Preparing ad…');
  try {
    await nativeAds.waitForInterstitialReady(8_000);
    const pending = waitForSupportAd(status);
    if (!nativeAds.showInterstitial({ placement:'tasks-support', feature:'' })) {
      throw new Error('Ads require the NexusNova Android app.');
    }
    await pending;
  } catch (error) {
    text(status, error?.message || 'Ad is not available right now.');
  } finally {
    busySupportAd = false;
    button.disabled = false;
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
    showSupportAd(watch);
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
patchVisibleCopy(document);
nativeAds.requestStatus();
