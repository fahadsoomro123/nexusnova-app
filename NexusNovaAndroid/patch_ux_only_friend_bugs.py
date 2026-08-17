from pathlib import Path

main_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
speed_css_path = Path('NexusNovaAndroid/app/src/main/assets/www/css/nexusnova-speedtest-app-v4.css')
main = main_path.read_text(encoding='utf-8')

# White-flash prevention: keep the WebView surface on NexusNova dark while
# login -> dashboard navigation or IME/viewport resizing swaps documents.
old_webview = '        webView = WebView(this)\n        setContentView(webView)\n'
new_webview = '        webView = WebView(this)\n        webView.setBackgroundColor(android.graphics.Color.rgb(0, 18, 25))\n        webView.overScrollMode = android.view.View.OVER_SCROLL_NEVER\n        setContentView(webView)\n'
if new_webview not in main:
    if old_webview not in main:
        raise SystemExit('WebView dark-surface insertion point not found')
    main = main.replace(old_webview, new_webview, 1)

# Replace the old root Back behavior inserted by patch_session_restore.py with
# contextual web navigation plus a premium native exit card. The logo scene
# intentionally mirrors the real startup splash: floating blue 3D N, pulsing
# halo, counter-rotating orbital rings and the NEXUSNOVA OS branding language.
old_back = '''    @Deprecated("Deprecated in Java")\n    override fun onBackPressed() {\n        if (this::webView.isInitialized && webView.canGoBack()) {\n            webView.goBack()\n        } else {\n            moveTaskToBack(true)\n        }\n    }\n'''
new_back = '''    @Deprecated("Deprecated in Java")\n    override fun onBackPressed() {\n        if (!this::webView.isInitialized) {\n            showNexusExitDialog()\n            return\n        }\n\n        webView.evaluateJavascript(NEXUS_SYSTEM_BACK_SCRIPT) { raw ->\n            if (isFinishing || isDestroyed) return@evaluateJavascript\n            when (raw?.trim()?.trim('"')) {\n                "handled" -> Unit\n                "missing" -> {\n                    if (webView.canGoBack()) webView.goBack() else showNexusExitDialog()\n                }\n                else -> showNexusExitDialog()\n            }\n        }\n    }\n\n    private fun showNexusExitDialog() {\n        if (isFinishing || isDestroyed) return\n\n        val density = resources.displayMetrics.density\n        fun dp(value: Int): Int = (value * density + 0.5f).toInt()\n        fun roundedGradient(colors: IntArray, radius: Float, strokeColor: Int? = null, strokeWidth: Int = 0): android.graphics.drawable.GradientDrawable {\n            return android.graphics.drawable.GradientDrawable(\n                android.graphics.drawable.GradientDrawable.Orientation.TL_BR,\n                colors\n            ).apply {\n                cornerRadius = radius\n                if (strokeColor != null && strokeWidth > 0) setStroke(strokeWidth, strokeColor)\n            }\n        }\n        fun circleDrawable(fill: Int, stroke: Int? = null, strokeWidth: Int = 0): android.graphics.drawable.GradientDrawable {\n            return android.graphics.drawable.GradientDrawable().apply {\n                shape = android.graphics.drawable.GradientDrawable.OVAL\n                setColor(fill)\n                if (stroke != null && strokeWidth > 0) setStroke(strokeWidth, stroke)\n            }\n        }\n        fun orbit(size: Int, strokeColor: Int, dotColor: Int): android.widget.FrameLayout {\n            return android.widget.FrameLayout(this).apply {\n                clipChildren = false\n                clipToPadding = false\n                background = circleDrawable(android.graphics.Color.TRANSPARENT, strokeColor, dp(1))\n                val dot = android.view.View(this@MainActivity).apply {\n                    background = circleDrawable(dotColor)\n                    if (android.os.Build.VERSION.SDK_INT >= 21) elevation = dp(4).toFloat()\n                }\n                addView(dot, android.widget.FrameLayout.LayoutParams(dp(7), dp(7), android.view.Gravity.TOP or android.view.Gravity.CENTER_HORIZONTAL).apply {\n                    topMargin = -dp(2)\n                })\n            }\n        }\n        fun startOrbit(view: android.view.View, endRotation: Float, durationMs: Long) {\n            android.animation.ObjectAnimator.ofFloat(view, android.view.View.ROTATION, 0f, endRotation).apply {\n                duration = durationMs\n                repeatCount = android.animation.ValueAnimator.INFINITE\n                interpolator = android.view.animation.LinearInterpolator()\n                start()\n            }\n        }\n        fun startPulse(view: android.view.View) {\n            val sx = android.animation.ObjectAnimator.ofFloat(view, android.view.View.SCALE_X, 0.92f, 1.14f)\n            val sy = android.animation.ObjectAnimator.ofFloat(view, android.view.View.SCALE_Y, 0.92f, 1.14f)\n            val alpha = android.animation.ObjectAnimator.ofFloat(view, android.view.View.ALPHA, 0.30f, 0.72f)\n            listOf(sx, sy, alpha).forEach { animator ->\n                animator.duration = 1000L\n                animator.repeatCount = android.animation.ValueAnimator.INFINITE\n                animator.repeatMode = android.animation.ValueAnimator.REVERSE\n                animator.interpolator = android.view.animation.AccelerateDecelerateInterpolator()\n                animator.start()\n            }\n        }\n\n        val dialog = android.app.Dialog(this)\n        dialog.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE)\n        dialog.setCancelable(true)\n        dialog.setCanceledOnTouchOutside(true)\n\n        val card = android.widget.LinearLayout(this).apply {\n            orientation = android.widget.LinearLayout.VERTICAL\n            gravity = android.view.Gravity.CENTER_HORIZONTAL\n            setPadding(dp(22), dp(16), dp(22), dp(20))\n            background = roundedGradient(\n                intArrayOf(\n                    android.graphics.Color.parseColor("#00040A"),\n                    android.graphics.Color.parseColor("#071626"),\n                    android.graphics.Color.parseColor("#07101F")\n                ),\n                dp(28).toFloat(),\n                android.graphics.Color.parseColor("#2B78C9"),\n                dp(1)\n            )\n            if (android.os.Build.VERSION.SDK_INT >= 21) elevation = dp(20).toFloat()\n        }\n\n        val logoStage = android.widget.FrameLayout(this).apply {\n            clipChildren = false\n            clipToPadding = false\n        }\n        val orbitA = orbit(dp(118), android.graphics.Color.parseColor("#344CA1FF"), android.graphics.Color.parseColor("#58B5FF"))\n        val orbitB = orbit(dp(88), android.graphics.Color.parseColor("#2E58B5FF"), android.graphics.Color.parseColor("#8AD4FF"))\n        logoStage.addView(orbitA, android.widget.FrameLayout.LayoutParams(dp(118), dp(118), android.view.Gravity.CENTER))\n        logoStage.addView(orbitB, android.widget.FrameLayout.LayoutParams(dp(88), dp(88), android.view.Gravity.CENTER))\n\n        val halo = android.view.View(this).apply {\n            background = circleDrawable(android.graphics.Color.parseColor("#263FAEFF"))\n            alpha = 0.45f\n        }\n        logoStage.addView(halo, android.widget.FrameLayout.LayoutParams(dp(94), dp(94), android.view.Gravity.CENTER))\n\n        val logo = android.widget.TextView(this).apply {\n            text = "N"\n            gravity = android.view.Gravity.CENTER\n            setTextColor(android.graphics.Color.WHITE)\n            textSize = 31f\n            typeface = android.graphics.Typeface.DEFAULT_BOLD\n            background = roundedGradient(\n                intArrayOf(\n                    android.graphics.Color.parseColor("#8AD4FF"),\n                    android.graphics.Color.parseColor("#2793FF"),\n                    android.graphics.Color.parseColor("#0C5DEA"),\n                    android.graphics.Color.parseColor("#073091")\n                ),\n                dp(22).toFloat(),\n                android.graphics.Color.parseColor("#D0EEFF"),\n                dp(1)\n            )\n            if (android.os.Build.VERSION.SDK_INT >= 21) elevation = dp(10).toFloat()\n        }\n        logoStage.addView(logo, android.widget.FrameLayout.LayoutParams(dp(72), dp(72), android.view.Gravity.CENTER))\n\n        card.addView(logoStage, android.widget.LinearLayout.LayoutParams(dp(132), dp(132)).apply {\n            gravity = android.view.Gravity.CENTER_HORIZONTAL\n            bottomMargin = dp(2)\n        })\n\n        val eyebrow = android.widget.TextView(this).apply {\n            text = "NEXUSNOVA OS"\n            gravity = android.view.Gravity.CENTER\n            setTextColor(android.graphics.Color.parseColor("#63B9FF"))\n            textSize = 10f\n            typeface = android.graphics.Typeface.DEFAULT_BOLD\n            letterSpacing = 0.16f\n        }\n        card.addView(eyebrow, android.widget.LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(5) })\n\n        val title = android.widget.TextView(this).apply {\n            text = "Exit NexusNova?"\n            gravity = android.view.Gravity.CENTER\n            setTextColor(android.graphics.Color.WHITE)\n            textSize = 22f\n            typeface = android.graphics.Typeface.DEFAULT_BOLD\n        }\n        card.addView(title, android.widget.LinearLayout.LayoutParams(-1, -2))\n\n        val message = android.widget.TextView(this).apply {\n            text = "Do you want to exit NexusNova? Your session will remain secure."\n            gravity = android.view.Gravity.CENTER\n            setTextColor(android.graphics.Color.parseColor("#B9D4F5"))\n            textSize = 13f\n            setLineSpacing(0f, 1.18f)\n        }\n        card.addView(message, android.widget.LinearLayout.LayoutParams(-1, -2).apply {\n            topMargin = dp(8)\n            bottomMargin = dp(8)\n        })\n\n        val secureLine = android.widget.TextView(this).apply {\n            text = "SUPER APP • SECURE • CONNECTED"\n            gravity = android.view.Gravity.CENTER\n            setTextColor(android.graphics.Color.parseColor("#729BC8"))\n            textSize = 9f\n            typeface = android.graphics.Typeface.DEFAULT_BOLD\n            letterSpacing = 0.10f\n        }\n        card.addView(secureLine, android.widget.LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(17) })\n\n        val stay = android.widget.TextView(this).apply {\n            text = "STAY IN NEXUSNOVA"\n            gravity = android.view.Gravity.CENTER\n            setTextColor(android.graphics.Color.WHITE)\n            textSize = 12f\n            typeface = android.graphics.Typeface.DEFAULT_BOLD\n            isClickable = true\n            isFocusable = true\n            background = roundedGradient(\n                intArrayOf(\n                    android.graphics.Color.parseColor("#2793FF"),\n                    android.graphics.Color.parseColor("#0C5DEA"),\n                    android.graphics.Color.parseColor("#073091")\n                ),\n                dp(15).toFloat(),\n                android.graphics.Color.parseColor("#8AD4FF"),\n                dp(1)\n            )\n            setOnClickListener { dialog.dismiss() }\n        }\n        card.addView(stay, android.widget.LinearLayout.LayoutParams(-1, dp(52)).apply { bottomMargin = dp(9) })\n\n        val exit = android.widget.TextView(this).apply {\n            text = "EXIT APP"\n            gravity = android.view.Gravity.CENTER\n            setTextColor(android.graphics.Color.parseColor("#FF9AA4"))\n            textSize = 12f\n            typeface = android.graphics.Typeface.DEFAULT_BOLD\n            isClickable = true\n            isFocusable = true\n            background = roundedGradient(\n                intArrayOf(\n                    android.graphics.Color.parseColor("#151B27"),\n                    android.graphics.Color.parseColor("#121724")\n                ),\n                dp(15).toFloat(),\n                android.graphics.Color.parseColor("#8A3B4B"),\n                dp(1)\n            )\n            setOnClickListener {\n                dialog.dismiss()\n                finishAndRemoveTask()\n            }\n        }\n        card.addView(exit, android.widget.LinearLayout.LayoutParams(-1, dp(48)))\n\n        dialog.setContentView(card)\n        dialog.setOnShowListener {\n            dialog.window?.apply {\n                setBackgroundDrawable(android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT))\n                addFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND)\n                attributes = attributes.apply { dimAmount = 0.78f }\n                val maxWidth = dp(430)\n                val available = resources.displayMetrics.widthPixels - dp(36)\n                setLayout(kotlin.math.min(maxWidth, available), android.view.ViewGroup.LayoutParams.WRAP_CONTENT)\n                setGravity(android.view.Gravity.CENTER)\n            }\n\n            startOrbit(orbitA, 360f, 10000L)\n            startOrbit(orbitB, -360f, 8000L)\n            startPulse(halo)\n            android.animation.ObjectAnimator.ofFloat(logo, android.view.View.TRANSLATION_Y, 0f, -dp(8).toFloat()).apply {\n                duration = 1400L\n                repeatCount = android.animation.ValueAnimator.INFINITE\n                repeatMode = android.animation.ValueAnimator.REVERSE\n                interpolator = android.view.animation.AccelerateDecelerateInterpolator()\n                start()\n            }\n        }\n        dialog.show()\n    }\n'''
if new_back not in main:
    if old_back not in main:
        raise SystemExit('Old Android Back block not found for isolated UX patch')
    main = main.replace(old_back, new_back, 1)

