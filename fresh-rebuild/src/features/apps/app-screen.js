import { icon } from '../../components/icons.js';
import { novaApps } from '../hub/app-registry.js';
import { enhanceMiningApp } from './mining-integrations.js';
import { enhanceTravelApp } from './travel-integrations.js';
import { everydayRenderers } from './everyday-tools.js';
import { liveRenderers } from './live-tools.js';
import { coreRenderers } from './core-apps.js';
import { coreEnhancementRenderers } from './core-enhancements.js';
import { personalRenderers } from './personal-apps.js';
import { discoverRenderers } from './discover-apps.js';
import { browserSafeRenderers } from './browser-safe.js';
import { articleRenderers } from './articles-suite.js';
import { novaVpnRenderers } from './nova-vpn-suite.js';
import { newsSuiteRenderers } from './news-suite.js';
import { faithSecurityRenderers } from './faith-security-apps.js';
import { novaVaultSafeRenderers } from './nova-vault-safe.js';
import { hadithSafeRenderers } from './hadith-safe.js';
import { deviceRenderers } from './device-apps.js';
import { locationSuiteRenderers } from './location-suite.js';
import { smartRenderers } from './smart-apps.js';
import { teacherSuiteRenderers } from './teacher-suite.js';
import { teacherAIRenderers } from './teacher-ai-suite.js';
import { islamicSuiteRenderers } from './islamic-suite.js';
import { documentsSuiteRenderers } from './documents-suite.js';
import { documentsLiveRenderers } from './documents-live-suite.js';
import { communityChatRenderers } from './community-chat.js';
import { learningSuiteRenderers } from './learning-suite.js';
import { billRenderers } from './bills-app.js';
import { budgetSuiteRenderers } from './budget-suite.js';
import { healthSuiteRenderers } from './health-suite.js';
import { familySuiteRenderers } from './family-suite.js';
import { travelSuiteRenderers } from './travel-suite.js';
import { marketplaceSuiteRenderers } from './marketplace-suite.js';
import { fileVaultSuiteRenderers } from './file-vault-suite.js';
import { securityLockSuiteRenderers } from './security-lock-suite.js';
import { notificationsSuiteRenderers } from './notifications-suite.js';
import { entertainmentResilientRenderers } from './entertainment-resilient.js';
import { entertainmentSuiteRenderers } from './entertainment-suite.js';
import { entertainmentLiveRenderers } from './entertainment-live-suite.js';
import { pakistanSuiteRenderers } from './pakistan-suite.js';
import { urduLibraryRenderers } from './urdu-library-suite.js';
import { premiumWeatherRenderers } from './premium-weather.js';
import { premiumNovaInternetSpeedRenderers } from './premium-nova-internet-speed.js';
import { premiumQiblaRenderers } from './premium-qibla.js';
import { premiumPrayerSafeRenderers } from './premium-prayer-safe.js';
import { premiumPrayerRenderers } from './premium-prayer-times.js';
import { premiumWorldClockRenderers } from './premium-world-clock.js';
import { nativeDriveRenderers } from './native-drive-suite.js';
import { premiumDriveSafeRenderers } from './premium-drive-safe.js';
import { premiumDriveRenderers } from './premium-drive-tools.js';
import { premiumQuranRenderers } from './premium-quran-reader.js';

