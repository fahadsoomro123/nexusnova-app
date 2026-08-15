package com.nexusnova.app

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAd
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.rewarded.OnUserEarnedRewardListener
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAdEventCallback
import org.json.JSONObject

/**
 * Native ad owner for NexusNova's WebView shell.
 *
 * This implementation uses Google's GMA Next-Gen SDK instead of the legacy
 * play-services-ads RPC path. Reward requests preserve their web-side purpose
 * (for example mining-boost vs daily-reward-test) all the way through the
 * native callbacks, so unrelated feature handlers cannot consume each other's
 * events.
 *
 * TEST MODE only:
 * - Primary: Google's Rewarded demo unit.
 * - Fallback: Google's Rewarded Interstitial demo unit. Both are official test
 *   units configured by Google for development requests. The fallback exists
 *   only to make owner testing resilient; it is disabled for production IDs.
 */
class NexusAdManager(
    private val activity: Activity,
    private val webView: WebView,
    private val isTrustedPage: (WebView?) -> Boolean
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    private var initializationStarted = false
    private var initialized = false

    private var rewardedLoading = false
    private var rewardedFallbackLoading = false
    private var interstitialLoading = false

    private var rewardedAd: RewardedAd? = null
    private var rewardedFallbackAd: RewardedInterstitialAd? = null
    private var interstitialAd: InterstitialAd? = null

    private var lastInterstitialShownAt = 0L

    private var pendingRewardedShow = false
    private var pendingRewardedStartedAt = 0L
    private var pendingRewardPurpose = REWARD_PURPOSE_MINING
    private var pendingTestOnly = false
    private var showingRewarded = false

    private var rewardedRetryRound = 0
    private var rewardedRetryScheduled = false
    private var primaryLastError: AdFailure? = null
    private var fallbackLastError: AdFailure? = null

    private data class AdFailure(
        val code: Int,
        val codeName: String,
        val message: String,
        val responseInfo: String
    )

    fun initialize() {
        if (initializationStarted) return
        initializationStarted = true

        Thread {
            try {
                val config = InitializationConfig.Builder(adMobAppId()).build()
                MobileAds.initialize(activity, config) { status ->
                    val adapterSummary = status.adapterStatusMap.entries
                        .joinToString(" | ") { (name, adapter) ->
                            "${name.substringAfterLast('.')}:${adapter.initializationState}:${adapter.description}"
                        }
                        .take(MAX_DIAGNOSTIC_CHARS)
                    dispatch(
                        "sdk-adapters-ready",
                        mapOf("sdkFamily" to SDK_FAMILY, "adapters" to adapterSummary)
                    )
                }

                mainHandler.post {
                    if (activity.isFinishing || activity.isDestroyed) return@post
                    initialized = true
                    dispatch("sdk-ready", mapOf("sdkFamily" to SDK_FAMILY))
                    ensureAdsLoaded()
                    if (pendingRewardedShow) tryPresentPendingReward()
                    publishStatus()
                }
            } catch (error: Throwable) {
                mainHandler.post {
                    initialized = false
                    initializationStarted = false
                    dispatch(
                        "sdk-init-failed",
                        mapOf(
                            "sdkFamily" to SDK_FAMILY,
                            "message" to safeMessage(error.message ?: error.toString())
                        )
                    )
                    failPendingReward("sdk-init-failed")
                }
            }
        }.start()
    }

    fun publishStatus() {
        mainHandler.post {
            if (!initialized) initialize()
            if (initialized) ensureAdsLoaded()
            publishStatusWithoutReload()
        }
    }

    fun showRewarded(rewardPurpose: String? = null, testOnly: Boolean = false) {
        mainHandler.post {
            val purpose = sanitizePurpose(rewardPurpose)

            if (showingRewarded) {
                dispatch(
                    "rewarded-preparing",
                    mapOf(
                        "reason" to "ad-already-showing",
                        "rewardPurpose" to purpose,
                        "testOnly" to testOnly
                    )
                )
                return@post
            }

            if (pendingRewardedShow) {
                dispatch(
                    "rewarded-preparing",
                    mapOf(
                        "reason" to "request-already-pending",
                        "rewardPurpose" to pendingRewardPurpose,
                        "testOnly" to pendingTestOnly
                    )
                )
                return@post
            }

            pendingRewardPurpose = purpose
            pendingTestOnly = testOnly

            if (rewardedAd != null || (TEST_MODE && rewardedFallbackAd != null)) {
                pendingRewardedShow = true
                pendingRewardedStartedAt = System.currentTimeMillis()
                tryPresentPendingReward()
                return@post
            }

            pendingRewardedShow = true
            pendingRewardedStartedAt = System.currentTimeMillis()
            rewardedRetryRound = 0
            primaryLastError = null
            fallbackLastError = null

            dispatch(
                "rewarded-preparing",
                mapOf(
                    "reason" to "loading-next-gen-ad",
                    "rewardPurpose" to pendingRewardPurpose,
                    "testOnly" to pendingTestOnly,
                    "timeoutMs" to REWARDED_PENDING_TIMEOUT_MS,
                    "sdkFamily" to SDK_FAMILY
                )
            )

            schedulePendingTimeout()
            if (!initialized) initialize() else ensureRewardedLoaded()
        }
    }

    fun showInterstitial() {
        mainHandler.post {
            if (!initialized) {
                initialize()
                dispatch("interstitial-unavailable", mapOf("reason" to "sdk-initializing"))
                return@post
            }

            val now = System.currentTimeMillis()
            if (now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {
                dispatch("interstitial-skipped", mapOf("reason" to "cooldown"))
                return@post
            }

            val ad = interstitialAd
            if (ad == null) {
                dispatch("interstitial-unavailable", mapOf("reason" to "loading-or-no-fill"))
                loadInterstitial()
                return@post
            }

            interstitialAd = null
            lastInterstitialShownAt = now
            dispatch("interstitial-showing")
            ad.show(activity)
        }
    }

    private fun ensureAdsLoaded() {
        ensureRewardedLoaded()
        loadInterstitial()
    }

    private fun ensureRewardedLoaded() {
        loadPrimaryRewarded()
        if (TEST_MODE) loadFallbackRewarded()
    }

    private fun loadPrimaryRewarded() {
        if (!initialized || rewardedLoading || rewardedAd != null || activity.isFinishing || activity.isDestroyed) return
        rewardedLoading = true

        RewardedAd.load(
            AdRequest.Builder(rewardedUnitId()).build(),
            object : AdLoadCallback<RewardedAd> {
                override fun onAdLoaded(ad: RewardedAd) {
                    mainHandler.post {
                        rewardedLoading = false
                        primaryLastError = null
                        rewardedAd = ad
                        ad.adEventCallback = object : RewardedAdEventCallback {
                            override fun onAdShowedFullScreenContent() {
                                dispatchRewardEvent("rewarded-opened", "rewarded")
                            }

                            override fun onAdDismissedFullScreenContent() {
                                mainHandler.post {
                                    rewardedAd = null
                                    showingRewarded = false
                                    dispatchRewardEvent("rewarded-dismissed", "rewarded")
                                    clearActiveRewardRequest()
                                    loadPrimaryRewarded()
                                    if (TEST_MODE) loadFallbackRewarded()
                                    publishStatusWithoutReload()
                                }
                            }

                            override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) {
                                mainHandler.post {
                                    rewardedAd = null
                                    showingRewarded = false
                                    dispatchRewardEvent(
                                        "rewarded-failed",
                                        "rewarded",
                                        mapOf(
                                            "codeName" to error.code.toString(),
                                            "message" to safeMessage(error.message)
                                        )
                                    )
                                    clearActiveRewardRequest()
                                    ensureRewardedLoaded()
                                    publishStatusWithoutReload()
                                }
                            }
                        }

                        dispatch(
                            "rewarded-ready",
                            mapOf("format" to "rewarded", "sdkFamily" to SDK_FAMILY)
                        )
                        publishStatusWithoutReload()
                        tryPresentPendingReward()
                    }
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    mainHandler.post {
                        rewardedLoading = false
                        rewardedAd = null
                        primaryLastError = failureFrom(error)
                        onRewardedFormatLoadFailed("rewarded", primaryLastError!!)
                    }
                }
            }
        )
    }

    private fun loadFallbackRewarded() {
        if (!TEST_MODE || !initialized || rewardedFallbackLoading || rewardedFallbackAd != null || activity.isFinishing || activity.isDestroyed) return
        rewardedFallbackLoading = true

        RewardedInterstitialAd.load(
            AdRequest.Builder(TEST_REWARDED_INTERSTITIAL_AD_UNIT_ID).build(),
            object : AdLoadCallback<RewardedInterstitialAd> {
                override fun onAdLoaded(ad: RewardedInterstitialAd) {
                    mainHandler.post {
                        rewardedFallbackLoading = false
                        fallbackLastError = null
                        rewardedFallbackAd = ad
                        ad.adEventCallback = object : RewardedInterstitialAdEventCallback {
                            override fun onAdShowedFullScreenContent() {
                                dispatchRewardEvent("rewarded-opened", "rewarded-interstitial-fallback")
                            }

                            override fun onAdDismissedFullScreenContent() {
                                mainHandler.post {
                                    rewardedFallbackAd = null
                                    showingRewarded = false
                                    dispatchRewardEvent("rewarded-dismissed", "rewarded-interstitial-fallback")
                                    clearActiveRewardRequest()
                                    loadFallbackRewarded()
                                    loadPrimaryRewarded()
                                    publishStatusWithoutReload()
                                }
                            }

                            override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) {
                                mainHandler.post {
                                    rewardedFallbackAd = null
                                    showingRewarded = false
                                    dispatchRewardEvent(
                                        "rewarded-failed",
                                        "rewarded-interstitial-fallback",
                                        mapOf(
                                            "codeName" to error.code.toString(),
                                            "message" to safeMessage(error.message)
                                        )
                                    )
                                    clearActiveRewardRequest()
                                    ensureRewardedLoaded()
                                    publishStatusWithoutReload()
                                }
                            }
                        }

                        dispatch(
                            "rewarded-ready",
                            mapOf("format" to "rewarded-interstitial-fallback", "sdkFamily" to SDK_FAMILY)
                        )
                        publishStatusWithoutReload()
                        tryPresentPendingReward()
                    }
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    mainHandler.post {
                        rewardedFallbackLoading = false
                        rewardedFallbackAd = null
                        fallbackLastError = failureFrom(error)
                        onRewardedFormatLoadFailed("rewarded-interstitial-fallback", fallbackLastError!!)
                    }
                }
            }
        )
    }

    private fun onRewardedFormatLoadFailed(format: String, failure: AdFailure) {
        dispatch(
            "rewarded-format-failed",
            mapOf(
                "format" to format,
                "code" to failure.code,
                "codeName" to failure.codeName,
                "message" to failure.message,
                "responseInfo" to failure.responseInfo,
                "rewardPurpose" to pendingRewardPurpose,
                "testOnly" to pendingTestOnly,
                "sdkFamily" to SDK_FAMILY
            )
        )

        if (!pendingRewardedShow) {
            publishStatusWithoutReload()
            return
        }

        if (rewardedAd != null || (TEST_MODE && rewardedFallbackAd != null)) {
            tryPresentPendingReward()
            return
        }

        if (rewardedLoading || (TEST_MODE && rewardedFallbackLoading)) {
            publishStatusWithoutReload()
            return
        }

        if (rewardedRetryRound < REWARDED_MAX_RETRY_ROUNDS) {
            scheduleRewardRetry()
            return
        }

        failPendingReward("all-rewarded-test-formats-unavailable")
    }

    private fun scheduleRewardRetry() {
        if (rewardedRetryScheduled || !pendingRewardedShow) return
        rewardedRetryScheduled = true
        rewardedRetryRound += 1

        dispatch(
            "rewarded-retrying",
            mapOf(
                "attempt" to rewardedRetryRound,
                "rewardPurpose" to pendingRewardPurpose,
                "testOnly" to pendingTestOnly,
                "primaryCode" to (primaryLastError?.code ?: -1),
                "primaryMessage" to (primaryLastError?.message ?: ""),
                "fallbackCode" to (fallbackLastError?.code ?: -1),
                "fallbackMessage" to (fallbackLastError?.message ?: ""),
                "sdkFamily" to SDK_FAMILY
            )
        )

        mainHandler.postDelayed({
            rewardedRetryScheduled = false
            if (!pendingRewardedShow) return@postDelayed
            ensureRewardedLoaded()
        }, REWARDED_RETRY_DELAY_MS)
    }

    private fun tryPresentPendingReward() {
        if (!pendingRewardedShow || showingRewarded || activity.isFinishing || activity.isDestroyed) return

        rewardedAd?.let { ad ->
            rewardedAd = null
            presentPrimaryRewarded(ad)
            return
        }

        if (TEST_MODE) {
            rewardedFallbackAd?.let { ad ->
                rewardedFallbackAd = null
                presentFallbackRewarded(ad)
                return
            }
        }

        if (initialized) ensureRewardedLoaded()
    }

    private fun presentPrimaryRewarded(ad: RewardedAd) {
        showingRewarded = true
        pendingRewardedShow = false
        rewardedRetryScheduled = false

        dispatchRewardEvent("rewarded-showing", "rewarded")
        ad.show(
            activity,
            OnUserEarnedRewardListener { rewardItem ->
                dispatchRewardEvent(
                    "rewarded-earned",
                    "rewarded",
                    mapOf(
                        "rewardType" to rewardItem.type,
                        "rewardAmount" to rewardItem.amount
                    )
                )
            }
        )
    }

    private fun presentFallbackRewarded(ad: RewardedInterstitialAd) {
        showingRewarded = true
        pendingRewardedShow = false
        rewardedRetryScheduled = false

        dispatchRewardEvent("rewarded-showing", "rewarded-interstitial-fallback")
        ad.show(
            activity,
            OnUserEarnedRewardListener { rewardItem ->
                dispatchRewardEvent(
                    "rewarded-earned",
                    "rewarded-interstitial-fallback",
                    mapOf(
                        "rewardType" to rewardItem.type,
                        "rewardAmount" to rewardItem.amount
                    )
                )
            }
        )
    }

    private fun schedulePendingTimeout() {
        mainHandler.postDelayed({
            if (!pendingRewardedShow) return@postDelayed
            val elapsed = System.currentTimeMillis() - pendingRewardedStartedAt
            if (elapsed < REWARDED_PENDING_TIMEOUT_MS) return@postDelayed
            failPendingReward("load-timeout")
        }, REWARDED_PENDING_TIMEOUT_MS)
    }

    private fun failPendingReward(reason: String) {
        if (!pendingRewardedShow) return

        val primary = primaryLastError
        val fallback = fallbackLastError
        pendingRewardedShow = false
        rewardedRetryScheduled = false

        dispatch(
            "rewarded-load-failed",
            mapOf(
                "reason" to reason,
                "code" to (primary?.code ?: fallback?.code ?: -1),
                "codeName" to (primary?.codeName ?: fallback?.codeName ?: "UNKNOWN"),
                "message" to buildString {
                    append(primary?.message ?: "Primary rewarded unavailable")
                    if (TEST_MODE) {
                        append(" | fallback: ")
                        append(fallback?.message ?: "unavailable")
                    }
                }.take(MAX_ERROR_CHARS),
                "primaryResponse" to (primary?.responseInfo ?: ""),
                "fallbackResponse" to (fallback?.responseInfo ?: ""),
                "rewardPurpose" to pendingRewardPurpose,
                "testOnly" to pendingTestOnly,
                "sdkFamily" to SDK_FAMILY
            )
        )

        clearActiveRewardRequest()
        publishStatusWithoutReload()
    }

    private fun clearActiveRewardRequest() {
        pendingRewardedStartedAt = 0L
        pendingRewardPurpose = REWARD_PURPOSE_MINING
        pendingTestOnly = false
        rewardedRetryRound = 0
        rewardedRetryScheduled = false
        primaryLastError = null
        fallbackLastError = null
    }

    private fun dispatchRewardEvent(
        event: String,
        format: String,
        extras: Map<String, Any?> = emptyMap()
    ) {
        dispatch(
            event,
            mapOf(
                "format" to format,
                "rewardPurpose" to pendingRewardPurpose,
                "testOnly" to pendingTestOnly,
                "sdkFamily" to SDK_FAMILY,
                "boostHours" to BOOST_HOURS
            ) + extras
        )
    }

    private fun loadInterstitial() {
        if (!initialized || interstitialLoading || interstitialAd != null || activity.isFinishing || activity.isDestroyed) return
        interstitialLoading = true

        InterstitialAd.load(
            AdRequest.Builder(interstitialUnitId()).build(),
            object : AdLoadCallback<InterstitialAd> {
                override fun onAdLoaded(ad: InterstitialAd) {
                    mainHandler.post {
                        interstitialLoading = false
                        interstitialAd = ad
                        ad.adEventCallback = object : InterstitialAdEventCallback {
                            override fun onAdShowedFullScreenContent() {
                                dispatch("interstitial-opened")
                            }

                            override fun onAdDismissedFullScreenContent() {
                                mainHandler.post {
                                    interstitialAd = null
                                    dispatch("interstitial-dismissed")
                                    loadInterstitial()
                                    publishStatusWithoutReload()
                                }
                            }

                            override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) {
                                mainHandler.post {
                                    interstitialAd = null
                                    dispatch(
                                        "interstitial-failed",
                                        mapOf(
                                            "codeName" to error.code.toString(),
                                            "message" to safeMessage(error.message)
                                        )
                                    )
                                    loadInterstitial()
                                    publishStatusWithoutReload()
                                }
                            }
                        }
                        dispatch("interstitial-ready", mapOf("sdkFamily" to SDK_FAMILY))
                        publishStatusWithoutReload()
                    }
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    mainHandler.post {
                        interstitialLoading = false
                        interstitialAd = null
                        val failure = failureFrom(error)
                        dispatch(
                            "interstitial-load-failed",
                            mapOf(
                                "code" to failure.code,
                                "codeName" to failure.codeName,
                                "message" to failure.message,
                                "responseInfo" to failure.responseInfo,
                                "sdkFamily" to SDK_FAMILY
                            )
                        )
                        publishStatusWithoutReload()
                    }
                }
            }
        )
    }

    private fun publishStatusWithoutReload() {
        dispatch(
            "status",
            mapOf(
                "sdkReady" to initialized,
                "sdkFamily" to SDK_FAMILY,
                "rewardedReady" to (rewardedAd != null || (TEST_MODE && rewardedFallbackAd != null)),
                "rewardedPrimaryReady" to (rewardedAd != null),
                "rewardedFallbackReady" to (TEST_MODE && rewardedFallbackAd != null),
                "rewardedLoading" to (rewardedLoading || rewardedFallbackLoading),
                "rewardedPending" to pendingRewardedShow,
                "interstitialReady" to (interstitialAd != null),
                "rewardPurpose" to if (pendingRewardedShow || showingRewarded) pendingRewardPurpose else REWARD_PURPOSE_MINING,
                "boostHours" to BOOST_HOURS
            )
        )
    }

    private fun failureFrom(error: LoadAdError): AdFailure {
        val codeName = error.code.toString()
        return AdFailure(
            code = legacyCodeFor(codeName),
            codeName = codeName,
            message = safeMessage(error.message),
            responseInfo = safeMessage(error.responseInfo?.toString() ?: "", MAX_DIAGNOSTIC_CHARS)
        )
    }

    private fun legacyCodeFor(codeName: String): Int = when (codeName.uppercase()) {
        "INTERNAL_ERROR" -> 0
        "INVALID_REQUEST" -> 1
        "NETWORK_ERROR" -> 2
        "NO_FILL" -> 3
        "APP_ID_MISSING" -> 4
        "MEDIATION_NO_FILL" -> 5
        "INVALID_AD_STRING" -> 6
        else -> -1
    }

    private fun sanitizePurpose(raw: String?): String {
        val purpose = raw.orEmpty().trim().lowercase()
        return when (purpose) {
            REWARD_PURPOSE_DAILY_TEST -> REWARD_PURPOSE_DAILY_TEST
            REWARD_PURPOSE_MINING -> REWARD_PURPOSE_MINING
            else -> REWARD_PURPOSE_MINING
        }
    }

    private fun dispatch(event: String, extras: Map<String, Any?> = emptyMap()) {
        val detail = JSONObject()
            .put("event", event)
            .put("provider", "admob")
            .put("testMode", TEST_MODE)
            .put("sdkFamily", SDK_FAMILY)

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

    private fun adMobAppId(): String =
        if (TEST_MODE) TEST_ADMOB_APP_ID else PRODUCTION_ADMOB_APP_ID

    private fun rewardedUnitId(): String =
        if (TEST_MODE) TEST_REWARDED_AD_UNIT_ID else PRODUCTION_REWARDED_AD_UNIT_ID

    private fun interstitialUnitId(): String =
        if (TEST_MODE) TEST_INTERSTITIAL_AD_UNIT_ID else PRODUCTION_INTERSTITIAL_AD_UNIT_ID

    private fun safeMessage(message: String?, limit: Int = MAX_ERROR_CHARS): String =
        (message ?: "Ad unavailable").take(limit)

    private companion object {
        const val SDK_FAMILY = "gma-next-gen-1.3.0"
        const val TEST_MODE = true

        const val TEST_ADMOB_APP_ID = "ca-app-pub-3940256099942544~3347511713"
        const val TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917"
        const val TEST_REWARDED_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/5354046379"
        const val TEST_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/1033173712"

        const val PRODUCTION_ADMOB_APP_ID = "ca-app-pub-5070673529890078~1824799663"
        const val PRODUCTION_REWARDED_AD_UNIT_ID = "ca-app-pub-5070673529890078/7194148596"
        const val PRODUCTION_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-5070673529890078/7807608294"

        const val REWARD_PURPOSE_MINING = "mining-boost"
        const val REWARD_PURPOSE_DAILY_TEST = "daily-reward-test"
        const val BOOST_HOURS = 2

        const val INTERSTITIAL_COOLDOWN_MS = 3L * 60L * 1000L
        const val REWARDED_PENDING_TIMEOUT_MS = 45_000L
        const val REWARDED_RETRY_DELAY_MS = 3_000L
        const val REWARDED_MAX_RETRY_ROUNDS = 4
        const val MAX_ERROR_CHARS = 260
        const val MAX_DIAGNOSTIC_CHARS = 700
    }
}
