package com.nexusnova.app.caller

import android.content.Intent
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import com.nexusnova.app.IncomingCallActivity
import com.nexusnova.app.PhonebookStore

/**
 * System delivers every incoming call here when NexusNova is the
 * selected Caller ID & spam app (ROLE_CALL_SCREENING).
 */
class NexusCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        val handle = callDetails.handle?.schemeSpecificPart ?: ""
        Log.i(TAG, "Incoming: $handle")

        val known = PhonebookStore.lookup(handle)
        val name = known?.name ?: "Unknown number"
        val address = known?.address?.ifBlank { null }
            ?: if (known != null) known.source
            else PhonebookStore.countryGuess(handle) + " · Not in NexusNova phonebook"

        val i = Intent(this, IncomingCallActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
            putExtra(IncomingCallActivity.EXTRA_PHONE, handle)
            putExtra(IncomingCallActivity.EXTRA_NAME, name)
            putExtra(IncomingCallActivity.EXTRA_ADDRESS, address)
            putExtra(IncomingCallActivity.EXTRA_KNOWN, known != null)
        }
        startActivity(i)

        // Identify only — do not block the call
        val response = CallResponse.Builder()
            .setDisallowCall(false)
            .setRejectCall(false)
            .setSilenceCall(false)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build()
        respondToCall(callDetails, response)
    }

    companion object {
        private const val TAG = "NexusCallScreen"
    }
}
