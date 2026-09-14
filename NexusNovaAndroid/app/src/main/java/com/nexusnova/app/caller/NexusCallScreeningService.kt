package com.nexusnova.app.caller

import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import com.nexusnova.app.IncomingCallActivity
import com.nexusnova.app.PhonebookStore

/**
 * The platform binds this service when NexusNova is the selected Caller ID & spam app.
 */
class NexusCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        respondToCall(callDetails, allowCallResponse())
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            callDetails.callDirection != Call.Details.DIRECTION_INCOMING
        ) return

        val phone = callDetails.handle?.schemeSpecificPart.orEmpty()
        val known = PhonebookStore.lookup(phone)
        val name = known?.name ?: "Unknown number"
        val address = known?.address?.ifBlank { null }
            ?: if (known != null) known.source
            else PhonebookStore.countryGuess(phone) + " · Not in NexusNova phonebook"

        startActivity(
            Intent(this, IncomingCallActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
                putExtra(IncomingCallActivity.EXTRA_PHONE, phone)
                putExtra(IncomingCallActivity.EXTRA_NAME, name)
                putExtra(IncomingCallActivity.EXTRA_ADDRESS, address)
                putExtra(IncomingCallActivity.EXTRA_KNOWN, known != null)
            }
        )
    }

    private fun allowCallResponse(): CallResponse = CallResponse.Builder()
        .setDisallowCall(false)
        .setRejectCall(false)
        .setSkipCallLog(false)
        .setSkipNotification(false)
        .build()
}
