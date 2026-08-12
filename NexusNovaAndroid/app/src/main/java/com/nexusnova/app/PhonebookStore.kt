package com.nexusnova.app

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class CallerInfo(
    val name: String,
    val phone: String,
    val address: String,
    val source: String
)

object PhonebookStore {
    private const val PREF = "nexus_phonebook"
    private const val KEY = "entries"
    private lateinit var prefs: SharedPreferences

    fun init(ctx: Context) {
        prefs = ctx.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        // seed empty
        if (!prefs.contains(KEY)) {
            prefs.edit().putString(KEY, "[]").apply()
        }
    }

    fun normalize(raw: String): String {
        var s = raw.replace(Regex("[^\\d+]"), "")
        if (s.startsWith("00")) s = "+" + s.drop(2)
        // PK local 03xxxxxxxxx → +92
        if (Regex("^03\\d{9}$").matches(s)) s = "+92" + s.drop(1)
        if (Regex("^3\\d{9}$").matches(s)) s = "+92$s"
        return s
    }

    fun all(): List<CallerInfo> {
        val arr = JSONArray(prefs.getString(KEY, "[]"))
        val list = mutableListOf<CallerInfo>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            list.add(
                CallerInfo(
                    name = o.optString("name"),
                    phone = o.optString("phone"),
                    address = o.optString("address"),
                    source = o.optString("source", "Phonebook")
                )
            )
        }
        return list
    }

    fun save(name: String, phone: String, address: String) {
        val norm = normalize(phone)
        val list = all().toMutableList().filterNot {
            normalize(it.phone).replace(Regex("\\D"), "").takeLast(10) ==
                norm.replace(Regex("\\D"), "").takeLast(10)
        }.toMutableList()
        list.add(0, CallerInfo(name, norm, address, "Phonebook"))
        val arr = JSONArray()
        list.forEach {
            arr.put(JSONObject().apply {
                put("name", it.name)
                put("phone", it.phone)
                put("address", it.address)
                put("source", it.source)
            })
        }
        prefs.edit().putString(KEY, arr.toString()).apply()
    }

    fun lookup(rawNumber: String): CallerInfo? {
        val digits = normalize(rawNumber).replace(Regex("\\D"), "")
        if (digits.isEmpty()) return null
        return all().firstOrNull { c ->
            val d = normalize(c.phone).replace(Regex("\\D"), "")
            d.isNotEmpty() && (
                d == digits ||
                    d.endsWith(digits.takeLast(10)) ||
                    digits.endsWith(d.takeLast(10))
                )
        }
    }

    fun countryGuess(raw: String): String {
        val p = normalize(raw)
        return when {
            p.startsWith("+92") || Regex("^0?3\\d{9}$").matches(p.replace("+", "")) -> "Pakistan"
            p.startsWith("+91") -> "India"
            p.startsWith("+971") -> "UAE"
            p.startsWith("+966") -> "Saudi Arabia"
            p.startsWith("+1") -> "USA/Canada"
            p.startsWith("+44") -> "UK"
            else -> "Unknown region"
        }
    }
}
