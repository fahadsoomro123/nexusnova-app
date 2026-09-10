import { authService } from '../../core/auth-service.js';
import { icon } from '../../components/icons.js';

export function authScreen({ onSignedIn } = {}) {
  const root = document.createElement('section');
  root.className = 'nx-screen nx-auth';
  root.innerHTML = `
    <div class="nx-auth__brand">
      <div class="nx-auth__logo">N</div>
      <p class="nx-eyebrow">NEXUSNOVA</p>
      <h1 class="nx-title">Your digital universe.</h1>
      <p class="nx-subtitle">Secure mining, Nova Hub and everyday utilities in one modern workspace.</p>
    </div>

    <article class="nx-panel nx-auth__card">
      <div class="nx-auth__switch" role="tablist" aria-label="Authentication mode">
        <button type="button" class="active" data-auth-mode="signin">SIGN IN</button>
        <button type="button" data-auth-mode="register">CREATE ACCOUNT</button>
      </div>

      <form data-auth-form novalidate>
        <label class="nx-field" data-name-field hidden>
          <span>Name</span>
          <input type="text" name="name" maxlength="80" autocomplete="name" placeholder="Your name">
        </label>
        <label class="nx-field">
          <span>Email</span>
          <input type="email" name="email" autocomplete="email" inputmode="email" placeholder="name@example.com" required>
        </label>
        <label class="nx-field">
          <span>Password</span>
          <input type="password" name="password" autocomplete="current-password" minlength="6" placeholder="Minimum 6 characters" required>
        </label>
        <button class="nx-primary" type="submit" data-auth-submit>SIGN IN</button>
        <p class="nx-form-status" data-auth-status role="status">QA sign-in ready.</p>
      </form>
    </article>

    <div class="nx-auth__trust">
      ${icon('vault')}<span>QA local session • cloud-only actions remain protected</span>
    </div>
  `;

  let mode = 'signin';
  const buttons = [...root.querySelectorAll('[data-auth-mode]')];
  const form = root.querySelector('[data-auth-form]');
  const nameField = root.querySelector('[data-name-field]');
  const submit = root.querySelector('[data-auth-submit]');
  const status = root.querySelector('[data-auth-status]');

  const setMode = next => {
    mode = next === 'register' ? 'register' : 'signin';
    buttons.forEach(button => button.classList.toggle('active', button.dataset.authMode === mode));
    nameField.hidden = mode !== 'register';
    submit.textContent = mode === 'register' ? 'CREATE ACCOUNT' : 'SIGN IN';
    const password = form.elements.password;
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    status.textContent = mode === 'register'
      ? 'Create a local QA session for this test build.'
      : 'QA sign-in ready.';
  };

  buttons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    status.textContent = mode === 'register' ? 'Creating secure account…' : 'Signing in…';
    try {
      const data = new FormData(form);
      const email = data.get('email');
      const password = data.get('password');
      const user = mode === 'register'
        ? await authService.register({ name: data.get('name'), email, password })
        : await authService.signIn(email, password);
      status.textContent = 'Signed in.';
      onSignedIn?.(user);
    } catch (error) {
      const message = String(error?.message || 'Authentication failed.').replace(/^Firebase:\s*/i, '');
      status.textContent = message;
    } finally {
      submit.disabled = false;
    }
  });

  setMode('signin');
  return root;
}
