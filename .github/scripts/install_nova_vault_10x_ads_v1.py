from pathlib import Path

ROOT = Path('.')


def patch_functions_index() -> None:
    print('INSTALL step: functions export wiring')
    path = ROOT / 'functions/index.js'
    text = path.read_text(encoding='utf-8')
    if 'require("./novaVault10x")' in text and 'require("./admobRewardedSsvV2")' in text:
        return

    # The current file intentionally has no trailing newline, so never depend
    # on one for this anchor.
    anchor = 'Object.assign(exports, require("./admobRewardedSsv"));'
    if anchor not in text:
        raise SystemExit('functions export wiring: admobRewardedSsv anchor missing')
    block = (
        'Object.assign(exports, require("./admobRewardedSsv"));\n'
        'Object.assign(exports, require("./novaVault10x"));\n'
        '// v2 intentionally loads last so the deployed admobRewardedSsv export\n'
        '// routes both Watch Ad and Nova Vault 10x through one signed endpoint.\n'
        'Object.assign(exports, require("./admobRewardedSsvV2"));'
    )
    text = text.replace(anchor, block, 1)
    path.write_text(text, encoding='utf-8')


def patch_after_core_loader() -> None:
    print('INSTALL step: post-core Vault10x + Hub ad loaders')
    path = ROOT / 'js/nexusnova-page2-after-core-v2.js'
    text = path.read_text(encoding='utf-8')
    if (
        'nexusnova-nova-vault-10x-v1.js?v=1' in text
        and 'nexusnova-hub-ad-gate-v1.js?v=1' in text
    ):
        return

    marker = """    try {
      await import('./nexusnova-nova-hub-nav-v1.js?v=1');
    } catch (error) {
      console.warn('NexusNova Nova Hub navigation readiness:', error);
    }

"""
    if marker not in text:
        raise SystemExit('after-core loader: Nova Hub readiness anchor missing')

    addition = marker + """    // Nova Vault remains optional/post-core so rewards can never hold the
    // Android dashboard behind startup. The 10x layer is additive and keeps
    // TEST rewarded ads value-free.
    try {
      await import('./nexusnova-nova-vault-v1.js?v=2');
      await import('./nexusnova-nova-vault-10x-v1.js?v=1');
    } catch (error) {
      console.warn('NexusNova Nova Vault 10x:', error);
    }

    // Frequency-capped interstitial wrapper only. It does not redesign Nova Hub
    // and protected destinations bypass it completely.
    try {
      await import('./nexusnova-hub-ad-gate-v1.js?v=1');
    } catch (error) {
      console.warn('NexusNova Nova Hub ad gate:', error);
    }

"""
    text = text.replace(marker, addition, 1)
    path.write_text(text, encoding='utf-8')


def patch_service_worker() -> None:
    print('INSTALL step: service-worker cache wiring')
    path = ROOT / 'sw.js'
    text = path.read_text(encoding='utf-8')

    if 'nexusnova-shell-v25-vault10x-ads' not in text:
        old = 'const CACHE = "nexusnova-shell-v24-auth-startup-recovery";'
        if old not in text:
            raise SystemExit('service-worker: expected v24 cache anchor missing')
        text = text.replace(
            old,
            'const CACHE = "nexusnova-shell-v25-vault10x-ads";',
            1,
        )

    if '"./js/nexusnova-nova-vault-10x-v1.js"' not in text:
        marker = '  "./js/nexusnova-nova-vault-v1.js",\n'
        if marker not in text:
            raise SystemExit('service-worker: Nova Vault cache anchor missing')
        text = text.replace(
            marker,
            marker
            + '  "./js/nexusnova-nova-vault-10x-v1.js",\n'
            + '  "./js/nexusnova-hub-ad-gate-v1.js",\n',
            1,
        )

    path.write_text(text, encoding='utf-8')


def verify() -> None:
    print('INSTALL step: verify source wiring')
    required = {
        ROOT / 'functions/index.js': [
            'require("./novaVault10x")',
            'require("./admobRewardedSsvV2")',
        ],
        ROOT / 'js/nexusnova-page2-after-core-v2.js': [
            'nexusnova-nova-vault-v1.js?v=2',
            'nexusnova-nova-vault-10x-v1.js?v=1',
            'nexusnova-hub-ad-gate-v1.js?v=1',
        ],
        ROOT / 'sw.js': [
            'nexusnova-shell-v25-vault10x-ads',
            'nexusnova-nova-vault-10x-v1.js',
            'nexusnova-hub-ad-gate-v1.js',
        ],
        ROOT / 'NexusNovaAndroid/patch_nova_vault_10x_ads.py': [
            'REWARD_PURPOSE_VAULT_10X',
            'nova-vault-10x',
        ],
    }
    for path, markers in required.items():
        if not path.exists():
            raise SystemExit(f'{path}: required file missing')
        text = path.read_text(encoding='utf-8')
        missing = [marker for marker in markers if marker not in text]
        if missing:
            raise SystemExit(f'{path}: missing after install: {missing}')


patch_functions_index()
patch_after_core_loader()
patch_service_worker()
verify()
print('Installed Nova Vault 10x secure flow + policy-capped Nova Hub ad gate without touching sign-in UI or core mining logic.')
