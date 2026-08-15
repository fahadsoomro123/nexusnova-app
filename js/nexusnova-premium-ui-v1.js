/* NexusNova Premium UI v1
   Reusable 3D/glass modal, form, confirm, alert and result-shell system.
   No external image assets: all feature visuals are inline SVG so they stay fast and offline-friendly. */
(() => {
  'use strict';
  if (window.NexusNovaUI?.version === '1.0.2') return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const uid = () => 'nxui-' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);

  function hasVisibleBackdrop() {
    return Array.from(document.querySelectorAll('.nxui-backdrop')).some(node => {
      if (!node?.isConnected) return false;
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01;
    });
  }

  function unlockBodyIfSafe() {
    if (!document.body || hasVisibleBackdrop()) return;
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
  }

  function installUnlockSafety() {
    if (!document.body || window.__nxuiUnlockSafetyV102) return;
    window.__nxuiUnlockSafetyV102 = true;
    const observer = new MutationObserver(() => queueMicrotask(unlockBodyIfSafe));
    observer.observe(document.body, { childList:true });
    window.addEventListener('pageshow', unlockBodyIfSafe);
    queueMicrotask(unlockBodyIfSafe);
  }

  const paths = {
    university:'<path d="M3 10 12 4l9 6-9 4-9-4Z"/><path d="M6 12v5M10 14v3M14 14v3M18 12v5M4 19h16"/>',
    school:'<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-5h6v5M7 11h2M15 11h2"/>',
    subject:'<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M8 8h7M8 12h7"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M13 14h3M8 17h3"/>',
    quiz:'<path d="M9.5 9a2.7 2.7 0 1 1 4.8 1.7c-.9 1-2.3 1.4-2.3 3"/><path d="M12 18h.01"/><circle cx="12" cy="12" r="9"/>',
    worksheet:'<path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v5h5M10 13h6M10 17h6"/><path d="m4.5 15 1 1 2-2"/>',
    attendance:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3 20c.2-4 2.5-6 5-6s4.8 2 5 6M14 15c2.9.1 5 1.7 5.7 4"/><path d="m15 6 1 1 2-2"/>',
    lesson:'<path d="M4 5h7a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 2V5Z"/><path d="M20 5h-3a3 3 0 0 0-3 3v11h3a3 3 0 0 1 3 2V5Z"/><path d="M8 9h3M17 9h.01"/>',
    wifi:'<path d="M4 9a12 12 0 0 1 16 0M7 12a8 8 0 0 1 10 0M10 15a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1"/>',
    contact:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.6-5 3.5-8 8-8s7.4 3 8 8"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    language:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.3 4.5 6.3 4.5 9S15 17.7 12 21M12 3C9 6.3 7.5 9.3 7.5 12S9 17.7 12 21"/>',
    duration:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    questions:'<path d="M5 5h14v12H9l-4 3V5Z"/><path d="M9 9h6M9 13h4"/>',
    search:'<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
    teacher:'<path d="M4 19h16M7 16v-5l5-3 5 3v5"/><circle cx="12" cy="5" r="2"/>',
    spark:'<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="m18 14 .9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z"/>',
    user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 21c.5-5 3-7.5 7-7.5s6.5 2.5 7 7.5"/>',
    number:'<path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"/>',
    security:'<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>'
  };

  function icon(name='spark', extra='') {
    const body = paths[name] || paths.spark;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;
  }

  function installStyles() {
    if (document.getElementById('nxPremiumUIStyles')) return;
    const style = document.createElement('style');
    style.id = 'nxPremiumUIStyles';
    style.textContent = `
      .nxui-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(circle at 50% 15%,rgba(39,116,255,.18),transparent 38%),rgba(1,6,16,.82);backdrop-filter:blur(16px);animation:nxuiFade .18s ease}
      .nxui-modal{position:relative;width:min(94vw,620px);max-height:min(88vh,820px);overflow:auto;overscroll-behavior:contain;border-radius:28px;padding:0;background:linear-gradient(145deg,rgba(14,31,55,.98),rgba(5,15,31,.98));border:1px solid rgba(115,176,255,.24);box-shadow:0 35px 90px rgba(0,0,0,.65),0 0 55px rgba(36,122,255,.14),inset 0 1px 0 rgba(255,255,255,.08);color:#f8fbff;animation:nxuiLift .22s cubic-bezier(.2,.8,.2,1);isolation:isolate}
      .nxui-modal:before{content:"";position:absolute;inset:0 0 auto;height:150px;background:radial-gradient(circle at 18% 8%,rgba(91,173,255,.23),transparent 45%),linear-gradient(120deg,rgba(32,105,255,.18),transparent 58%);pointer-events:none;z-index:-1}
      .nxui-close{position:absolute;right:16px;top:16px;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(4,13,27,.56);color:#d6e8ff;font-size:20px;display:grid;place-items:center;z-index:3}
      .nxui-hero{display:grid;grid-template-columns:92px 1fr;gap:18px;align-items:center;padding:26px 26px 18px}
      .nxui-orb{width:88px;height:88px;border-radius:27px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#1a78ff,#58c8ff);box-shadow:0 18px 42px rgba(21,126,255,.38),inset 0 1px 1px rgba(255,255,255,.45),inset 0 -10px 25px rgba(0,49,139,.28);transform:perspective(300px) rotateX(7deg) rotateY(-7deg)}
      .nxui-orb svg{width:48px;height:48px;filter:drop-shadow(0 6px 9px rgba(0,0,0,.25))}
      .nxui-eyebrow{font-size:10px;font-weight:900;letter-spacing:.16em;color:#75baff;text-transform:uppercase;margin-bottom:5px}.nxui-title{margin:0;font-size:clamp(21px,4vw,30px);line-height:1.1;font-weight:900;letter-spacing:-.035em}.nxui-subtitle{margin:8px 0 0;color:#9db1c9;font-size:13px;line-height:1.55}
      .nxui-form{padding:4px 24px 24px}.nxui-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nxui-field{min-width:0}.nxui-field.nxui-wide{grid-column:1/-1}.nxui-label{display:flex;align-items:center;gap:8px;margin:0 0 7px;color:#c9ddf5;font-size:11px;font-weight:800;letter-spacing:.025em}.nxui-label svg{width:18px;height:18px;color:#62b8ff}
      .nxui-control{position:relative}.nxui-control>svg{position:absolute;left:13px;top:50%;width:20px;height:20px;transform:translateY(-50%);color:#5faeff;pointer-events:none}.nxui-input,.nxui-select,.nxui-textarea{width:100%;min-height:50px;padding:13px 14px 13px 43px;border-radius:15px;border:1px solid rgba(124,171,226,.20);outline:0;background:linear-gradient(180deg,rgba(4,15,31,.94),rgba(8,24,45,.94));color:#f8fbff;font:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.03);transition:.18s}.nxui-textarea{min-height:104px;resize:vertical;padding-top:14px}.nxui-control.textarea>svg{top:18px;transform:none}.nxui-input:focus,.nxui-select:focus,.nxui-textarea:focus{border-color:#4ca7ff;box-shadow:0 0 0 3px rgba(38,134,255,.16),0 8px 22px rgba(0,0,0,.15)}.nxui-input::placeholder,.nxui-textarea::placeholder{color:#60758e}.nxui-hint{margin-top:6px;color:#70869f;font-size:10px;line-height:1.4}.nxui-error{display:none;margin-top:7px;color:#ff8ca0;font-size:11px;font-weight:700}.nxui-field.invalid .nxui-error{display:block}.nxui-field.invalid .nxui-input,.nxui-field.invalid .nxui-select,.nxui-field.invalid .nxui-textarea{border-color:#ff5d78}
      .nxui-actions{display:flex;gap:10px;margin-top:20px}.nxui-btn{flex:1;min-height:50px;border-radius:15px;border:1px solid rgba(255,255,255,.11);font-weight:900;letter-spacing:.01em;cursor:pointer}.nxui-btn.primary{border:0;color:#fff;background:linear-gradient(135deg,#146dff,#3daeff 55%,#65d5ff);box-shadow:0 12px 28px rgba(29,126,255,.28),inset 0 1px 0 rgba(255,255,255,.25)}.nxui-btn.secondary{color:#c5d8ee;background:rgba(8,21,40,.75)}.nxui-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
      .nxui-message{padding:0 24px 24px}.nxui-message-box{padding:16px;border-radius:18px;border:1px solid rgba(103,175,255,.16);background:rgba(7,20,39,.74);color:#c7daf0;line-height:1.6;font-size:13px}
      .nxui-toast{position:fixed;left:50%;bottom:92px;z-index:2147483600;transform:translate(-50%,18px);opacity:0;pointer-events:none;max-width:min(90vw,440px);padding:12px 16px;border-radius:14px;background:rgba(9,24,43,.96);border:1px solid rgba(91,173,255,.25);box-shadow:0 14px 38px rgba(0,0,0,.45);color:#f3f8ff;font-size:12px;font-weight:800;transition:.2s}.nxui-toast.show{opacity:1;transform:translate(-50%,0)}
      .nxui-result-shell{position:relative;overflow:hidden;border-radius:22px;padding:18px;background:linear-gradient(145deg,rgba(10,28,50,.96),rgba(5,17,33,.96));border:1px solid rgba(93,167,255,.20);box-shadow:0 18px 45px rgba(0,0,0,.22)}.nxui-result-head{display:flex;gap:12px;align-items:center;margin-bottom:12px}.nxui-result-icon{width:48px;height:48px;flex:0 0 48px;border-radius:15px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#176eff,#46bbff);box-shadow:0 10px 22px rgba(25,126,255,.28)}.nxui-result-icon svg{width:26px;height:26px}.nxui-result-title{font-size:16px;font-weight:900;color:#fff}.nxui-result-sub{font-size:11px;color:#83a2c3;margin-top:3px}.nxui-result-body{color:#d9e8f8;line-height:1.65;font-size:13px}.nxui-result-foot{margin-top:12px;color:#7891ad;font-size:10px}
      .nxui-choice-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.nxui-choice{border:1px solid rgba(94,160,235,.18);background:rgba(7,21,41,.8);color:#c9ddf3;border-radius:999px;padding:8px 11px;font-size:11px;font-weight:800;cursor:pointer}.nxui-choice.active{background:linear-gradient(135deg,#146dff,#36b0ff);border-color:transparent;color:#fff;box-shadow:0 8px 18px rgba(24,123,255,.24)}
      @keyframes nxuiFade{from{opacity:0}to{opacity:1}}@keyframes nxuiLift{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
      @media(max-width:620px){.nxui-backdrop{padding:10px;align-items:flex-end}.nxui-modal{width:100%;max-height:92vh;border-radius:26px 26px 18px 18px}.nxui-hero{grid-template-columns:72px 1fr;padding:22px 18px 14px}.nxui-orb{width:68px;height:68px;border-radius:21px}.nxui-orb svg{width:38px;height:38px}.nxui-form,.nxui-message{padding-left:16px;padding-right:16px}.nxui-grid{grid-template-columns:1fr}.nxui-field.nxui-wide{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function fieldMarkup(field) {
    const f = {...field};
    const name = esc(f.name || uid());
    const label = esc(f.label || f.name || 'Field');
    const fieldIcon = f.icon || 'spark';
    const wide = f.wide ? ' nxui-wide' : '';
    const required = f.required ? ' required' : '';
    const common = `data-nxui-field="${name}" name="${name}"${required}`;
    const attrs = [
      f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '',
      f.value !== undefined ? `value="${esc(f.value)}"` : '',
      f.min !== undefined ? `min="${esc(f.min)}"` : '',
      f.max !== undefined ? `max="${esc(f.max)}"` : '',
      f.step !== undefined ? `step="${esc(f.step)}"` : '',
      f.inputmode ? `inputmode="${esc(f.inputmode)}"` : '',
      f.autocomplete ? `autocomplete="${esc(f.autocomplete)}"` : 'autocomplete="off"'
    ].filter(Boolean).join(' ');
    let control = '';
    if (f.type === 'select') {
      const options = (f.options || []).map(option => {
        const item = typeof option === 'object' ? option : {value:option,label:option};
        const selected = String(item.value) === String(f.value ?? '') ? ' selected' : '';
        return `<option value="${esc(item.value)}"${selected}>${esc(item.label)}</option>`;
      }).join('');
      control = `<div class="nxui-control">${icon(fieldIcon)}<select class="nxui-select" ${common}>${options}</select></div>`;
    } else if (f.type === 'textarea') {
      control = `<div class="nxui-control textarea">${icon(fieldIcon)}<textarea class="nxui-textarea" ${common} ${f.rows ? `rows="${esc(f.rows)}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>${esc(f.value ?? '')}</textarea></div>`;
    } else {
      control = `<div class="nxui-control">${icon(fieldIcon)}<input class="nxui-input" type="${esc(f.type || 'text')}" ${common} ${attrs}></div>`;
    }
    const hint = f.hint ? `<div class="nxui-hint">${esc(f.hint)}</div>` : '';
    return `<div class="nxui-field${wide}" data-nxui-wrap="${name}"><label class="nxui-label">${icon(fieldIcon)}<span>${label}</span></label>${control}${hint}<div class="nxui-error">${esc(f.error || 'Please complete this field.')}</div></div>`;
  }

  function closeBackdrop(backdrop, result, resolve) {
    if (backdrop?.isConnected) {
      backdrop.style.opacity = '0';
      backdrop.style.transition = 'opacity .14s ease';
      unlockBodyIfSafe();
      setTimeout(() => {
        backdrop.remove();
        unlockBodyIfSafe();
      }, 150);
    } else {
      unlockBodyIfSafe();
    }
    resolve(result);
  }

  function form(config={}) {
    installStyles();
    installUnlockSafety();
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'nxui-backdrop';
      const formId = uid();
      backdrop.innerHTML = `<div class="nxui-modal" role="dialog" aria-modal="true" aria-labelledby="${formId}-title">
        <button class="nxui-close" type="button" aria-label="Close">×</button>
        <div class="nxui-hero"><div class="nxui-orb">${icon(config.icon || 'spark')}</div><div><div class="nxui-eyebrow">${esc(config.eyebrow || 'NEXUSNOVA SMART FORM')}</div><h2 class="nxui-title" id="${formId}-title">${esc(config.title || 'Continue')}</h2><p class="nxui-subtitle">${esc(config.subtitle || 'Complete the details below.')}</p></div></div>
        <form class="nxui-form" novalidate><div class="nxui-grid">${(config.fields || []).map(fieldMarkup).join('')}</div><div class="nxui-actions"><button class="nxui-btn secondary" type="button" data-nxui-cancel>${esc(config.cancelText || 'Cancel')}</button><button class="nxui-btn primary" type="submit">${esc(config.submitText || 'Continue')}</button></div></form>
      </div>`;
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      const formEl = backdrop.querySelector('form');
      const cancel = () => closeBackdrop(backdrop, null, resolve);
      backdrop.querySelector('.nxui-close')?.addEventListener('click', cancel);
      backdrop.querySelector('[data-nxui-cancel]')?.addEventListener('click', cancel);
      backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) cancel(); });
      formEl?.addEventListener('submit', event => {
        event.preventDefault();
        const result = {};
        let valid = true;
        (config.fields || []).forEach(field => {
          const input = formEl.querySelector(`[data-nxui-field="${CSS.escape(String(field.name))}"]`);
          const wrap = formEl.querySelector(`[data-nxui-wrap="${CSS.escape(String(field.name))}"]`);
          if (!input) return;
          const value = String(input.value ?? '').trim();
          const invalid = Boolean(field.required && !value) || (input.type === 'number' && value && !input.checkValidity());
          wrap?.classList.toggle('invalid', invalid);
          if (invalid) valid = false;
          result[field.name] = value;
        });
        if (!valid) return;
        closeBackdrop(backdrop, result, resolve);
      });
      setTimeout(() => backdrop.querySelector('input,select,textarea')?.focus(), 80);
    });
  }

  function message(config={}, confirmMode=false) {
    installStyles();
    installUnlockSafety();
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'nxui-backdrop';
      const id = uid();
      backdrop.innerHTML = `<div class="nxui-modal" role="dialog" aria-modal="true" aria-labelledby="${id}-title"><button class="nxui-close" type="button" aria-label="Close">×</button><div class="nxui-hero"><div class="nxui-orb">${icon(config.icon || (confirmMode?'security':'spark'))}</div><div><div class="nxui-eyebrow">${esc(config.eyebrow || 'NEXUSNOVA')}</div><h2 class="nxui-title" id="${id}-title">${esc(config.title || (confirmMode?'Confirm action':'NexusNova'))}</h2><p class="nxui-subtitle">${esc(config.subtitle || '')}</p></div></div><div class="nxui-message"><div class="nxui-message-box">${esc(config.text || config.message || '')}</div><div class="nxui-actions">${confirmMode?`<button class="nxui-btn secondary" data-nxui-no type="button">${esc(config.cancelText || 'Cancel')}</button>`:''}<button class="nxui-btn primary" data-nxui-yes type="button">${esc(config.buttonText || config.confirmText || 'OK')}</button></div></div></div>`;
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      const finish = result => closeBackdrop(backdrop, result, resolve);
      backdrop.querySelector('.nxui-close')?.addEventListener('click', () => finish(confirmMode ? false : true));
      backdrop.querySelector('[data-nxui-no]')?.addEventListener('click', () => finish(false));
      backdrop.querySelector('[data-nxui-yes]')?.addEventListener('click', () => finish(true));
      backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) finish(confirmMode ? false : true); });
    });
  }

  function toast(text) {
    installStyles();
    let el = document.getElementById('nxPremiumToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nxPremiumToast';
      el.className = 'nxui-toast';
      document.body.appendChild(el);
    }
    el.textContent = String(text || '');
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function resultShell({title='', subtitle='', icon:iconName='spark', bodyHtml='', footer='' }={}) {
    return `<div class="nxui-result-shell"><div class="nxui-result-head"><div class="nxui-result-icon">${icon(iconName)}</div><div><div class="nxui-result-title">${esc(title)}</div>${subtitle?`<div class="nxui-result-sub">${esc(subtitle)}</div>`:''}</div></div><div class="nxui-result-body">${bodyHtml}</div>${footer?`<div class="nxui-result-foot">${esc(footer)}</div>`:''}</div>`;
  }

  installStyles();
  installUnlockSafety();
  unlockBodyIfSafe();
  window.NexusNovaUI = Object.freeze({
    version:'1.0.2',
    icon,
    esc,
    form,
    alert:config => message(config,false),
    confirm:config => message(config,true),
    toast,
    resultShell
  });
  window.dispatchEvent(new CustomEvent('nexusnova:premium-ui-ready'));
})();