// Native Nova VPN launches Android VpnService control; the web layer never handles tunnel private keys.
import { requireFirebaseUser } from '../../core/firebase-backend.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

export function renderNovaVpn() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-list-card__head">
        <div>
          <strong>Nova VPN</strong>
          <p class="nx-tool-meta" style="margin-top:3px">System-wide WireGuard protection</p>
        </div>
        <span class="nx-tool-meta">ANDROID</span>
      </div>
      <div class="nx-result" style="margin-top:14px">
        <strong>Full device tunnel</strong>
        <p class="nx-tool-meta" style="margin-top:7px">When connected, Nova VPN covers Chrome, Firefox and other phone apps — not only the NexusNova browser.</p>
      </div>
      <div class="nx-stack" style="margin-top:14px">
        <div class="nx-list-card"><strong>Protocol</strong><p>WireGuard</p></div>
        <div class="nx-list-card"><strong>Server selection</strong><p>Real measured latency • Smart Pick chooses the lowest verified response time.</p></div>
        <div class="nx-list-card"><strong>Privacy</strong><p>Fresh client keys are generated on-device. No public shared VPN private keys are bundled in NexusNova.</p></div>
      </div>
      <button class="nx-primary" type="button" data-vpn-open style="margin-top:14px">OPEN NOVA VPN CONTROL</button>
      <p class="nx-tool-meta" data-vpn-status style="margin-top:10px">Ready to open the native system VPN control.</p>
    </section>
  `);

  const button = root.querySelector('[data-vpn-open]');
  const status = root.querySelector('[data-vpn-status]');
  let busy = false;

  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    button.disabled = true;
    status.textContent = 'Verifying your NexusNova session…';
    try {
      const user = await requireFirebaseUser({ verified:true });
      const authToken = await user.getIdToken();
      if (!authToken || authToken.length > 7000) throw new Error('Secure session token is unavailable.');
      if (typeof window.nexusPostNativeAction !== 'function' ||
          !window.nexusPostNativeAction('openNovaVpn', { authToken })) {
        throw new Error('Nova VPN requires the NexusNova Android app.');
      }
      status.textContent = 'Opening native Nova VPN control…';
    } catch (error) {
      status.textContent = error?.message || 'Nova VPN could not open.';
    } finally {
      busy = false;
      button.disabled = false;
    }
  });

  return root;
}

export const novaVpnRenderers = Object.freeze({ 'nova-vpn':renderNovaVpn });
