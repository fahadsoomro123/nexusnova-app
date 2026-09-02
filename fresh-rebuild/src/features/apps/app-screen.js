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
import { qiblaSafeV2Renderers } from './premium-qibla-safe-v2.js';
import { premiumQiblaRenderers } from './premium-qibla.js';
import { premiumPrayerSafeRenderers } from './premium-prayer-safe.js';
import { premiumPrayerRenderers } from './premium-prayer-times.js';
import { premiumWorldClockRenderers } from './premium-world-clock.js';
import { driveNativeV2Renderers } from './premium-drive-native-v2.js';
import { premiumDriveSafeRenderers } from './premium-drive-safe.js';
import { premiumDriveRenderers } from './premium-drive-tools.js';
import { premiumQuranRenderers } from './premium-quran-reader.js';
import { novaSol57Renderers } from './nova-sol57-fresh.js';
import { premiumStudioRenderers } from './premium-studio-suite.js';

let cleanup = null;

function ensureNovaPremiumSidebarStyle() {
  if (document.getElementById('nx57-premium-sidebar-style')) return;
  const style = document.createElement('style');
  style.id = 'nx57-premium-sidebar-style';
  style.textContent = `
    .nx57-shell-premium .nx-app-head{position:relative;padding-right:62px}
    .nx57-header-menu{position:absolute;right:14px;top:50%;transform:translateY(-50%);width:42px;height:42px;border:1px solid rgba(126,151,255,.22);border-radius:14px;background:linear-gradient(180deg,rgba(18,43,70,.96),rgba(9,27,46,.96));box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 10px 24px rgba(0,0,0,.18);display:grid;place-content:center;gap:4px;color:#fff;z-index:5}
    .nx57-header-menu span{display:block;width:17px;height:2px;border-radius:999px;background:currentColor;opacity:.94}
    .nx57-header-menu:active{transform:translateY(-50%) scale(.96)}
    .nx57 [data-nx57-action="sidebar"],.nx57 [data-nx57-action="system"]{display:none!important}

    .nx57-portal-drawer{position:fixed!important;inset:0!important;z-index:2147483640!important;background:rgba(1,7,16,.78)!important;backdrop-filter:blur(9px) saturate(115%)!important;-webkit-backdrop-filter:blur(9px) saturate(115%)!important}
    .nx57-portal-drawer[hidden]{display:none!important}
    .nx57-portal-drawer .nx57-drawer{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(82vw,314px)!important;height:100dvh!important;box-sizing:border-box!important;padding:calc(env(safe-area-inset-top) + 16px) 13px calc(env(safe-area-inset-bottom) + 16px)!important;border:0!important;border-right:1px solid rgba(118,150,190,.18)!important;border-radius:0 24px 24px 0!important;background:linear-gradient(180deg,#071422 0%,#081827 58%,#06121f 100%)!important;box-shadow:24px 0 70px rgba(0,0,0,.5),inset -1px 0 0 rgba(255,255,255,.03)!important;overflow-y:auto!important;overscroll-behavior:contain;animation:nx57PremiumDrawerIn .2s cubic-bezier(.2,.8,.2,1)}
    @keyframes nx57PremiumDrawerIn{from{transform:translateX(-18px);opacity:.72}to{transform:translateX(0);opacity:1}}
    .nx57-portal-drawer .nx57-drawer-head{position:sticky;top:0;z-index:2;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin:0 0 13px!important;padding:3px 2px 11px!important;background:linear-gradient(180deg,#071422 72%,rgba(7,20,34,0))}
    .nx57-portal-drawer .nx57-drawer-head strong{font-size:14px!important;letter-spacing:.01em}
    .nx57-portal-drawer .nx57-drawer-head span{font-size:9px!important;opacity:.55!important;margin-top:2px!important}
    .nx57-portal-drawer .nx57-drawer-close{width:36px!important;height:36px!important;border-radius:12px!important;border:1px solid rgba(148,163,184,.16)!important;background:rgba(18,41,64,.85)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);font-size:18px!important}
    .nx57-portal-drawer .nx57-side-nav{display:grid!important;gap:4px!important;margin:0 0 11px!important}
    .nx57-portal-drawer .nx57-side-nav button{display:grid!important;grid-template-columns:28px minmax(0,1fr) auto!important;align-items:center!important;gap:9px!important;min-height:44px!important;padding:8px 10px!important;border:1px solid transparent!important;border-radius:13px!important;background:transparent!important;color:#eaf3ff!important;text-align:left!important;font-size:12px!important;font-weight:760!important;letter-spacing:.005em!important}
    .nx57-portal-drawer .nx57-side-nav button.is-active{background:linear-gradient(135deg,rgba(42,82,163,.31),rgba(27,61,112,.22))!important;border-color:rgba(104,140,255,.18)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
    .nx57-portal-drawer .nx57-side-nav button:active{transform:scale(.992)}
    .nx57-side-icon{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(27,56,87,.74);border:1px solid rgba(122,154,196,.12);font-size:13px;line-height:1}
    .nx57-side-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .nx57-portal-drawer .nx57-side-nav small{justify-self:end!important;opacity:.82!important;font-size:8px!important;font-weight:800!important;line-height:1!important;padding:5px 7px!important;border-radius:999px!important;background:rgba(117,145,177,.1)!important;border:1px solid rgba(148,163,184,.1)!important;color:#aebed0!important;text-transform:uppercase!important;letter-spacing:.045em!important}
    .nx57-portal-drawer .nx57-side-nav button.is-active small{color:#cfe0ff!important;background:rgba(70,111,205,.16)!important;border-color:rgba(101,140,230,.16)!important}
    .nx57-portal-drawer .nx57-side-panel{display:none!important;margin-top:10px!important;padding:12px!important;border:1px solid rgba(131,157,189,.12)!important;border-radius:15px!important;background:linear-gradient(180deg,rgba(15,34,53,.78),rgba(9,25,40,.72))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}
    .nx57-portal-drawer .nx57-side-panel.is-open{display:block!important}
    .nx57-portal-drawer .nx57-note{margin:0!important;font-size:10.5px!important;line-height:1.5!important;color:#c9d5e2!important;opacity:.9!important}
    .nx57-portal-drawer .nx57-note b{display:block;margin-bottom:4px;color:#f1f6ff;font-size:11px}
    .nx57-portal-drawer .nx57-system{font-size:10px!important;line-height:1.65!important;color:#cbd7e4!important}
    .nx57-portal-drawer .nx57-search{display:grid!important;grid-template-columns:minmax(0,1fr) 76px!important;gap:6px!important;width:100%!important}
    .nx57-portal-drawer .nx57-search input{min-width:0!important;width:100%!important;box-sizing:border-box!important;padding:9px 10px!important;border-radius:11px!important;font-size:10.5px!important}
    .nx57-portal-drawer .nx57-search button{width:76px!important;min-width:0!important;padding:0!important;border-radius:11px!important;font-size:9px!important;letter-spacing:.03em!important}
    .nx57-portal-drawer .nx57-history{display:grid!important;gap:6px!important;max-height:43vh!important;overflow:auto!important;margin-top:8px!important;padding-right:1px!important}
    .nx57-portal-drawer .nx57-history button{padding:8px 9px!important;border-radius:11px!important;font-size:9.5px!important;line-height:1.36!important;background:rgba(14,34,53,.84)!important;border-color:rgba(137,162,193,.1)!important}
    html.nx57-drawer-open{overflow:hidden!important}
    html.nx57-drawer-open #nxEmergencySosButton,html.nx57-drawer-open #nxEmergencySosEdit{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
    @media(max-width:390px){.nx57-portal-drawer .nx57-drawer{width:min(84vw,306px)!important}.nx57-shell-premium .nx-app-head{padding-right:56px}.nx57-header-menu{right:10px;width:40px;height:40px}}
    @media(prefers-reduced-motion:reduce){.nx57-portal-drawer .nx57-drawer{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function installNovaPremiumSidebar(root, body) {
  const drawer = body.querySelector('[data-nx57-drawer]');
  const header = root.querySelector('.nx-app-head');
  if (!drawer || !header) return () => {};

  ensureNovaPremiumSidebarStyle();
  root.classList.add('nx57-shell-premium');

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'nx57-header-menu';
  menuButton.setAttribute('aria-label', 'Open NOVA sidebar');
  menuButton.innerHTML = '<span></span><span></span><span></span>';
  header.appendChild(menuButton);

  const originalSidebarAction = body.querySelector('[data-nx57-action="sidebar"]');
  const navMeta = {
    history: ['⌕', 'Local'],
    projects: ['◇', 'Offline'],
    remote: ['⑂', 'Setup'],
    scheduled: ['◷', 'Offline'],
    plugins: ['✦', 'Ready'],
    system: ['✓', 'Live']
  };

  const sideButtons = [...drawer.querySelectorAll('[data-nx57-side]')];
  const panels = [...drawer.querySelectorAll('[data-nx57-side-panel]')];
  sideButtons.forEach(button => {
    const name = button.dataset.nx57Side;
    const label = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE)?.textContent?.trim() || name;
    const small = button.querySelector('small') || document.createElement('small');
    const [symbol, badge] = navMeta[name] || ['•', ''];
    button.textContent = '';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'nx57-side-icon';
    iconSpan.textContent = symbol;
    const labelSpan = document.createElement('span');
    labelSpan.className = 'nx57-side-label';
    labelSpan.textContent = label;
    small.textContent = badge;
    button.append(iconSpan, labelSpan, small);
  });

  const remoteNote = drawer.querySelector('[data-nx57-side-panel="remote"] .nx57-note');
  if (remoteNote) remoteNote.innerHTML = '<b>GitHub workspace</b>Not connected yet. Secure GitHub setup is the next integration step.';
  const projectsNote = drawer.querySelector('[data-nx57-side-panel="projects"] .nx57-note');
  if (projectsNote) projectsNote.innerHTML = '<b>Projects</b>No remote project workspace is connected yet. Local NOVA history stays available.';
  const scheduledNote = drawer.querySelector('[data-nx57-side-panel="scheduled"] .nx57-note');
  if (scheduledNote) scheduledNote.innerHTML = '<b>Scheduled</b>NOVA scheduling is not connected in this Android build yet.';

  const activate = name => {
    sideButtons.forEach(button => button.classList.toggle('is-active', button.dataset.nx57Side === name));
    panels.forEach(panel => panel.classList.toggle('is-open', panel.dataset.nx57SidePanel === name));
  };

  drawer.classList.add('nx57-portal-drawer');
  document.body.appendChild(drawer);

  const syncOpenState = () => {
    const isOpen = !drawer.hidden;
    document.documentElement.classList.toggle('nx57-drawer-open', isOpen);
    menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  const openSidebar = () => {
    originalSidebarAction?.click();
    activate('history');
    syncOpenState();
  };

  menuButton.addEventListener('click', openSidebar);
  sideButtons.forEach(button => button.addEventListener('click', () => {
    activate(button.dataset.nx57Side);
    queueMicrotask(syncOpenState);
  }));

  drawer.querySelector('[data-nx57-drawer-close]')?.addEventListener('click', () => queueMicrotask(syncOpenState));
  drawer.addEventListener('click', event => {
    if (event.target === drawer) queueMicrotask(syncOpenState);
  });

  const observer = new MutationObserver(syncOpenState);
  observer.observe(drawer, { attributes: true, attributeFilter: ['hidden'] });
  activate('history');
  syncOpenState();

  return () => {
    observer.disconnect();
    document.documentElement.classList.remove('nx57-drawer-open');
    drawer.remove();
  };
}

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
  const renderer = premiumStudioRenderers[id] || novaSol57Renderers[id] || novaVaultSafeRenderers[id] || hadithSafeRenderers[id] || browserSafeRenderers[id] || premiumWeatherRenderers[id] || qiblaSafeV2Renderers[id] || premiumQiblaRenderers[id] || premiumPrayerSafeRenderers[id] || premiumPrayerRenderers[id] || premiumWorldClockRenderers[id] || driveNativeV2Renderers[id] || premiumDriveSafeRenderers[id] || premiumDriveRenderers[id] || premiumQuranRenderers[id] || documentsLiveRenderers[id] || teacherAIRenderers[id] || pakistanSuiteRenderers[id] || articleRenderers[id] || novaVpnRenderers[id] || newsSuiteRenderers[id] || entertainmentResilientRenderers[id] || entertainmentLiveRenderers[id] || entertainmentSuiteRenderers[id] || urduLibraryRenderers[id] || locationSuiteRenderers[id] || notificationsSuiteRenderers[id] || securityLockSuiteRenderers[id] || fileVaultSuiteRenderers[id] || marketplaceSuiteRenderers[id] || coreEnhancementRenderers[id] || coreRenderers[id] || healthSuiteRenderers[id] || familySuiteRenderers[id] || personalRenderers[id] || teacherSuiteRenderers[id] || islamicSuiteRenderers[id] || documentsSuiteRenderers[id] || communityChatRenderers[id] || learningSuiteRenderers[id] || budgetSuiteRenderers[id] || billRenderers[id] || travelSuiteRenderers[id] || discoverRenderers[id] || faithSecurityRenderers[id] || deviceRenderers[id] || smartRenderers[id] || everydayRenderers[id] || liveRenderers[id];
  if (renderer) {
    try {
      const body = renderer();
      if (!(body instanceof Node)) throw new Error('Renderer returned an invalid screen.');
      enhanceMiningApp(id, body);
      enhanceTravelApp(id, body);
      mount.appendChild(body);
      const novaSidebarCleanup = id === 'ai' ? installNovaPremiumSidebar(root, body) : () => {};
      let cleaned = false;
      const bodyCleanup = () => {
        if (cleaned) return;
        cleaned = true;
        novaSidebarCleanup();
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
