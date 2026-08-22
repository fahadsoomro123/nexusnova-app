// Native Nova VPN launches Android VpnService/WireGuard control; web code passes only a short-lived verified account token and never tunnel private keys.
import { requireFirebaseUser } from '../../core/firebase-backend.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

export function renderNovaVpn() {
  const root = node(`
    <section class="nx-vpn-shell" aria-label="Nova VPN secure network">
      <div class="nx-vpn-brand">
        <div class="nx-vpn-brand__identity">
          <span class="nx-vpn-brand__mark" aria-hidden="true">N</span>
          <div>
            <p class="nx-eyebrow">NEXUSNOVA SECURE NETWORK</p>
            <h2>Nova VPN</h2>
          </div>
        </div>
        <span class="nx-vpn-native-badge">ANDROID NATIVE</span>
      </div>

      <div class="nx-vpn-core" aria-hidden="true">
        <div class="nx-vpn-core__center">N</div>
      </div>

      <div class="nx-vpn-state">
        <strong><i></i>FULL-DEVICE PROTECTION</strong>
        <p>One encrypted WireGuard tunnel for NexusNova, Chrome, Firefox and other phone apps.</p>
      </div>

      <div class="nx-vpn-capabilities" aria-label="VPN capabilities">
        <div><span>PROTOCOL</span><strong>WireGuard</strong></div>
        <div><span>ROUTING</span><strong>IPv4 + IPv6</strong></div>
        <div><span>DNS</span><strong>Tunnel DNS</strong></div>
      </div>

      <div class="nx-vpn-trust">
        <div>
          <span>SMART PICK</span>
          <p>Production locations are ranked by real measured response time before you connect.</p>
        </div>
        <div>
          <span>ON-DEVICE KEYS</span>
          <p>A fresh WireGuard client key is generated on your device. NexusNova does not bundle public shared VPN private keys.</p>
        </div>
      </div>

      <button class="nx-vpn-open" type="button" data-vpn-open>OPEN NOVA VPN CONTROL</button>
      <p class="nx-vpn-launch-status" data-vpn-status>Ready to open the native Nova VPN control.</p>
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
