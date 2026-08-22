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
import com.google.android.libraries.ads.mobile.sdk.rewarded.ServerSideVerificationOptions
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
 * - Primary: Google Ad Manager's direct-sold Rewarded demo unit.
 * - Fallback: Google Ad Manager's direct-sold Rewarded Interstitial demo unit.
 *   Google documents both demo units as configured to return test ads for
 *   development requests. Using direct-sold demo inventory avoids depending on
 *   an auction/no-fill path while validating NexusNova's reward plumbing.
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
    private var interstitialRetryRound = 0
    private var interstitialRetryScheduled = false
    private var interstitialRetryNotBeforeAt = 0L

    private var activeInterstitialPlacement = ""
    private var activeInterstitialFeature = ""

    private var rewardedAd: RewardedAd? = null
    private var rewardedFallbackAd: RewardedInterstitialAd? = null
    private var interstitialAd: InterstitialAd? = null

    private var lastInterstitialShownAt = 0L

    private var pendingRewardedShow = false
    private var pendingRewardedStartedAt = 0L
    private var pendingRewardPurpose = REWARD_PURPOSE_MINING
    private var pendingTestOnly = false
    private var pendingRewardUserId = ""
    private var pendingRewardCustomData = ""
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

    fun showRewarded(rewardPurpose: String? = null, testOnly: Boolean = false, userId: String? = null) {
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
            pendingRewardUserId = sanitizeRewardUserId(userId)
            pendingRewardCustomData = purpose

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

    fun showInterstitial(placement: String? = null, feature: String? = null, testOnly: Boolean = false) {
        mainHandler.post {
            val safePlacement = sanitizePlacement(placement)
            val safeFeature = sanitizeFeature(feature)
            val context = mapOf(
                "placement" to safePlacement,
                "feature" to safeFeature,
                "testOnly" to testOnly
            )
            val miningStartGate = safePlacement == "mining-start"

            if (!miningStartGate && safeFeature.isNotBlank() && safeFeature !in INTERSTITIAL_ALLOWED_FEATURES) {
                dispatch("interstitial-skipped", context + mapOf("reason" to "protected-or-ineligible"))
                return@post
            }

            if (showingRewarded || pendingRewardedShow) {
                dispatch("interstitial-skipped", context + mapOf("reason" to "rewarded-active"))
                return@post
            }

            if (!initialized) {
                initialize()
                dispatch("interstitial-unavailable", context + mapOf("reason" to "sdk-initializing"))
                return@post
            }

            val now = System.currentTimeMillis()
            val interstitialCooldownMs = if (BuildConfig.NEXUS_ADS_TEST_MODE) {
                TEST_INTERSTITIAL_COOLDOWN_MS
            } else {
                INTERSTITIAL_COOLDOWN_MS
            }
            if (!miningStartGate && now - lastInterstitialShownAt < interstitialCooldownMs) {
                dispatch("interstitial-skipped", context + mapOf("reason" to "cooldown"))
                return@post
            }

            val ad = interstitialAd
            if (ad == null) {
                dispatch("interstitial-unavailable", context + mapOf("reason" to "loading-or-no-fill"))
                loadInterstitial()
                return@post
            }

            interstitialAd = null
            activeInterstitialPlacement = safePlacement
            activeInterstitialFeature = safeFeature
            lastInterstitialShownAt = now
            dispatch("interstitial-showing", context)
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
        if (!TEST_MODE && pendingRewardUserId.isNotBlank()) {
            ad.setServerSideVerificationOptions(
                ServerSideVerificationOptions(pendingRewardUserId, pendingRewardCustomData)
            )
        }

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
        if (!TEST_MODE && pendingRewardUserId.isNotBlank()) {
            ad.setServerSideVerificationOptions(
                ServerSideVerificationOptions(pendingRewardUserId, pendingRewardCustomData)
            )
        }

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
        pendingRewardUserId = ""
        pendingRewardCustomData = ""
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
        if (System.currentTimeMillis() < interstitialRetryNotBeforeAt) return
        interstitialLoading = true

        InterstitialAd.load(
            AdRequest.Builder(interstitialUnitId()).build(),
            object : AdLoadCallback<InterstitialAd> {
                override fun onAdLoaded(ad: InterstitialAd) {
                    mainHandler.post {
                        interstitialLoading = false
                        interstitialRetryRound = 0
                        interstitialRetryScheduled = false
                        interstitialRetryNotBeforeAt = 0L
                        interstitialAd = ad
                        ad.adEventCallback = object : InterstitialAdEventCallback {
                            override fun onAdShowedFullScreenContent() {
                                dispatch(
                                    "interstitial-opened",
                                    mapOf(
                                        "placement" to activeInterstitialPlacement,
                                        "feature" to activeInterstitialFeature
                                    )
                                )
                            }

                            override fun onAdDismissedFullScreenContent() {
                                mainHandler.post {
                                    interstitialAd = null
                                    dispatch(
                                        "interstitial-dismissed",
                                        mapOf(
                                            "placement" to activeInterstitialPlacement,
                                            "feature" to activeInterstitialFeature
                                        )
                                    )
                                    activeInterstitialPlacement = ""
                                    activeInterstitialFeature = ""
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
                                            "message" to safeMessage(error.message),
                                            "placement" to activeInterstitialPlacement,
                                            "feature" to activeInterstitialFeature
                                        )
                                    )
                                    activeInterstitialPlacement = ""
                                    activeInterstitialFeature = ""
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
                        scheduleInterstitialRetry()
                        publishStatusWithoutReload()
                    }
                }
            }
        )
    }

    private fun scheduleInterstitialRetry() {
        if (interstitialRetryScheduled || interstitialAd != null || activity.isFinishing || activity.isDestroyed) return
        val exponent = interstitialRetryRound.coerceAtMost(3)
        val delayMs = (INTERSTITIAL_RETRY_BASE_MS * (1L shl exponent)).coerceAtMost(INTERSTITIAL_RETRY_MAX_MS)
        interstitialRetryRound = (interstitialRetryRound + 1).coerceAtMost(4)
        interstitialRetryScheduled = true
        interstitialRetryNotBeforeAt = System.currentTimeMillis() + delayMs
        dispatch(
            "interstitial-retrying",
            mapOf("retryInMs" to delayMs, "retryRound" to interstitialRetryRound)
        )
        mainHandler.postDelayed({
            interstitialRetryScheduled = false
            interstitialRetryNotBeforeAt = 0L
            loadInterstitial()
        }, delayMs)
    }

    private fun publishStatusWithoutReload() {
        dispatch(
            "status",
            mapOf(
                "sdkReady" to initialized,
                "ssvIdentityReady" to true,
                "sdkFamily" to SDK_FAMILY,
                "rewardedReady" to (rewardedAd != null || (TEST_MODE && rewardedFallbackAd != null)),
                "rewardedPrimaryReady" to (rewardedAd != null),
                "rewardedFallbackReady" to (TEST_MODE && rewardedFallbackAd != null),
                "rewardedLoading" to (rewardedLoading || rewardedFallbackLoading),
                "rewardedPending" to pendingRewardedShow,
                "interstitialReady" to (interstitialAd != null),
                "interstitialRetrying" to interstitialRetryScheduled,
                "interstitialRetryRound" to interstitialRetryRound,
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

    private fun sanitizePlacement(raw: String?): String =
        raw.orEmpty().trim().lowercase().replace(Regex("[^a-z0-9:_-]"), "-").take(80)

    private fun sanitizeFeature(raw: String?): String =
        raw.orEmpty().trim().lowercase().removePrefix("tab-").replace(Regex("[^a-z0-9:_-]"), "-").take(80)

    private fun sanitizePurpose(raw: String?): String {
        val purpose = raw.orEmpty().trim().lowercase()
        return when (purpose) {
            REWARD_PURPOSE_DAILY_TEST -> REWARD_PURPOSE_DAILY_TEST
            REWARD_PURPOSE_WATCH_AD -> REWARD_PURPOSE_WATCH_AD
            REWARD_PURPOSE_MINING -> REWARD_PURPOSE_MINING
            else -> REWARD_PURPOSE_MINING
        }
    }

    private fun sanitizeRewardUserId(raw: String?): String {
        val value = raw.orEmpty().trim()
        return value.takeIf { Regex("^[A-Za-z0-9:_-]{3,128}$").matches(it) }.orEmpty()
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
        val TEST_MODE = BuildConfig.NEXUS_ADS_TEST_MODE

        const val TEST_ADMOB_APP_ID = "ca-app-pub-3940256099942544~3347511713"
        const val TEST_REWARDED_AD_UNIT_ID = "/21775744923/example/rewarded"
        const val TEST_REWARDED_INTERSTITIAL_AD_UNIT_ID = "/21775744923/example/rewarded-interstitial"
        const val TEST_INTERSTITIAL_AD_UNIT_ID = "/21775744923/example/interstitial"

        const val PRODUCTION_ADMOB_APP_ID = "ca-app-pub-5070673529890078~1824799663"
        const val PRODUCTION_REWARDED_AD_UNIT_ID = "ca-app-pub-5070673529890078/7194148596"
        const val PRODUCTION_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-5070673529890078/7807608294"

        const val REWARD_PURPOSE_MINING = "mining-boost"
        const val REWARD_PURPOSE_DAILY_TEST = "daily-reward-test"
        const val REWARD_PURPOSE_WATCH_AD = "task-watch-ad"
        const val BOOST_HOURS = 2

        val INTERSTITIAL_ALLOWED_FEATURES = setOf(
            "tools", "finance", "money", "news", "learn", "travel", "smart", "ai",
            "entertainment", "browser", "mega-tools", "mega-finance", "mega-calendar",
            "mega-reminders", "mega-weather", "mega-learning", "mega-pakistan",
            "mega-shopping", "mega-marketplace", "mega-orders", "mega-teacher",
            "marketplace", "shopping"
        )

        const val INTERSTITIAL_COOLDOWN_MS = 3L * 60L * 1000L
        const val TEST_INTERSTITIAL_COOLDOWN_MS = 5_000L
        const val INTERSTITIAL_RETRY_BASE_MS = 15_000L
        const val INTERSTITIAL_RETRY_MAX_MS = 120_000L
        const val REWARDED_PENDING_TIMEOUT_MS = 45_000L
        const val REWARDED_RETRY_DELAY_MS = 3_000L
        const val REWARDED_MAX_RETRY_ROUNDS = 4
        const val MAX_ERROR_CHARS = 260
        const val MAX_DIAGNOSTIC_CHARS = 700
    }
}
