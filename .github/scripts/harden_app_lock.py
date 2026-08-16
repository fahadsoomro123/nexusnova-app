from pathlib import Path

path = Path('js/nexusnova-security-lock-v1.js')
text = path.read_text(encoding='utf-8')

replacements = [
(
"""  const KEY = 'nexusnova_browser_app_lock_v1';\n  const $ = id => document.getElementById(id);\n  let setupPromise = null;\n""",
"""  const KEY = 'nexusnova_browser_app_lock_v1';\n  const LEGACY_KDF_ITERATIONS = 140000;\n  const CURRENT_KDF_ITERATIONS = 600000;\n  const AUTO_RELOCK_AFTER_HIDDEN_MS = 60 * 1000;\n  const MAX_BACKOFF_MS = 60 * 1000;\n  const $ = id => document.getElementById(id);\n  let setupPromise = null;\n  let failedAttempts = 0;\n  let blockedUntil = 0;\n  let hiddenAt = 0;\n"""
),
(
"""  async function pinHash(pin, salt) {\n    const material = await crypto.subtle.importKey(\n      'raw',\n      new TextEncoder().encode(pin),\n      'PBKDF2',\n      false,\n      ['deriveBits']\n    );\n    const bits = await crypto.subtle.deriveBits(\n      { name:'PBKDF2', salt, iterations:140000, hash:'SHA-256' },\n      material,\n      256\n    );\n    return bytesToB64(new Uint8Array(bits));\n  }\n""",
"""  async function pinHash(pin, salt, iterations) {\n    const rounds = Number(iterations);\n    if (![LEGACY_KDF_ITERATIONS, CURRENT_KDF_ITERATIONS].includes(rounds)) {\n      throw new Error('Unsupported App Lock security parameters.');\n    }\n    const material = await crypto.subtle.importKey(\n      'raw',\n      new TextEncoder().encode(pin),\n      'PBKDF2',\n      false,\n      ['deriveBits']\n    );\n    const bits = await crypto.subtle.deriveBits(\n      { name:'PBKDF2', salt, iterations:rounds, hash:'SHA-256' },\n      material,\n      256\n    );\n    return bytesToB64(new Uint8Array(bits));\n  }\n"""
),
(
"""  function validPin(pin) {\n    return /^\\d{4,12}$/.test(String(pin || ''));\n  }\n\n  async function verify(pin) {\n    const config = readConfig();\n    if (!config || !validPin(pin) || !crypto?.subtle) return false;\n    try {\n      const hash = await pinHash(pin, b64ToBytes(config.salt));\n      return hash === config.hash;\n    } catch (_) {\n      return false;\n    }\n  }\n""",
"""  function validLegacyPin(pin) {\n    return /^\\d{4,12}$/.test(String(pin || ''));\n  }\n\n  function validNewPin(pin) {\n    return /^\\d{6,12}$/.test(String(pin || ''));\n  }\n\n  function remainingBackoffMs() {\n    return Math.max(0, blockedUntil - Date.now());\n  }\n\n  function recordFailedAttempt() {\n    failedAttempts += 1;\n    if (failedAttempts < 3) return;\n    const exponent = Math.min(5, failedAttempts - 3);\n    const delay = Math.min(MAX_BACKOFF_MS, 2000 * (2 ** exponent));\n    blockedUntil = Date.now() + delay;\n  }\n\n  function resetAttemptState() {\n    failedAttempts = 0;\n    blockedUntil = 0;\n  }\n\n  async function verify(pin) {\n    if (remainingBackoffMs() > 0) return false;\n    const config = readConfig();\n    if (!config || !validLegacyPin(pin) || !crypto?.subtle) {\n      recordFailedAttempt();\n      return false;\n    }\n    try {\n      const salt = b64ToBytes(config.salt);\n      if (salt.length !== 16) throw new Error('Invalid App Lock salt.');\n      const iterations = config.kdfIterations == null\n        ? LEGACY_KDF_ITERATIONS\n        : Number(config.kdfIterations);\n      const hash = await pinHash(pin, salt, iterations);\n      const ok = hash === config.hash;\n      if (ok) resetAttemptState();\n      else recordFailedAttempt();\n      return ok;\n    } catch (_) {\n      recordFailedAttempt();\n      return false;\n    }\n  }\n"""
),
(
"""        <p>Create a 4–12 digit PIN for this browser. The raw PIN is never stored; only a PBKDF2 hash and random salt are saved locally.</p>\n""",
"""        <p>Create a 6–12 digit PIN for this browser. The raw PIN is never stored; only a PBKDF2 hash and random salt are saved locally.</p>\n"""
),
(
"""        <input id=\"nxAppLockSetupPin\" class=\"nx-lock-input\" type=\"password\" inputmode=\"numeric\" pattern=\"[0-9]*\" maxlength=\"12\" autocomplete=\"new-password\" placeholder=\"New PIN\">\n        <input id=\"nxAppLockSetupConfirm\" class=\"nx-lock-input\" type=\"password\" inputmode=\"numeric\" pattern=\"[0-9]*\" maxlength=\"12\" autocomplete=\"new-password\" placeholder=\"Confirm PIN\">\n""",
"""        <input id=\"nxAppLockSetupPin\" class=\"nx-lock-input\" type=\"password\" inputmode=\"numeric\" pattern=\"[0-9]*\" minlength=\"6\" maxlength=\"12\" autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\" placeholder=\"New 6–12 digit PIN\">\n        <input id=\"nxAppLockSetupConfirm\" class=\"nx-lock-input\" type=\"password\" inputmode=\"numeric\" pattern=\"[0-9]*\" minlength=\"6\" maxlength=\"12\" autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\" placeholder=\"Confirm PIN\">\n"""
),
(
"""        if (!validPin(first)) {\n          if (status) status.textContent = 'PIN must contain 4–12 digits.';\n          return;\n        }\n""",
"""        if (!validNewPin(first)) {\n          if (status) status.textContent = 'New PIN must contain 6–12 digits.';\n          return;\n        }\n"""
),
(
"""          const salt = crypto.getRandomValues(new Uint8Array(16));\n          const hash = await pinHash(first, salt);\n          localStorage.setItem(KEY, JSON.stringify({\n            salt:bytesToB64(salt),\n            hash,\n            createdAt:Date.now(),\n            version:2\n          }));\n""",
"""          const salt = crypto.getRandomValues(new Uint8Array(16));\n          const hash = await pinHash(first, salt, CURRENT_KDF_ITERATIONS);\n          localStorage.setItem(KEY, JSON.stringify({\n            salt:bytesToB64(salt),\n            hash,\n            kdfIterations:CURRENT_KDF_ITERATIONS,\n            createdAt:Date.now(),\n            version:3\n          }));\n"""
),
(
"""        <input id=\"nxAppLockPin\" class=\"nx-lock-input\" type=\"password\" inputmode=\"numeric\" pattern=\"[0-9]*\" maxlength=\"12\" autocomplete=\"off\" placeholder=\"NexusNova PIN\">\n""",
"""        <input id=\"nxAppLockPin\" class=\"nx-lock-input\" type=\"password\" inputmode=\"numeric\" pattern=\"[0-9]*\" maxlength=\"12\" autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\" placeholder=\"NexusNova PIN\">\n"""
),
(
"""    const unlock = async () => {\n      const pin = String($('nxAppLockPin')?.value || '');\n      const status = $('nxAppLockStatus');\n      if (await verify(pin)) {\n        if ($('nxAppLockPin')) $('nxAppLockPin').value = '';\n        if (status) status.textContent = '';\n        delete overlay.dataset.removeConfirmUntil;\n        hideOverlay(overlay);\n      } else if (status) {\n        status.textContent = 'Wrong NexusNova PIN.';\n      }\n    };\n""",
"""    const unlock = async () => {\n      const pinInput = $('nxAppLockPin');\n      const pin = String(pinInput?.value || '');\n      const status = $('nxAppLockStatus');\n      if (await verify(pin)) {\n        if (pinInput) pinInput.value = '';\n        if (status) status.textContent = '';\n        delete overlay.dataset.removeConfirmUntil;\n        hideOverlay(overlay);\n      } else {\n        if (pinInput) pinInput.value = '';\n        const waitMs = remainingBackoffMs();\n        if (status) {\n          status.textContent = waitMs > 0\n            ? `Too many attempts. Try again in ${Math.ceil(waitMs / 1000)} seconds.`\n            : 'Wrong NexusNova PIN.';\n        }\n      }\n    };\n"""
),
(
"""      if (!(await verify(pin))) {\n        if (status) status.textContent = 'Enter the correct NexusNova PIN before removing App Lock.';\n        return;\n      }\n""",
"""      if (!(await verify(pin))) {\n        if ($('nxAppLockPin')) $('nxAppLockPin').value = '';\n        const waitMs = remainingBackoffMs();\n        if (status) {\n          status.textContent = waitMs > 0\n            ? `Too many attempts. Try again in ${Math.ceil(waitMs / 1000)} seconds.`\n            : 'Enter the correct NexusNova PIN before removing App Lock.';\n        }\n        return;\n      }\n"""
),
(
"""  window.nexusLockAppNow = lock;\n""",
"""  document.addEventListener('visibilitychange', () => {\n    if (document.hidden) {\n      hiddenAt = Date.now();\n      return;\n    }\n    const wasHiddenAt = hiddenAt;\n    hiddenAt = 0;\n    if (\n      readConfig() &&\n      wasHiddenAt > 0 &&\n      Date.now() - wasHiddenAt >= AUTO_RELOCK_AFTER_HIDDEN_MS\n    ) {\n      lock();\n    }\n  });\n\n  window.nexusLockAppNow = lock;\n"""
),
(
"""    version:'browser-pin-v2',\n""",
"""    version:'browser-pin-v3',\n"""
),
(
"""  window.nexusSecurityLockVersion = 'browser-pin-v2';\n""",
"""  window.nexusSecurityLockVersion = 'browser-pin-v3';\n"""
),
(
"""/* NexusNova Security Lock v2\n   Genuine browser-side NexusNova PIN lock using Web Crypto PBKDF2.\n   - No raw PIN is stored.\n   - No browser prompt() setup flow.\n   - Existing v1 PIN records remain compatible (same PBKDF2 parameters).\n   Android biometric/device credential remains a native upgrade. */\n""",
"""/* NexusNova Security Lock v3\n   Genuine browser-side NexusNova PIN lock using Web Crypto PBKDF2.\n   - No raw PIN is stored.\n   - No browser prompt() setup flow.\n   - Existing v1/v2 PIN records remain compatible with the legacy KDF.\n   - New locks use a stronger KDF, retry backoff and background auto re-lock.\n   Android biometric/device credential remains a native upgrade. */\n"""
),
]

for old, new in replacements:
    if new in text:
        continue
    if old not in text:
        raise SystemExit('App Lock source changed unexpectedly; refusing unsafe automatic edit. Missing patch block.')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Hardened App Lock with versioned KDF, stronger new PINs, retry backoff and background auto re-lock.')
