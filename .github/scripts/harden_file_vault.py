from pathlib import Path

path = Path('js/nexusnova-file-vault-v1.js')
text = path.read_text(encoding='utf-8')

replacements = [
(
"""  const MAX_FILE = 25 * 1024 * 1024;\n\n  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#039;'}[c]));\n  const owner = () => String(window.nexusAccountId || 'guest');\n""",
"""  const MAX_FILE = 25 * 1024 * 1024;\n  const MAX_FILES_PER_BATCH = 10;\n  const LEGACY_KDF_ITERATIONS = 150000;\n  const CURRENT_KDF_ITERATIONS = 600000;\n\n  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#039;'}[c]));\n  const owner = () => String(window.nexusAccountId || '').trim();\n\n  function requireOwner() {\n    const id = owner();\n    if (!id) throw new Error('Sign in and wait for your NexusNova account to finish loading before using File Vault.');\n    return id;\n  }\n\n  function clearPassphrase() {\n    const input = $('nxVaultPass');\n    if (input) input.value = '';\n  }\n"""
),
(
"""  async function deriveKey(passphrase, salt) {\n    const material = await crypto.subtle.importKey(\n      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']\n    );\n    return crypto.subtle.deriveKey(\n      {name:'PBKDF2', salt, iterations:150000, hash:'SHA-256'},\n      material,\n      {name:'AES-GCM', length:256},\n      false,\n      ['encrypt','decrypt']\n    );\n  }\n\n  async function encryptFile(file, passphrase) {\n    const salt = crypto.getRandomValues(new Uint8Array(16));\n    const iv = crypto.getRandomValues(new Uint8Array(12));\n    const key = await deriveKey(passphrase, salt);\n    const plain = await file.arrayBuffer();\n    const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, plain);\n    return {salt:Array.from(salt), iv:Array.from(iv), encrypted};\n  }\n\n  async function decryptRecord(record, passphrase) {\n    const salt = new Uint8Array(record.salt || []);\n    const iv = new Uint8Array(record.iv || []);\n    const key = await deriveKey(passphrase, salt);\n    return crypto.subtle.decrypt({name:'AES-GCM', iv}, key, record.encrypted);\n  }\n""",
"""  async function deriveKey(passphrase, salt, iterations) {\n    if (![LEGACY_KDF_ITERATIONS, CURRENT_KDF_ITERATIONS].includes(Number(iterations))) {\n      throw new Error('Unsupported vault encryption parameters.');\n    }\n    const material = await crypto.subtle.importKey(\n      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']\n    );\n    return crypto.subtle.deriveKey(\n      {name:'PBKDF2', salt, iterations:Number(iterations), hash:'SHA-256'},\n      material,\n      {name:'AES-GCM', length:256},\n      false,\n      ['encrypt','decrypt']\n    );\n  }\n\n  async function encryptFile(file, passphrase) {\n    const salt = crypto.getRandomValues(new Uint8Array(16));\n    const iv = crypto.getRandomValues(new Uint8Array(12));\n    const key = await deriveKey(passphrase, salt, CURRENT_KDF_ITERATIONS);\n    const plain = await file.arrayBuffer();\n    const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, plain);\n    return {\n      cryptoVersion:2,\n      kdfIterations:CURRENT_KDF_ITERATIONS,\n      salt:Array.from(salt),\n      iv:Array.from(iv),\n      encrypted\n    };\n  }\n\n  async function decryptRecord(record, passphrase) {\n    const salt = new Uint8Array(record.salt || []);\n    const iv = new Uint8Array(record.iv || []);\n    if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid vault encryption parameters.');\n    const iterations = record.kdfIterations == null\n      ? LEGACY_KDF_ITERATIONS\n      : Number(record.kdfIterations);\n    const key = await deriveKey(passphrase, salt, iterations);\n    return crypto.subtle.decrypt({name:'AES-GCM', iv}, key, record.encrypted);\n  }\n"""
),
(
"""  async function listRecords() {\n    const db = await openDb();\n    try {\n      const store = db.transaction(STORE, 'readonly').objectStore(STORE);\n      let rows = [];\n      if (store.indexNames.contains('owner')) {\n        rows = await requestResult(store.index('owner').getAll(owner()));\n      } else {\n        rows = (await requestResult(store.getAll())).filter(row => row.owner === owner());\n      }\n""",
"""  async function listRecords() {\n    const accountId = requireOwner();\n    const db = await openDb();\n    try {\n      const store = db.transaction(STORE, 'readonly').objectStore(STORE);\n      let rows = [];\n      if (store.indexNames.contains('owner')) {\n        rows = await requestResult(store.index('owner').getAll(accountId));\n      } else {\n        rows = (await requestResult(store.getAll())).filter(row => row.owner === accountId);\n      }\n"""
),
(
"""    if (!files.length) return status('Choose one or more files first.', false);\n    if (passphrase.length < 6) return status('Use a passphrase with at least 6 characters.', false);\n    if (!crypto?.subtle || !window.indexedDB) return status('Encrypted vault is not supported in this browser.', false);\n\n    const invalid = files.find(file => file.size > MAX_FILE);\n""",
"""    if (!files.length) return status('Choose one or more files first.', false);\n    if (files.length > MAX_FILES_PER_BATCH) return status(`Choose at most ${MAX_FILES_PER_BATCH} files at a time.`, false);\n    if (passphrase.length < 12) return status('Use a vault passphrase with at least 12 characters for new files.', false);\n    if (!crypto?.subtle || !window.indexedDB) return status('Encrypted vault is not supported in this browser.', false);\n    let accountId;\n    try { accountId = requireOwner(); }\n    catch (error) { return status(error.message, false); }\n\n    const invalid = files.find(file => file.size > MAX_FILE);\n"""
),
(
"""          owner: owner(),\n          name: file.name,\n          type: file.type || 'application/octet-stream',\n          size: file.size,\n          createdAt: Date.now(),\n          salt: payload.salt,\n          iv: payload.iv,\n          encrypted: payload.encrypted\n""",
"""          owner: accountId,\n          name: file.name,\n          type: file.type || 'application/octet-stream',\n          size: file.size,\n          createdAt: Date.now(),\n          cryptoVersion: payload.cryptoVersion,\n          kdfIterations: payload.kdfIterations,\n          salt: payload.salt,\n          iv: payload.iv,\n          encrypted: payload.encrypted\n"""
),
(
"""    } finally {\n      if (button) button.disabled = false;\n    }\n  }\n\n  async function download(id) {\n""",
"""    } finally {\n      clearPassphrase();\n      if (button) button.disabled = false;\n    }\n  }\n\n  async function download(id) {\n"""
),
(
"""    try {\n      status('Decrypting file…');\n      const record = await getRecord(id);\n      if (!record || record.owner !== owner()) throw new Error('File not found.');\n      const plain = await decryptRecord(record, passphrase);\n""",
"""    try {\n      status('Decrypting file…');\n      const accountId = requireOwner();\n      const record = await getRecord(id);\n      if (!record || record.owner !== accountId) throw new Error('File not found.');\n      const plain = await decryptRecord(record, passphrase);\n"""
),
(
"""    } catch (error) {\n      console.warn('NexusNova vault decrypt:', error);\n      status('Could not decrypt. Check the passphrase.', false);\n    }\n  }\n\n  async function remove(id) {\n""",
"""    } catch (error) {\n      console.warn('NexusNova vault decrypt:', error);\n      status('Could not decrypt. Check the passphrase.', false);\n    } finally {\n      clearPassphrase();\n    }\n  }\n\n  async function remove(id) {\n"""
),
(
"""    try {\n      const record = await getRecord(id);\n      if (!record || record.owner !== owner()) return;\n      await deleteRecord(id);\n""",
"""    try {\n      const accountId = requireOwner();\n      const record = await getRecord(id);\n      if (!record || record.owner !== accountId) return;\n      await deleteRecord(id);\n"""
),
(
"""        <input id=\"nxVaultPass\" type=\"password\" class=\"tool-input\" autocomplete=\"new-password\" placeholder=\"Vault passphrase (not stored)\">\n""",
"""        <input id=\"nxVaultPass\" type=\"password\" class=\"tool-input\" autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\" placeholder=\"Vault passphrase (12+ chars; not stored)\">\n"""
),
]

for old, new in replacements:
    if new in text:
        continue
    if old not in text:
        raise SystemExit('File Vault source changed unexpectedly; refusing unsafe automatic edit. Missing patch block.')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Hardened File Vault account isolation, KDF versioning, passphrase lifetime, and batch limits.')
