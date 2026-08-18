from pathlib import Path

ROOT = Path('.')


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'{label}: patch anchor missing in {path}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def patch_functions_index() -> None:
    path = ROOT / 'functions/index.js'
    old = 'Object.assign(exports, require("./admobRewardedSsv"));\n'
    new = (
        'Object.assign(exports, require("./admobRewardedSsv"));\n'
        'Object.assign(exports, require("./novaVault10x"));\n'
        '// v2 intentionally loads last so the deployed admobRewardedSsv export\n'
        '// routes both Watch Ad and Nova Vault 10x through one signed endpoint.\n'
        'Object.assign(exports, require("./admobRewardedSsvV2"));\n'
    )
    replace_once(path, old, new, 'functions export wiring')


def patch_after_core_loader() -> None:
    path = ROOT / 'js/nexusnova-page2-after-core-v2.js'
    text = path.read_text(encoding='utf-8')
    marker = """    try {\n      await import('./nexusnova-nova-hub-nav-v1.js?v=1');\n    } catch (error) {\n      console.warn('NexusNova Nova Hub navigation readiness:', error);\n    }\n\n"""
    addition = marker + """    // Nova Vault remains optional/post-core so rewards can never hold the\n    // Android dashboard behind startup. The 10x layer is additive and keeps\n    // TEST rewarded ads value-free.\n    try {\n      await import('./nexusnova-nova-vault-v1.js?v=2');\n      await import('./nexusnova-nova-vault-10x-v1.js?v=1');\n    } catch (error) {\n      console.warn('NexusNova Nova Vault 10x:', error);\n    }\n\n    // Frequency-capped interstitial wrapper only. It does not redesign Nova Hub\n    // and protected destinations bypass it completely.\n    try {\n      await import('./nexusnova-hub-ad-gate-v1.js?v=1');\n    } catch (error) {\n      console.warn('NexusNova Nova Hub ad gate:', error);\n    }\n\n"""
    if 'nexusnova-nova-vault-10x-v1.js?v=1' not in text:
        if marker not in text:
            raise SystemExit('after-core Nova Hub anchor missing')
        text = text.replace(marker, addition, 1)
    path.write_text(text, encoding='utf-8')


