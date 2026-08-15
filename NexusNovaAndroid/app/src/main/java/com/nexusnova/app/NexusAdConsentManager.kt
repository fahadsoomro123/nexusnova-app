package com.nexusnova.app

import android.app.Activity
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/**
 * Production privacy gate for NexusNova ads.
 *
 * This class is intentionally dormant while NexusAdManager remains in TEST_MODE.
 * When production ads are enabled, call gather() before initializing/requesting
 * Google Mobile Ads. It refreshes consent state on the current launch, presents
 * any required privacy message, and only reports true when UMP allows ad requests.
 */
class NexusAdConsentManager(
    private val activity: Activity
) {
    private val consentInformation: ConsentInformation =
        UserMessagingPlatform.getConsentInformation(activity)

    fun gather(onComplete: (Boolean) -> Unit) {
        val params = ConsentRequestParameters.Builder().build()

        consentInformation.requestConsentInfoUpdate(
            activity,
            params,
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) {
                    onComplete(consentInformation.canRequestAds())
                }
            },
            {
                // UMP can retain a valid decision from a previous session. Google
                // recommends checking canRequestAds() even when the refresh fails.
                onComplete(consentInformation.canRequestAds())
            }
        )
    }

    fun privacyOptionsRequired(): Boolean =
        consentInformation.privacyOptionsRequirementStatus ==
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED

    fun showPrivacyOptions(onComplete: (String?) -> Unit = {}) {
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { error ->
            onComplete(error?.message)
        }
    }
}
