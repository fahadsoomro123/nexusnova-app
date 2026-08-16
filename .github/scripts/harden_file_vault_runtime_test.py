from pathlib import Path

path = Path('.github/scripts/nexusnova-documents-vault-security-runtime.mjs')
text = path.read_text(encoding='utf-8')

text = text.replace("await page.fill('#nxVaultPass','vault-2468');", "await page.fill('#nxVaultPass','vault-2468-safe');", 1)
text = text.replace("assert.equal(vaultState.localStorage.includes('vault-2468'),false);", "assert.equal(vaultState.localStorage.includes('vault-2468-safe'),false);", 1)

old_state = """      hasIv:Array.isArray(row?.iv)&&row.iv.length===12,\n      cipherContainsPlain:cipherText.includes('TOP SECRET LOCAL VAULT DATA'),\n      localStorage:JSON.stringify({...localStorage})\n"""
new_state = """      hasIv:Array.isArray(row?.iv)&&row.iv.length===12,\n      cryptoVersion:row?.cryptoVersion,\n      kdfIterations:row?.kdfIterations,\n      cipherContainsPlain:cipherText.includes('TOP SECRET LOCAL VAULT DATA'),\n      localStorage:JSON.stringify({...localStorage}),\n      passphraseField:document.getElementById('nxVaultPass')?.value||''\n"""
if new_state not in text:
    if old_state not in text:
        raise SystemExit('Vault runtime state block changed unexpectedly.')
    text = text.replace(old_state, new_state, 1)

old_asserts = """  assert.equal(vaultState.hasIv,true);\n  assert.equal(vaultState.cipherContainsPlain,false);\n  assert.equal(vaultState.localStorage.includes('vault-2468-safe'),false);\n  console.log('PASS File Vault stores ciphertext in IndexedDB with salt/IV and never stores the passphrase');\n\n  const vaultDownloadPromise=page.waitForEvent('download');\n"""
new_asserts = """  assert.equal(vaultState.hasIv,true);\n  assert.equal(vaultState.cryptoVersion,2);\n  assert.equal(vaultState.kdfIterations,600000);\n  assert.equal(vaultState.cipherContainsPlain,false);\n  assert.equal(vaultState.localStorage.includes('vault-2468-safe'),false);\n  assert.equal(vaultState.passphraseField,'');\n  console.log('PASS File Vault stores versioned ciphertext and clears the passphrase after encryption');\n\n  await page.fill('#nxVaultPass','vault-2468-safe');\n  const vaultDownloadPromise=page.waitForEvent('download');\n"""
if new_asserts not in text:
    if old_asserts not in text:
        raise SystemExit('Vault runtime assertions changed unexpectedly.')
    text = text.replace(old_asserts, new_asserts, 1)

old_download = """  await page.waitForFunction(()=>document.getElementById('nxVaultStatus')?.textContent?.includes('decrypted and downloaded'));\n  console.log('PASS File Vault decrypts the selected local record only when the correct passphrase is supplied');\n"""
new_download = """  await page.waitForFunction(()=>document.getElementById('nxVaultStatus')?.textContent?.includes('decrypted and downloaded'));\n  assert.equal(await page.inputValue('#nxVaultPass'),'');\n  console.log('PASS File Vault decrypts with the correct passphrase and clears it immediately after use');\n"""
if new_download not in text:
    if old_download not in text:
        raise SystemExit('Vault runtime download block changed unexpectedly.')
    text = text.replace(old_download, new_download, 1)

path.write_text(text, encoding='utf-8')
print('Updated File Vault runtime regression test for KDF v2 and passphrase clearing.')
