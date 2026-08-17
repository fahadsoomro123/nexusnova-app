from pathlib import Path

MAIN = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
BROWSER = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/BrowserActivity.kt')


def ensure_import(text: str, import_line: str, anchor: str) -> str:
    if import_line in text:
        return text
    if anchor not in text:
        raise SystemExit(f'Import anchor missing for {import_line}: expected {anchor.strip()}')
    return text.replace(anchor, anchor + import_line + '\n', 1)


main = MAIN.read_text(encoding='utf-8')
main = ensure_import(
    main,
    'import androidx.activity.OnBackPressedCallback',
    'import androidx.activity.result.contract.ActivityResultContracts\n',
)

old_main_back = '''    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (!this::webView.isInitialized) {
            showNexusExitDialog()
            return
        }

        webView.evaluateJavascript(NEXUS_SYSTEM_BACK_SCRIPT) { raw ->
            if (isFinishing || isDestroyed) return@evaluateJavascript
            when (raw?.trim()?.trim('"')) {
                "handled" -> Unit
                "missing" -> {
                    if (webView.canGoBack()) webView.goBack() else showNexusExitDialog()
                }
                else -> showNexusExitDialog()
            }
        }
    }
'''
new_main_back = '''    private fun handleNexusBackPressed() {
        if (!this::webView.isInitialized) {
            showNexusExitDialog()
            return
        }

        webView.evaluateJavascript(NEXUS_SYSTEM_BACK_SCRIPT) { raw ->
            if (isFinishing || isDestroyed) return@evaluateJavascript
            when (raw?.trim()?.trim('"')) {
                "handled" -> Unit
                "missing" -> {
                    if (webView.canGoBack()) webView.goBack() else showNexusExitDialog()
                }
                else -> showNexusExitDialog()
            }
        }
    }
'''
if new_main_back not in main:
    if old_main_back not in main:
        raise SystemExit('MainActivity legacy NexusNova Back override not found')
    main = main.replace(old_main_back, new_main_back, 1)

main_callback = '''        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleNexusBackPressed()
            }
        })

'''
main_anchor = '        setContentView(webView)\n\n'
if main_callback not in main:
    if main_anchor not in main:
        raise SystemExit('MainActivity dispatcher insertion point not found')
    main = main.replace(main_anchor, main_anchor + main_callback, 1)

if 'override fun onBackPressed()' in main:
    raise SystemExit('MainActivity still contains deprecated onBackPressed override')
if 'onBackPressedDispatcher.addCallback' not in main or 'handleNexusBackPressed()' not in main:
    raise SystemExit('MainActivity modern Back dispatcher verification failed')
MAIN.write_text(main, encoding='utf-8')


browser = BROWSER.read_text(encoding='utf-8')
browser = ensure_import(
    browser,
    'import androidx.activity.OnBackPressedCallback',
    'import androidx.appcompat.app.AppCompatActivity\n',
)

old_browser_back = '''    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

'''
if old_browser_back in browser:
    browser = browser.replace(old_browser_back, '', 1)
elif 'override fun onBackPressed()' in browser:
    raise SystemExit('BrowserActivity has an unexpected onBackPressed implementation')

browser_callback = '''        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (this@BrowserActivity::webView.isInitialized && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

'''
browser_anchor = '        setContentView(root)\n'
if browser_callback not in browser:
    if browser_anchor not in browser:
        raise SystemExit('BrowserActivity dispatcher insertion point not found')
    browser = browser.replace(browser_anchor, browser_anchor + browser_callback, 1)

if 'override fun onBackPressed()' in browser:
    raise SystemExit('BrowserActivity still contains deprecated onBackPressed override')
if 'onBackPressedDispatcher.addCallback' not in browser or 'finish()' not in browser_callback:
    raise SystemExit('BrowserActivity modern Back dispatcher verification failed')
BROWSER.write_text(browser, encoding='utf-8')

print('Migrated MainActivity and BrowserActivity to Android OnBackPressedDispatcher without changing NexusNova Back/Exit UX.')
