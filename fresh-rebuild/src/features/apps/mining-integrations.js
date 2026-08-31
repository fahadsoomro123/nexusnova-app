import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';

function communityTaskPanel() {
  const section = document.createElement('section');
  section.className = 'nx-tool-card';
  section.innerHTML = `
    <p class="nx-eyebrow">COMMUNITY TASKS</p>
    <div class="nx-setting-row"><div><strong>X campaigns</strong><span>Like · Comment · Repost · Quote repost</span></div><span class="nx-badge">COMING SOON</span></div>
    <div class="nx-setting-row"><div><strong>Telegram</strong><span>Join channel/group and verified campaign tasks</span></div><span class="nx-badge">COMING SOON</span></div>
    <div class="nx-setting-row"><div><strong>Discord</strong><span>Join server and verified community missions</span></div><span class="nx-badge">COMING SOON</span></div>
    <p class="nx-tool-meta">These mining-task slots are reserved for future NexusNova community growth. NVX will only be credited after secure server-side verification is connected; no client-only claim is enabled.</p>
  `;
  return section;
}

function enhanceMiningTasks(root) {
  const hero = root.querySelector('.nx-reward-hero');
  const eyebrow = hero?.querySelector('.nx-eyebrow');
  if (eyebrow) eyebrow.textContent = 'MINING TASKS';
  hero?.insertAdjacentElement('afterend', communityTaskPanel());
}

function rewardText(reward = {}) {
  const type = String(reward.type || 'reward').replace(/-/g, ' ');
  const amount = Number(reward.amount);
  return Number.isFinite(amount) && amount > 0 ? `${type} ${amount}` : type;
}

function enhanceMiningNovaVault(root) {
  const panel = document.createElement('section');
  panel.className = 'nx-tool-card';
  panel.innerHTML = `
    <div class="nx-list-card__head">
      <div><p class="nx-eyebrow">SECURE 10X VAULT</p><strong>10X premium reward chance</strong></div>
      <span class="nx-badge" data-10x-credits>0 CREDITS</span>
    </div>
    <p class="nx-tool-meta">A verified rewarded-ad credit unlocks one boosted Vault opening. Premium reward weights are multiplied by 10 on the secure server; the client never chooses the reward.</p>
    <div class="nx-action-row">
      <button type="button" data-10x-watch>WATCH AD FOR 10X</button>
      <button type="button" data-10x-open disabled>OPEN 10X VAULT</button>
    </div>
    <p class="nx-tool-meta" data-10x-status>Checking secure 10X credits…</p>
  `;

  const firstTool = root.querySelector('.nx-tool-card');
  firstTool?.insertAdjacentElement('beforebegin', panel);

  const creditBadge = panel.querySelector('[data-10x-credits]');
  const watchButton = panel.querySelector('[data-10x-watch]');
  const openButton = panel.querySelector('[data-10x-open]');
  const status = panel.querySelector('[data-10x-status]');
  const baseCleanup = root.__cleanup;
  let profileOff = null;
  let credits = 0;
  let busy = false;
  let active = true;

  const paint = () => {
    if (!active) return;
    creditBadge.textContent = `${credits} CREDIT${credits === 1 ? '' : 'S'}`;
    creditBadge.classList.toggle('good', credits > 0);
    watchButton.disabled = busy;
    openButton.disabled = busy || credits < 1;
    openButton.textContent = credits > 0 ? `OPEN 10X VAULT (${credits})` : 'OPEN 10X VAULT';
  };

  const bindCredits = async () => {
    try {
      const user = await requireFirebaseUser();
      if (!active) return;
      const unsubscribe = onSnapshot(doc(firestoreDb, 'users', user.uid), snap => {
        if (!active) return;
        credits = Math.max(0, Math.floor(Number(snap.data()?.novaVaultBoostCredits) || 0));
        paint();
        if (!busy) status.textContent = credits > 0
          ? 'Secure 10X credit ready. One pending Nova Vault is also required.'
          : 'Watch the rewarded ad to unlock a secure 10X credit.';
      }, error => {
        if (active) status.textContent = error?.message || 'Could not read 10X credit status.';
      });
      if (!active) unsubscribe();
      else profileOff = unsubscribe;
    } catch (error) {
      if (active) status.textContent = error?.message || 'Could not read 10X credit status.';
    }
  };

  const waitForCredit = async before => {
    const deadline = Date.now() + 12_000;
    while (active && Date.now() < deadline) {
      if (credits > before) return true;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    return active && credits > before;
  };

  watchButton.addEventListener('click', async () => {
    if (!active || busy) return;
    busy = true;
    paint();
    try {
      const user = await requireFirebaseUser({ write:true });
      const before = credits;
      if (active) status.textContent = 'Opening rewarded ad for secure 10X verification…';
      const result = await nativeAds.showRewarded({ purpose:'nova-vault-10x', userId:user.uid });
      if (!result.earned) throw new Error('Ad closed before reward completion. No 10X credit was created.');
      if (!active) return;
      if (result.testMode || nativeAds.status().testMode) {
        status.textContent = '✓ TEST ad completed. TEST ads do not create secure 10X credits; production SSV verification is required.';
        return;
      }
      status.textContent = 'Ad completed • waiting for signed server verification…';
      const verified = await waitForCredit(before);
      if (!active) return;
      if (!verified) throw new Error('The signed 10X credit has not arrived yet. Check again shortly; no client-side credit was created.');
      status.textContent = '✓ Secure 10X credit verified. You can open the boosted Vault now.';
    } catch (error) {
      if (active) status.textContent = error?.message || '10X rewarded flow could not be completed.';
    } finally {
      busy = false;
      paint();
    }
  });

  openButton.addEventListener('click', async () => {
    if (!active || busy || credits < 1) return;
    busy = true;
    paint();
    if (active) status.textContent = 'Opening boosted Vault on the secure server…';
    try {
      await requireFirebaseUser({ write:true });
      const call = httpsCallable(getFunctions(firebaseApp, 'us-central1'), 'openNovaVaultBoosted');
      const response = await call({ source:'fresh-rebuild-10x' });
      const data = response?.data || {};
      if (data.opened !== true || data.boosted !== true) throw new Error('Secure 10X Vault response was invalid.');
      if (active) status.textContent = `✓ 10X Vault opened • ${rewardText(data.reward)}.`;
    } catch (error) {
      if (active) status.textContent = String(error?.message || error).replace(/^FirebaseError:\s*/i, '').slice(0, 260);
    } finally {
      busy = false;
      paint();
    }
  });

  nativeAds.requestStatus();
  bindCredits();
  paint();
  root.__cleanup = () => {
    active = false;
    profileOff?.();
    profileOff = null;
    baseCleanup?.();
  };
}

export function enhanceMiningApp(id, root) {
  if (!(root instanceof HTMLElement)) return root;
  if (id === 'tasks') enhanceMiningTasks(root);
  else if (id === 'nova-vault' && root.dataset.vaultV3Integrated !== 'true') enhanceMiningNovaVault(root);
  return root;
}