if 'const val NEXUS_SYSTEM_BACK_SCRIPT' not in main:
    marker = '        const val BLANK_SCREEN_PROBE = """\n'
    script = '''        const val NEXUS_SYSTEM_BACK_SCRIPT = """\n            (function(){\n              try {\n                var ux = window.NexusNovaUxSimplify;\n                if (!ux || typeof ux.systemBack !== 'function') return 'missing';\n                return ux.systemBack() ? 'handled' : 'root';\n              } catch (_) {\n                return 'missing';\n              }\n            })();\n        """\n'''
    if marker not in main:
        raise SystemExit('System Back script insertion point not found')
    main = main.replace(marker, script + marker, 1)

main_path.write_text(main, encoding='utf-8')

# Premium Speed Test launcher identity. This is visual-only: the measurement
# code, Cloudflare requests, result calculations and ALL APPS routing stay
# unchanged. The small N badge ties the utility to NexusNova branding without
# using any generated/external image asset.
if not speed_css_path.exists():
    raise SystemExit('Speed Test CSS missing from prepared Android web shell')
speed_css = speed_css_path.read_text(encoding='utf-8')
premium_speed_marker = '/* nx-speed4-premium-launcher-v5 */'
if premium_speed_marker not in speed_css:
    speed_css += r'''

/* nx-speed4-premium-launcher-v5 */
#moreMenu .more-item[data-nx-speedtest-v4="1"]{
  --mi-a:#1ee9ff;
  --mi-b:#075bed;
  --mi-edge:#79ecff;
  --mi-glow:rgba(20,190,255,.30);
  position:relative!important;
  overflow:hidden!important;
  background:
    radial-gradient(110px 65px at 50% -5%,rgba(30,233,255,.19),transparent 70%),
    linear-gradient(180deg,rgba(12,43,78,.96),rgba(3,13,27,.98))!important;
  border-color:rgba(87,210,255,.34)!important;
  box-shadow:0 12px 28px rgba(0,0,0,.42),0 0 24px rgba(7,110,255,.12),inset 0 1px 0 rgba(255,255,255,.08)!important;
}
#moreMenu .more-item[data-nx-speedtest-v4="1"]:before{
  content:""!important;
  position:absolute!important;
  inset:-35% -20% auto!important;
  height:85%!important;
  border-radius:50%!important;
  background:radial-gradient(circle,rgba(93,225,255,.20),transparent 67%)!important;
  opacity:1!important;
  pointer-events:none!important;
}
#moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon{
  position:relative!important;
  width:64px!important;
  height:64px!important;
  border-radius:21px!important;
  overflow:visible!important;
  color:#fff!important;
  background:
    radial-gradient(circle at 31% 22%,rgba(255,255,255,.82) 0 4%,transparent 5%),
    radial-gradient(circle at 50% 65%,rgba(30,233,255,.24),transparent 52%),
    linear-gradient(145deg,#30ecff 0%,#168cff 35%,#075bed 68%,#04215e 100%)!important;
  border:1px solid rgba(192,242,255,.72)!important;
  box-shadow:
    0 12px 24px rgba(3,87,225,.38),
    0 0 26px rgba(30,216,255,.22),
    inset 0 2px 0 rgba(255,255,255,.58),
    inset 0 -12px 20px rgba(0,24,87,.28)!important;
  animation:nxSpeedLauncherGlow 3.2s ease-in-out infinite!important;
}
#moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon:before{
  content:""!important;
  position:absolute!important;
  inset:8px!important;
  height:auto!important;
  border-radius:50%!important;
  background:transparent!important;
  border:1px solid rgba(206,247,255,.48)!important;
  border-left-color:rgba(55,229,255,.96)!important;
  border-bottom-color:rgba(19,123,255,.74)!important;
  opacity:.94!important;
  transform:rotate(-24deg)!important;
  pointer-events:none!important;
}
#moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon:after{
  content:"N"!important;
  position:absolute!important;
  right:-5px!important;
  bottom:-5px!important;
  width:23px!important;
  height:23px!important;
  display:grid!important;
  place-items:center!important;
  border-radius:8px!important;
  background:linear-gradient(145deg,#79eaff,#0b69ef)!important;
  border:2px solid #030b16!important;
  color:#fff!important;
  font-size:12px!important;
  font-weight:1000!important;
  line-height:1!important;
  opacity:1!important;
  box-shadow:0 5px 14px rgba(0,0,0,.42),0 0 12px rgba(48,224,255,.42)!important;
}
#moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon svg{
  position:relative!important;
  z-index:3!important;
  width:34px!important;
  height:34px!important;
  stroke:#fff!important;
  stroke-width:1.85!important;
  filter:drop-shadow(0 3px 5px rgba(0,22,70,.42)) drop-shadow(0 0 6px rgba(121,234,255,.26))!important;
}
#moreMenu .more-item[data-nx-speedtest-v4="1"]>span:last-child{
  color:#f5fcff!important;
  text-shadow:0 1px 10px rgba(0,83,210,.72)!important;
}
.nx-speed4-hero-icon{
  background:
    radial-gradient(circle at 31% 22%,rgba(255,255,255,.75) 0 4%,transparent 5%),
    linear-gradient(145deg,#2ce8ff,#137eff 46%,#07389f)!important;
  border:1px solid rgba(169,235,255,.62)!important;
  box-shadow:0 12px 28px rgba(0,83,210,.28),0 0 22px rgba(34,213,255,.16),inset 0 1px 0 rgba(255,255,255,.48)!important;
}
@keyframes nxSpeedLauncherGlow{
  0%,100%{box-shadow:0 12px 24px rgba(3,87,225,.38),0 0 20px rgba(30,216,255,.16),inset 0 2px 0 rgba(255,255,255,.58),inset 0 -12px 20px rgba(0,24,87,.28)}
  50%{box-shadow:0 14px 28px rgba(3,87,225,.44),0 0 32px rgba(30,216,255,.34),inset 0 2px 0 rgba(255,255,255,.64),inset 0 -12px 20px rgba(0,24,87,.24)}
}
@media (prefers-reduced-motion:reduce){
  #moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon{animation:none!important}
}
'''
    speed_css_path.write_text(speed_css, encoding='utf-8')