def patch_native_ad_bridge() -> None:
    path = ROOT / 'NexusNovaAndroid/patch_admob.py'
    text = path.read_text(encoding='utf-8')

    if 'REWARD_PURPOSE_VAULT_10X -> REWARD_PURPOSE_VAULT_10X' not in text:
        anchor = """if 'REWARD_PURPOSE_WATCH_AD -> REWARD_PURPOSE_WATCH_AD' not in manager:\n    marker = '''            REWARD_PURPOSE_DAILY_TEST -> REWARD_PURPOSE_DAILY_TEST\\n            REWARD_PURPOSE_MINING -> REWARD_PURPOSE_MINING\\n'''\n    addition = '''            REWARD_PURPOSE_DAILY_TEST -> REWARD_PURPOSE_DAILY_TEST\\n            REWARD_PURPOSE_WATCH_AD -> REWARD_PURPOSE_WATCH_AD\\n            REWARD_PURPOSE_MINING -> REWARD_PURPOSE_MINING\\n'''\n    if marker not in manager:\n        raise SystemExit('Reward-purpose insertion point not found')\n    manager = manager.replace(marker, addition, 1)\n\n"""
        if anchor not in text:
            raise SystemExit('native reward-purpose watch-ad patch anchor missing')
        addition = anchor + """if 'REWARD_PURPOSE_VAULT_10X -> REWARD_PURPOSE_VAULT_10X' not in manager:\n    marker = '''            REWARD_PURPOSE_WATCH_AD -> REWARD_PURPOSE_WATCH_AD\\n            REWARD_PURPOSE_MINING -> REWARD_PURPOSE_MINING\\n'''\n    addition = '''            REWARD_PURPOSE_WATCH_AD -> REWARD_PURPOSE_WATCH_AD\\n            REWARD_PURPOSE_VAULT_10X -> REWARD_PURPOSE_VAULT_10X\\n            REWARD_PURPOSE_MINING -> REWARD_PURPOSE_MINING\\n'''\n    if marker not in manager:\n        raise SystemExit('Nova Vault 10x reward-purpose insertion point not found')\n    manager = manager.replace(marker, addition, 1)\n\n"""
        text = text.replace(anchor, addition, 1)

    if 'const val REWARD_PURPOSE_VAULT_10X = "nova-vault-10x"' not in text:
        anchor = """if 'const val REWARD_PURPOSE_WATCH_AD = \"task-watch-ad\"' not in manager:\n    marker = '        const val REWARD_PURPOSE_DAILY_TEST = \"daily-reward-test\"\\n'\n    addition = marker + '        const val REWARD_PURPOSE_WATCH_AD = \"task-watch-ad\"\\n'\n    if marker not in manager:\n        raise SystemExit('Watch-ad constant insertion point not found')\n    manager = manager.replace(marker, addition, 1)\n\n"""
        if anchor not in text:
            raise SystemExit('native watch-ad constant patch anchor missing')
        addition = anchor + """if 'const val REWARD_PURPOSE_VAULT_10X = \"nova-vault-10x\"' not in manager:\n    marker = '        const val REWARD_PURPOSE_WATCH_AD = \"task-watch-ad\"\\n'\n    addition = marker + '        const val REWARD_PURPOSE_VAULT_10X = \"nova-vault-10x\"\\n'\n    if marker not in manager:\n        raise SystemExit('Nova Vault 10x constant insertion point not found')\n    manager = manager.replace(marker, addition, 1)\n\n"""
        text = text.replace(anchor, addition, 1)

    if "    'nova-vault-10x',\n" not in text:
        marker = "    'task-watch-ad',\n"
        if marker not in text:
            raise SystemExit('native required-markers task-watch-ad anchor missing')
        text = text.replace(marker, marker + "    'nova-vault-10x',\n", 1)

    path.write_text(text, encoding='utf-8')


def patch_service_worker() -> None:
    path = ROOT / 'sw.js'
    text = path.read_text(encoding='utf-8')
    text = text.replace(
        'const CACHE = "nexusnova-shell-v24-auth-startup-recovery";',
        'const CACHE = "nexusnova-shell-v25-vault10x-ads";',
        1,
    )
    if '"./js/nexusnova-nova-vault-10x-v1.js"' not in text:
        marker = '  "./js/nexusnova-nova-vault-v1.js",\n'
        if marker not in text:
            raise SystemExit('service-worker Nova Vault cache anchor missing')
        text = text.replace(
            marker,
            marker + '  "./js/nexusnova-nova-vault-10x-v1.js",\n  "./js/nexusnova-hub-ad-gate-v1.js",\n',
            1,
        )
    path.write_text(text, encoding='utf-8')


def verify() -> None:
    required = {
        ROOT / 'functions/index.js': [
            'require("./novaVault10x")',
            'require("./admobRewardedSsvV2")',
        ],
        ROOT / 'js/nexusnova-page2-after-core-v2.js': [
            'nexusnova-nova-vault-10x-v1.js?v=1',
            'nexusnova-hub-ad-gate-v1.js?v=1',
        ],
        ROOT / 'NexusNovaAndroid/patch_admob.py': [
            'REWARD_PURPOSE_VAULT_10X',
            'nova-vault-10x',
        ],
        ROOT / 'sw.js': [
            'nexusnova-shell-v25-vault10x-ads',
            'nexusnova-nova-vault-10x-v1.js',
            'nexusnova-hub-ad-gate-v1.js',
        ],
    }
    for path, markers in required.items():
        text = path.read_text(encoding='utf-8')
        missing = [marker for marker in markers if marker not in text]
        if missing:
            raise SystemExit(f'{path}: missing after install: {missing}')


patch_functions_index()
patch_after_core_loader()
patch_native_ad_bridge()
patch_service_worker()
verify()
print('Installed Nova Vault 10x secure flow + policy-capped Nova Hub ad gate without touching sign-in UI or core mining logic.')
