package com.nexusnova.app

import android.app.Activity
import android.content.Context
import android.webkit.WebView
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Native AdMob owner for NexusNova's WebView shell.
 *
 * Policy/safety contract:
 * - Development builds use Google's demo ad units, never the publisher's live units.
 * - Rewarded ads are opt-in and only grant a non-transferable in-app Nexus Pass.
 * - Advertiser clicks / installs are never required for the reward.
 * - Interstitials have a native cooldown and are only shown when the web app
 *   explicitly requests a natural transition placement.
 */
class NexusAdManager(
    private val activity: Activity,
    private val webView: WebView,
    private val isTrustedPage: (WebView?) -> Boolean
) {
    private val preferences = activity.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    private var initialized = false
    private var rewardedLoading = false
    private var interstitialLoading = false
    private var rewardedAd: RewardedAd? = null
    private var interstitialAd: InterstitialAd? = null
    private var lastInterstitialShownAt = 0L

    fun initialize() {
        if (initialized) return
        initialized = true

        CoroutineScope(Dispatchers.IO).launch {
            MobileAds.initialize(activity) {
                activity.runOnUiThread {
                    loadRewarded()
                    loadInterstitial()
                    publishStatus()
                }
            }
        }
    }

    fun publishStatus() {
        activity.runOnUiThread {
            if (rewardedAd == null && !rewardedLoading) loadRewarded()
            if (interstitialAd == null && !interstitialLoading) loadInterstitial()
            dispatch(
                "status",
                mapOf(
                    "rewardedReady" to (rewardedAd != null),
                    "interstitialReady" to (interstitialAd != null),
                    "passExpiresAt" to currentPassExpiry()
                )
            )
        }
    }

    fun showRewarded() {
        activity.runOnUiThread {
            val ad = rewardedAd
            if (ad == null) {
                dispatch("rewarded-unavailable", mapOf("reason" to "loading-or-no-fill"))
                loadRewarded()
                return@runOnUiThread
            }

            rewardedAd = null
            dispatch("rewarded-showing")
            ad.show(activity) { rewardItem ->
                val expiresAt = activatePass()
                dispatch(
                    "rewarded-earned",
                    mapOf(
                        "passExpiresAt" to expiresAt,
                        "passMinutes" to PASS_MINUTES,
                        "rewardType" to rewardItem.type,
                        "rewardAmount" to rewardItem.amount
                    )
                )
            }
        }
    }

    fun showInterstitial() {
        activity.runOnUiThread {
            val now = System.currentTimeMillis()
            if (now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {
                dispatch("interstitial-skipped", mapOf("reason" to "cooldown"))
                return@runOnUiThread
            }

            val ad = interstitialAd
            if (ad == null) {
                dispatch("interstitial-unavailable", mapOf("reason" to "loading-or-no-fill"))
                loadInterstitial()
                return@runOnUiThread
            }

            interstitialAd = null
            lastInterstitialShownAt = now
            dispatch("interstitial-showing")
            ad.show(activity)
        }
    }

    private fun loadRewarded() {
        if (rewardedLoading || rewardedAd != null || activity.isFinishing || activity.isDestroyed) return
        rewardedLoading = true
        RewardedAd.load(
            activity,
            rewardedUnitId(),
            AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) {
                    rewardedLoading = false
                    rewardedAd = ad
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdShowedFullScreenContent() {
                            dispatch("rewarded-opened")
                        }

                        override fun onAdDismissedFullScreenContent() {
                            rewardedAd = null
                            dispatch("rewarded-dismissed")
                            loadRewarded()
                            publishStatus()
                        }

                        override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                            rewardedAd = null
                            dispatch(
                                "rewarded-failed",
                                mapOf("message" to safeMessage(adError.message))
                            )
                            loadRewarded()
                            publishStatus()
                        }
                    }
                    dispatch("rewarded-ready")
                    publishStatus()
                }

                override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                    rewardedLoading = false
                    rewardedAd = null
                    dispatch(
                        "rewarded-load-failed",
                        mapOf("message" to safeMessage(loadAdError.message))
                    )
                    publishStatusWithoutReload()
                }
            }
        )
    }

    private fun loadInterstitial() {
        if (interstitialLoading || interstitialAd != null || activity.isFinishing || activity.isDestroyed) return
        interstitialLoading = true
        InterstitialAd.load(
            activity,
            interstitialUnitId(),
            AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialLoading = false
                    interstitialAd = ad
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdShowedFullScreenContent() {
                            dispatch("interstitial-opened")
                        }

                        override fun onAdDismissedFullScreenContent() {
                            interstitialAd = null
                            dispatch("interstitial-dismissed")
                            loadInterstitial()
                            publishStatus()
                        }

                        override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                            interstitialAd = null
                            dispatch(
                                "interstitial-failed",
                                mapOf("message" to safeMessage(adError.message))
                            )
                            loadInterstitial()
                            publishStatus()
                        }
                    }
                    dispatch("interstitial-ready")
                    publishStatusWithoutReload()
                }

                override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                    interstitialLoading = false
                    interstitialAd = null
                    dispatch(
                        "interstitial-load-failed",
                        mapOf("message" to safeMessage(loadAdError.message))
                    )
                    publishStatusWithoutReload()
                }
            }
        )
    }

    private fun activatePass(): Long {
        val now = System.currentTimeMillis()
        val current = currentPassExpiry()
        val expiresAt = maxOf(now, current) + PASS_DURATION_MS
        preferences.edit().putLong(KEY_PASS_EXPIRES_AT, expiresAt).apply()
        return expiresAt
    }

    private fun currentPassExpiry(): Long {
        val expiresAt = preferences.getLong(KEY_PASS_EXPIRES_AT, 0L)
        if (expiresAt <= System.currentTimeMillis()) {
            if (expiresAt != 0L) preferences.edit().remove(KEY_PASS_EXPIRES_AT).apply()
            return 0L
        }
        return expiresAt
    }

    private fun publishStatusWithoutReload() {
        dispatch(
            "status",
            mapOf(
                "rewardedReady" to (rewardedAd != null),
                "interstitialReady" to (interstitialAd != null),
                "passExpiresAt" to currentPassExpiry()
            )
        )
    }

    private fun dispatch(event: String, extras: Map<String, Any?> = emptyMap()) {
        val detail = JSONObject()
            .put("event", event)
            .put("provider", "admob")
            .put("testMode", TEST_MODE)

        extras.forEach { (key, value) ->
            when (value) {
                null -> detail.put(key, JSONObject.NULL)
                is Boolean, is Int, is Long, is Double, is Float, is String -> detail.put(key, value)
                else -> detail.put(key, value.toString())
            }
        }

        webView.post {
            if (activity.isFinishing || activity.isDestroyed || !isTrustedPage(webView)) return@post
            val script = """
                (function(){
                  try {
                    window.dispatchEvent(new CustomEvent('nexusnova:native-ad-event', {detail:${detail}}));
                  } catch (e) {}
                })();
            """.trimIndent()
            webView.evaluateJavascript(script, null)
        }
    }

    private fun rewardedUnitId(): String =
        if (TEST_MODE) TEST_REWARDED_AD_UNIT_ID else PRODUCTION_REWARDED_AD_UNIT_ID

    private fun interstitialUnitId(): String =
        if (TEST_MODE) TEST_INTERSTITIAL_AD_UNIT_ID else PRODUCTION_INTERSTITIAL_AD_UNIT_ID

    private fun safeMessage(message: String?): String =
        (message ?: "Ad unavailable").take(MAX_ERROR_CHARS)

    private companion object {
        const val TEST_MODE = true

        const val TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917"
        const val TEST_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/1033173712"

        const val PRODUCTION_REWARDED_AD_UNIT_ID = "ca-app-pub-5070673529890078/7194148596"
        const val PRODUCTION_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-5070673529890078/7807608294"

        const val PASS_MINUTES = 20L
        const val PASS_DURATION_MS = PASS_MINUTES * 60L * 1000L
        const val INTERSTITIAL_COOLDOWN_MS = 3L * 60L * 1000L
        const val MAX_ERROR_CHARS = 180

        const val PREFERENCES = "nexusnova_admob"
        const val KEY_PASS_EXPIRES_AT = "nexus_pass_expires_at"
    }
}
