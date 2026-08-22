from pathlib import Path

path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
text = path.read_text(encoding='utf-8')

old_actions = '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_OPEN_NOVA_VPN -> {\n                val authToken = message.optString("authToken").trim()\n                if (authToken.isBlank() || authToken.length > MAX_VPN_AUTH_TOKEN_CHARS) return\n                try {\n                    startActivity(\n                        Intent(this, NovaVpnActivity::class.java)\n                            .putExtra(NovaVpnActivity.EXTRA_AUTH_TOKEN, authToken)\n                    )\n                } catch (_: Exception) {\n                    // Keep the main app alive if the optional VPN control cannot launch.\n                }\n            }\n\n            ACTION_OPEN_EXTERNAL -> {'''
new_actions = '''            ACTION_OPEN_NOVA_VPN -> {\n                val authToken = message.optString("authToken").trim()\n                if (authToken.isBlank() || authToken.length > MAX_VPN_AUTH_TOKEN_CHARS) return\n                try {\n                    startActivity(\n                        Intent(this, NovaVpnActivity::class.java)\n                            .putExtra(NovaVpnActivity.EXTRA_AUTH_TOKEN, authToken)\n                    )\n                } catch (_: Exception) {\n                    // Keep the main app alive if the optional VPN control cannot launch.\n                }\n            }\n\n            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_OPEN_EXTERNAL -> {'''
if old_actions in text:
    text = text.replace(old_actions, new_actions, 1)
elif new_actions not in text:
    raise SystemExit('Nova VPN action ordering marker not found')

old_constants = '''        const val ACTION_REQUEST_CALLER_ROLE = "requestCallerRole"\n        const val ACTION_OPEN_NOVA_VPN = "openNovaVpn"\n        const val ACTION_OPEN_EXTERNAL = "openExternal"'''
new_constants = '''        const val ACTION_OPEN_NOVA_VPN = "openNovaVpn"\n        const val ACTION_REQUEST_CALLER_ROLE = "requestCallerRole"\n        const val ACTION_OPEN_EXTERNAL = "openExternal"'''
if old_constants in text:
    text = text.replace(old_constants, new_constants, 1)
elif new_constants not in text:
    raise SystemExit('Nova VPN constant ordering marker not found')

path.write_text(text, encoding='utf-8')
print('Nova VPN bridge reordered for existing AdMob patch contract.')
