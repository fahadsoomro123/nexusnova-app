package com.nexusnova.app

import android.content.Intent
import android.webkit.JavascriptInterface
import android.widget.Toast

/**
 * JS bridge: window.NexusAndroid.saveContact(name, phone, address)
 *            window.NexusAndroid.openCallerSetup()
 *            window.NexusAndroid.lookup(phone) -> JSON string
 */
class NexusBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun saveContact(name: String, phone: String, address: String) {
        PhonebookStore.save(name, phone, address)
        activity.runOnUiThread {
            Toast.makeText(activity, "Saved: $name", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun openCallerSetup() {
        activity.runOnUiThread {
            activity.startActivity(Intent(activity, CallerSetupActivity::class.java))
        }
    }

    @JavascriptInterface
    fun lookup(phone: String): String {
        val info = PhonebookStore.lookup(phone)
        return if (info != null) {
            """{"known":true,"name":${jsonStr(info.name)},"phone":${jsonStr(info.phone)},"address":${jsonStr(info.address)},"source":${jsonStr(info.source)}}"""
        } else {
            val country = PhonebookStore.countryGuess(phone)
            """{"known":false,"name":"Unknown number","phone":${jsonStr(PhonebookStore.normalize(phone))},"address":${jsonStr("$country · Not in NexusNova phonebook")},"source":"none"}"""
        }
    }

    @JavascriptInterface
    fun requestCallerRole() {
        activity.runOnUiThread { activity.requestCallerRole() }
    }

    private fun jsonStr(s: String): String =
        "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
}