let cleanup = null;
export function appScreen({ id, backToHub, backToMine } = {}) {
  cleanup?.(); cleanup = null;
  const app = novaApps.find(item => item.id === id); const root = document.createElement('section'); root.className = 'nx-screen';
  if (!app) { root.innerHTML = '<div class="nx-empty">This NexusNova app could not be found.</div>'; return root; }
  const miningOwned = app.placement === 'mine';
  const parentName = miningOwned ? 'Mine' : 'Nova Hub';
  const goBack = miningOwned ? backToMine : backToHub;
  root.innerHTML = `<header class="nx-app-head"><button class="nx-back" type="button" data-app-back aria-label="Back to ${parentName}">‹</button><span class="nx-app-head__icon">${icon(app.icon)}</span><div><p class="nx-eyebrow">${app.category}</p><h1>${app.name}</h1><p>${app.description}</p></div></header><div data-app-mount></div>`;
  root.querySelector('[data-app-back]').addEventListener('click', () => goBack?.());
  const mount = root.querySelector('[data-app-mount]');
  const renderer = novaVaultSafeRenderers[id] || hadithSafeRenderers[id] || browserSafeRenderers[id] || premiumNovaInternetSpeedRenderers[id] || premiumWeatherRenderers[id] || premiumQiblaRenderers[id] || premiumPrayerSafeRenderers[id] || premiumPrayerRenderers[id] || premiumWorldClockRenderers[id] || nativeDriveRenderers[id] || premiumDriveSafeRenderers[id] || premiumDriveRenderers[id] || premiumQuranRenderers[id] || documentsLiveRenderers[id] || teacherAIRenderers[id] || pakistanSuiteRenderers[id] || articleRenderers[id] || novaVpnRenderers[id] || newsSuiteRenderers[id] || entertainmentResilientRenderers[id] || entertainmentLiveRenderers[id] || entertainmentSuiteRenderers[id] || urduLibraryRenderers[id] || locationSuiteRenderers[id] || notificationsSuiteRenderers[id] || securityLockSuiteRenderers[id] || fileVaultSuiteRenderers[id] || marketplaceSuiteRenderers[id] || coreEnhancementRenderers[id] || coreRenderers[id] || healthSuiteRenderers[id] || familySuiteRenderers[id] || personalRenderers[id] || teacherSuiteRenderers[id] || islamicSuiteRenderers[id] || documentsSuiteRenderers[id] || communityChatRenderers[id] || learningSuiteRenderers[id] || budgetSuiteRenderers[id] || billRenderers[id] || travelSuiteRenderers[id] || discoverRenderers[id] || faithSecurityRenderers[id] || deviceRenderers[id] || smartRenderers[id] || everydayRenderers[id] || liveRenderers[id];
  if (renderer) {
    try {
      const body = renderer();
      if (!(body instanceof Node)) throw new Error('Renderer returned an invalid screen.');
      enhanceMiningApp(id, body);
      enhanceTravelApp(id, body);
      mount.appendChild(body);
      let cleaned = false;
      const bodyCleanup = () => {
        if (cleaned) return;
        cleaned = true;
        try { window.speechSynthesis?.cancel?.(); } catch {}
        body.__cleanup?.();
        if (cleanup === bodyCleanup) cleanup = null;
      };
      cleanup = bodyCleanup;
      root.__cleanup = bodyCleanup;
    } catch (error) {
      console.error(`[NexusNova Fresh] ${id} renderer:`, error);
      mount.innerHTML = `<article class="nx-tool-card"><h2>${app.name} could not initialize</h2><p>This tool hit a local runtime error. You can safely leave this screen and continue using other NexusNova areas.</p><button class="nx-secondary" type="button" data-app-error-back>BACK TO ${miningOwned ? 'MINE' : 'NOVA HUB'}</button></article>`;
      mount.querySelector('[data-app-error-back]')?.addEventListener('click', () => goBack?.());
    }
  } else mount.innerHTML = `<article class="nx-tool-card nx-migration-card"><span class="nx-app-head__icon">${icon(app.icon)}</span><h2>${app.name} fresh migration</h2><p>This module exists in the current NexusNova codebase, but its old presentation layer is intentionally not being loaded here. Its verified logic/native/provider contracts will be connected to this fresh screen without carrying the legacy UI.</p><div class="nx-migration-status"><i></i><span>Fresh architecture migration queued</span></div></article>`;
  return root;
}
export function cleanupAppScreen() { cleanup?.(); cleanup = null; }
