import { icon } from '../../components/icons.js';
import { renderNovaVaultLiving } from './nova-vault-living-v14.js?ota=nv14';

let cleanup = null;

export function novaVaultScreen({ backToMine } = {}) {
  cleanupNovaVaultScreen();

  const root = document.createElement('section');
  root.className = 'nx-screen';
  root.dataset.novaVaultDirectV14 = 'true';
  root.innerHTML = `<header class="nx-app-head"><button class="nx-back" type="button" data-vault-back aria-label="Back to Mine">‹</button><span class="nx-app-head__icon">${icon('vault')}</span><div><p class="nx-eyebrow">Mining</p><h1>Nova Vault + 10X</h1><p>Server-backed vault rewards and secure 10X chance</p></div></header><div data-app-mount></div>`;

  root.querySelector('[data-vault-back]')?.addEventListener('click', () => backToMine?.());
  const mount = root.querySelector('[data-app-mount]');

  try {
    const body = renderNovaVaultLiving();
    if (!(body instanceof Node)) throw new Error('Nova Vault renderer returned an invalid screen.');
    mount.appendChild(body);

    let cleaned = false;
    const bodyCleanup = () => {
      if (cleaned) return;
      cleaned = true;
      body.__cleanup?.();
      if (cleanup === bodyCleanup) cleanup = null;
    };
    cleanup = bodyCleanup;
    root.__cleanup = bodyCleanup;
  } catch (error) {
    console.error('[NexusNova Fresh] direct Nova Vault v14 renderer:', error);
    mount.innerHTML = '<article class="nx-tool-card"><h2>Nova Vault could not initialize</h2><p>The secure Vault screen hit a local runtime error. No Vault was changed.</p><button class="nx-secondary" type="button" data-vault-error-back>BACK TO MINE</button></article>';
    mount.querySelector('[data-vault-error-back]')?.addEventListener('click', () => backToMine?.());
  }

  return root;
}

export function cleanupNovaVaultScreen() {
  cleanup?.();
  cleanup = null;
}
