from pathlib import Path

path = Path('.github/scripts/nexusnova-documents-vault-security-runtime.mjs')
text = path.read_text(encoding='utf-8')

replacements = [
(
"""  await page.addScriptTag({url:`${base}/js/nexusnova-security-lock-v1.js?v=2`});\n  await page.waitForFunction(()=>window.__nxSecurityLockV2===true && document.getElementById('nxSecurityAppLock'));\n  assert.equal(await page.evaluate(()=>window.nexusSecurityLockVersion),'browser-pin-v2');\n""",
"""  await page.addScriptTag({url:`${base}/js/nexusnova-security-lock-v1.js?v=3`});\n  await page.waitForFunction(()=>window.__nxSecurityLockV2===true && document.getElementById('nxSecurityAppLock'));\n  assert.equal(await page.evaluate(()=>window.nexusSecurityLockVersion),'browser-pin-v3');\n"""
),
(
"""  await page.fill('#nxAppLockSetupPin','2468');\n  await page.fill('#nxAppLockSetupConfirm','2468');\n""",
"""  await page.fill('#nxAppLockSetupPin','246810');\n  await page.fill('#nxAppLockSetupConfirm','246810');\n"""
),
(
"""  assert.ok(lockConfig.includes('\"hash\"'));\n  assert.ok(lockConfig.includes('\"salt\"'));\n  assert.equal(lockConfig.includes('2468'),false);\n""",
"""  assert.ok(lockConfig.includes('\"hash\"'));\n  assert.ok(lockConfig.includes('\"salt\"'));\n  assert.ok(lockConfig.includes('\"version\":3'));\n  assert.ok(lockConfig.includes('\"kdfIterations\":600000'));\n  assert.equal(lockConfig.includes('246810'),false);\n"""
),
(
"""  console.log('PASS Security Lock V2 uses an in-app setup flow, stores only PBKDF2 material, and no longer mislabels the PIN as a device PIN');\n\n  await page.fill('#nxAppLockPin','1111');\n  await page.click('#nxAppUnlockBtn');\n  await page.waitForFunction(()=>document.getElementById('nxAppLockStatus')?.textContent?.includes('Wrong NexusNova PIN'));\n  await page.fill('#nxAppLockPin','2468');\n  await page.click('#nxAppUnlockBtn');\n  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='none');\n\n  await page.click('#nxSecurityAppLock');\n  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='flex');\n  await page.fill('#nxAppLockPin','2468');\n""",
"""  console.log('PASS Security Lock V3 uses stronger versioned PBKDF2 material and never stores the raw PIN');\n\n  for (let attempt=0; attempt<3; attempt+=1) {\n    await page.fill('#nxAppLockPin','111111');\n    await page.click('#nxAppUnlockBtn');\n  }\n  await page.waitForFunction(()=>document.getElementById('nxAppLockStatus')?.textContent?.includes('Too many attempts'));\n  assert.equal(await page.inputValue('#nxAppLockPin'),'');\n  console.log('PASS Security Lock applies retry backoff and clears failed PIN input');\n\n  await page.waitForTimeout(2200);\n  await page.fill('#nxAppLockPin','246810');\n  await page.click('#nxAppUnlockBtn');\n  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='none');\n\n  await page.click('#nxSecurityAppLock');\n  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='flex');\n  await page.fill('#nxAppLockPin','246810');\n"""
),
(
"""  console.log('PASS Security Lock verifies wrong/correct PINs and removes lock with in-app double confirmation without legacy Coming Soon');\n\n  assert.equal(errors.length,0,errors.join('\\n'));\n""",
"""  console.log('PASS Security Lock verifies the strong PIN and removes lock with in-app double confirmation');\n\n  // Existing v1/v2 4-digit records must remain unlockable after the v3 upgrade.\n  await page.evaluate(async()=>{\n    const pin='2468';\n    const salt=crypto.getRandomValues(new Uint8Array(16));\n    const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);\n    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:140000,hash:'SHA-256'},material,256);\n    let binary='';\n    new Uint8Array(bits).forEach(byte=>{binary+=String.fromCharCode(byte);});\n    let saltBinary='';\n    salt.forEach(byte=>{saltBinary+=String.fromCharCode(byte);});\n    localStorage.setItem('nexusnova_browser_app_lock_v1',JSON.stringify({\n      salt:btoa(saltBinary),\n      hash:btoa(binary),\n      createdAt:Date.now(),\n      version:2\n    }));\n    window.nexusLockAppNow();\n  });\n  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='flex');\n  await page.fill('#nxAppLockPin','2468');\n  await page.click('#nxAppUnlockBtn');\n  await page.waitForFunction(()=>document.getElementById('nxAppLockOverlay')?.style.display==='none');\n  console.log('PASS Security Lock V3 remains backward-compatible with legacy 4-digit v1/v2 lock records');\n  await page.evaluate(()=>localStorage.removeItem('nexusnova_browser_app_lock_v1'));\n\n  assert.equal(errors.length,0,errors.join('\\n'));\n"""
),
]

for old, new in replacements:
    if new in text:
        continue
    if old not in text:
        raise SystemExit('App Lock runtime source changed unexpectedly; refusing edit. Missing block.')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Updated browser regression for App Lock v3 KDF, backoff and legacy compatibility.')
