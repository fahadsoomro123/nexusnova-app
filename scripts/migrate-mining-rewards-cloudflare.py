from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_exact(path, old, new, label):
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    if new in text and old not in text:
        print(f'{label}: already migrated')
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one source match, found {count}')
    target.write_text(text.replace(old, new), encoding='utf-8')
    print(f'{label}: migrated')
    return True


changed = False

# Tasks / Daily Reward: Firebase callable -> Cloudflare Worker client.
changed |= replace_exact(
    'fresh-rebuild/src/features/apps/core-apps.js',
    "import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';\n",
    "import { claimDailyRewardCloudflare } from '../../core/nova-mining-rewards-store.js';\n",
    'tasks import'
)
changed |= replace_exact(
    'fresh-rebuild/src/features/apps/core-apps.js',
    "  firebaseApp,\n  firebaseAuth,",
    "  firebaseAuth,",
    'tasks firebaseApp cleanup'
)
changed |= replace_exact(
    'fresh-rebuild/src/features/apps/core-apps.js',
    "      const call = httpsCallable(getFunctions(firebaseApp,'us-central1'),'claimDailyReward');\n      const response = await call({ source:'fresh-rebuild-daily-test-gate' });\n      const data = response?.data || {};",
    "      const data = await claimDailyRewardCloudflare({ source:'fresh-rebuild-daily-test-gate' });",
    'daily reward callable'
)

# Premium Nova Vault: normal Vault, 10X, Booster, Rain and Time Warp -> Cloudflare Worker.
changed |= replace_exact(
    'fresh-rebuild/src/features/apps/nova-vault-safe.js',
    "import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';\n",
    "import { callNovaMiningRewards } from '../../core/nova-mining-rewards-store.js';\n",
    'vault import'
)
changed |= replace_exact(
    'fresh-rebuild/src/features/apps/nova-vault-safe.js',
    "import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';",
    "import { firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';",
    'vault firebaseApp cleanup'
)
changed |= replace_exact(
    'fresh-rebuild/src/features/apps/nova-vault-safe.js',
    "async function secureCall(name, data = {}) {\n  await requireFirebaseUser({ write:true });\n  const call = httpsCallable(getFunctions(firebaseApp, 'us-central1'), name);\n  const response = await call(data);\n  return response?.data || {};\n}",
    "async function secureCall(name, data = {}) {\n  return callNovaMiningRewards(name, data);\n}",
    'vault callable bridge'
)

# Legacy/enhancement 10X path is also redirected so no hidden Firebase callable remains.
changed |= replace_exact(
    'fresh-rebuild/src/features/apps/mining-integrations.js',
    "import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';\n",
    "import { callNovaMiningRewards } from '../../core/nova-mining-rewards-store.js';\n",
    'mining integration import'
)
changed |= replace_exact(
    'fresh-rebuild/src/features/apps/mining-integrations.js',
    "import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';",
    "import { firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';",
    'mining integration firebaseApp cleanup'
)
changed |= replace_exact(
    'fresh-rebuild/src/features/apps/mining-integrations.js',
    "      const call = httpsCallable(getFunctions(firebaseApp, 'us-central1'), 'openNovaVaultBoosted');\n      const response = await call({ source:'fresh-rebuild-10x' });\n      const data = response?.data || {};",
    "      const data = await callNovaMiningRewards('openNovaVaultBoosted', { source:'fresh-rebuild-10x' });",
    'mining integration 10x callable'
)

# Hard safety checks: do not allow this migration to drift into Mine core state files.
for protected in [
    'fresh-rebuild/src/features/mine/mine-screen.js',
    'fresh-rebuild/src/core/drive-cloud-store.js',
    'fresh-rebuild/src/core/drive-track-persistence.js'
]:
    if not (ROOT / protected).exists():
        raise SystemExit(f'protected source missing: {protected}')

for migrated in [
    'fresh-rebuild/src/features/apps/core-apps.js',
    'fresh-rebuild/src/features/apps/nova-vault-safe.js',
    'fresh-rebuild/src/features/apps/mining-integrations.js'
]:
    text = (ROOT / migrated).read_text(encoding='utf-8')
    if 'httpsCallable(' in text or 'getFunctions(' in text:
        raise SystemExit(f'Firebase callable dependency still present in {migrated}')

print('Cloudflare Tasks + Nova Vault migration:', 'CHANGED' if changed else 'ALREADY_APPLIED')
