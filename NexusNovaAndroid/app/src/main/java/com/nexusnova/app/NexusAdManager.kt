package com.nexusnova.app

import android.app.Activity
import android.os.Handler
import android.os.Looper
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
 * Reward contract:
 * - Development builds use Google's demo ad units, never the publisher's live units.
 * - Rewarded ads are explicit opt-in and emit a completion signal for one 2-hour
 *   NexusNova mining boost. The web/Firestore layer owns the mining-state change.
 * - Rewarded ads never directly grant NVX and advertiser clicks/installs are never
 *   required for the reward.
 * - Production IDs remain present but TEST_MODE stays enabled until consent,
 *   policy review and server-side ad-proof hardening are complete.
 * - Interstitials retain their native cooldown and are shown only when the web
 *   app explicitly requests a natural transition placement.
 *
 * UX contract:
 * - If the user taps Rewarded Ad before Google has finished loading it, keep that
 *   single request pending, retry short transient load failures, and open the ad
 *   automatically as soon as it is ready.
 * - Never mint a reward just because loading started; only Google's earned callback
 *   can emit rewarded-earned.
 */
class NexusAdManager(
    private val activity: Activity,
    private val webView: WebView,
    private val isTrustedPage: (WebView?) -> Boolean
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    private var initialized = false
    private var rewardedLoading = false
    private var interstitialLoading = false
    private var rewardedAd: RewardedAd? = null
    private var interstitialAd: InterstitialAd? = null
    private var lastInterstitialShownAt = 0L

    private var pendingRewardedShow = false
    private var pendingRewardedStartedAt = 0L
    private var rewardedRetryCount = 0

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
                    "rewardedLoading" to rewardedLoading,
                    "rewardedPending" to pendingRewardedShow,
                    "interstitialReady" to (interstitialAd != null),
                    "rewardPurpose" to REWARD_PURPOSE,
                    "boostHours" to BOOST_HOURS
                )
            )
        }
    }

    fun showRewarded() {
        activity.runOnUiThread {
            val ad = rewardedAd
            if (ad != null) {
                pendingRewardedShow = false
                pendingRewardedStartedAt = 0L
                rewardedRetryCount = 0
                presentRewarded(ad)
                return@runOnUiThread
            }

            if (!pendingRewardedShow) {
                pendingRewardedShow = true
                pendingRewardedStartedAt = System.currentTimeMillis()
                rewardedRetryCount = 0
                dispatch(
                    "rewarded-preparing",
                    mapOf(
                        "reason" to "waiting-for-admob",
                        "timeoutMs" to REWARDED_PENDING_TIMEOUT_MS
                    )
                )
                schedulePendingTimeout()
            } else {
                dispatch("rewarded-preparing", mapOf("reason" to "already-loading"))
            }

            loadRewarded()
        }
    }

    private fun presentRewarded(ad: RewardedAd) {
        if (activity.isFinishing || activity.isDestroyed) {
            pendingRewardedShow = false
            return
        }

        rewardedAd = null
        dispatch("rewarded-showing", mapOf("rewardPurpose" to REWARD_PURPOSE))
        ad.show(activity) { rewardItem ->
            dispatch(
                "rewarded-earned",
                mapOf(
                    "rewardPurpose" to REWARD_PURPOSE,
                    "boostHours" to BOOST_HOURS,
                    "rewardType" to rewardItem.type,
                    "rewardAmount" to rewardItem.amount
                )
            )
        }
    }

    private fun schedulePendingTimeout() {
        mainHandler.postDelayed({
            if (!pendingRewardedShow) return@postDelayed
            val elapsed = System.currentTimeMillis() - pendingRewardedStartedAt
            if (elapsed < REWARDED_PENDING_TIMEOUT_MS) return@postDelayed

            pendingRewardedShow = false
            pendingRewardedStartedAt = 0L
            rewardedRetryCount = 0
            dispatch(
                "rewarded-unavailable",
                mapOf("reason" to "load-timeout")
            )
        }, REWARDED_PENDING_TIMEOUT_MS)
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
                    rewardedRetryCount = 0
                    rewardedAd = ad
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdShowedFullScreenContent() {
                            dispatch("rewarded-opened")
                        }

                        override fun onAdDismissedFullScreenContent() {
                            rewardedAd = null
                            pendingRewardedShow = false
                            pendingRewardedStartedAt = 0L
                            dispatch("rewarded-dismissed")
                            loadRewarded()
                            publishStatus()
                        }

                        override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                            rewardedAd = null
                            pendingRewardedShow = false
                            pendingRewardedStartedAt = 0L
                            dispatch(
                                "rewarded-failed",
                                mapOf("message" to safeMessage(adError.message))
                            )
                            loadRewarded()
                            publishStatus()
                        }
                    }
                    dispatch("rewarded-ready")
                    publishStatusWithoutReload()

                    if (pendingRewardedShow) {
                        mainHandler.post {
                            if (pendingRewardedShow && rewardedAd != null) {
                                showRewarded()
                            }
                        }
                    }
                }

                override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                    rewardedLoading = false
                    rewardedAd = null

                    if (
                        pendingRewardedShow &&
                        rewardedRetryCount < REWARDED_MAX_RETRIES &&
                        System.currentTimeMillis() - pendingRewardedStartedAt < REWARDED_PENDING_TIMEOUT_MS
                    ) {
                        rewardedRetryCount += 1
                        dispatch(
                            "rewarded-retrying",
                            mapOf(
                                "attempt" to rewardedRetryCount,
                                "message" to safeMessage(loadAdError.message)
                            )
                        )
                        mainHandler.postDelayed(
                            { loadRewarded() },
                            REWARDED_RETRY_DELAY_MS
                        )
                        publishStatusWithoutReload()
                        return
                    }

                    pendingRewardedShow = false
                    pendingRewardedStartedAt = 0L
                    rewardedRetryCount = 0
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

    private fun publishStatusWithoutReload() {
        dispatch(
            "status",
            mapOf(
                "rewardedReady" to (rewardedAd != null),
                "rewardedLoading" to rewardedLoading,
                "rewardedPending" to pendingRewardedShow,
                "interstitialReady" to (interstitialAd != null),
                "rewardPurpose" to REWARD_PURPOSE,
                "boostHours" to BOOST_HOURS
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

        const val REWARD_PURPOSE = "mining-boost"
        const val BOOST_HOURS = 2
        const val INTERSTITIAL_COOLDOWN_MS = 3L * 60L * 1000L
        const val REWARDED_PENDING_TIMEOUT_MS = 15_000L
        const val REWARDED_RETRY_DELAY_MS = 1_500L
        const val REWARDED_MAX_RETRIES = 2
        const val MAX_ERROR_CHARS = 180
    }
}