required = [
    'webView.setBackgroundColor(android.graphics.Color.rgb(0, 18, 25))',
    'webView.overScrollMode = android.view.View.OVER_SCROLL_NEVER',
    'showNexusExitDialog()',
    'NEXUSNOVA OS',
    'SUPER APP • SECURE • CONNECTED',
    'STAY IN NEXUSNOVA',
    'EXIT APP',
    'startOrbit(orbitA, 360f, 10000L)',
    'startOrbit(orbitB, -360f, 8000L)',
    'startPulse(halo)',
    'NEXUS_SYSTEM_BACK_SCRIPT',
    'window.NexusNovaUxSimplify',
]
missing = [token for token in required if token not in main]
if missing:
    raise SystemExit('UX-only Android verification failed: ' + ', '.join(missing))
if 'moveTaskToBack(true)' in main:
    raise SystemExit('Immediate Android exit/background behavior survived UX-only patch')

speed_css = speed_css_path.read_text(encoding='utf-8')
for token in [premium_speed_marker, 'data-nx-speedtest-v4', 'nxSpeedLauncherGlow', 'content:"N"']:
    if token not in speed_css:
        raise SystemExit('Premium Speed Test launcher verification failed: ' + token)

print('Applied UX-only white-flash prevention, splash-matched animated exit dialog, and premium NexusNova Speed Test launcher icon without touching mining/reward logic.')
