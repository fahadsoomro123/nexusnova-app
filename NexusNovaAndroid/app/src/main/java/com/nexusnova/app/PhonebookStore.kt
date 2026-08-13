package com.nexusnova.app

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

data class CallerInfo(
    val id: String,
    val name: String,
    val phone: String,
    val address: String,
    val source: String
)

object PhonebookStore {
    private const val PREF = "nexus_phonebook"
    private const val ACTIVE_ACCOUNT_KEY = "active_account_id"
    private const val ENTRIES_KEY_PREFIX = "entries:"
    private const val MIN_PHONE_DIGITS = 10
    private const val MAX_PHONE_DIGITS = 15
    private const val MAX_NAME_CHARS = 100
    private const val MAX_ADDRESS_CHARS = 300
    private const val MAX_ACCOUNT_ID_CHARS = 128
    private const val MAX_CONTACT_ID_CHARS = 128

    private val lock = Any()
    private lateinit var prefs: SharedPreferences

    fun init(ctx: Context) {
        prefs = ctx.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)
    }

    fun normalize(raw: String): String {
        var value = raw.trim().replace(Regex("[^\\d+]"), "")
        if (value.count { it == '+' } > 1 || (value.contains('+') && !value.startsWith('+'))) {
            return ""
        }
        if (value.startsWith("00")) value = "+" + value.drop(2)
        // Pakistan local 03xxxxxxxxx → +92.
        if (Regex("^03\\d{9}$").matches(value)) value = "+92" + value.drop(1)
        if (Regex("^3\\d{9}$").matches(value)) value = "+92$value"
        return value
    }

    fun isValidPhone(raw: String): Boolean {
        val digits = normalize(raw).filter(Char::isDigit)
        return digits.length in MIN_PHONE_DIGITS..MAX_PHONE_DIGITS
    }

    fun setActiveAccount(accountId: String): Boolean {
        val cleanAccountId = cleanAccountId(accountId) ?: return false
        synchronized(lock) {
            prefs.edit().putString(ACTIVE_ACCOUNT_KEY, cleanAccountId).apply()
        }
        return true
    }

    fun clearActiveAccount(accountId: String?): Boolean {
        val requestedAccountId = accountId?.trim().orEmpty()
        synchronized(lock) {
            // An unauthenticated trusted app page has no UID to supply. It may
            // only clear the current marker; it cannot select another account.
            if (requestedAccountId.isNotEmpty()) {
                val cleanAccountId = cleanAccountId(requestedAccountId) ?: return false
                if (activeAccountIdLocked() != cleanAccountId) return false
            }
            val hadActiveAccount = activeAccountIdLocked() != null
            prefs.edit().remove(ACTIVE_ACCOUNT_KEY).apply()
            return hadActiveAccount
        }
    }

    fun save(accountId: String, contactId: String, name: String, phone: String, address: String): Boolean {
        val cleanAccountId = cleanAccountId(accountId) ?: return false
        val cleanContactId = cleanContactId(contactId) ?: return false
        val cleanName = name.trim()
        val cleanAddress = address.trim()
        val normalizedPhone = normalize(phone)
        if (cleanName.isEmpty() || cleanName.length > MAX_NAME_CHARS ||
            cleanAddress.length > MAX_ADDRESS_CHARS || !isValidPhone(normalizedPhone)
        ) return false

        synchronized(lock) {
            // A stale page cannot alter a different signed-in user's native contacts.
            if (activeAccountIdLocked() != cleanAccountId) return false
            val contacts = allForAccountLocked(cleanAccountId)
                .filterNot { it.id == cleanContactId }
                .toMutableList()
            contacts.add(0, CallerInfo(cleanContactId, cleanName, normalizedPhone, cleanAddress, "Phonebook"))
            writeContactsLocked(cleanAccountId, contacts)
        }
        return true
    }

    fun delete(accountId: String, contactId: String): Boolean {
        val cleanAccountId = cleanAccountId(accountId) ?: return false
        val cleanContactId = cleanContactId(contactId) ?: return false

        synchronized(lock) {
            // Deletes are exact contact-ID operations within the active account only.
            if (activeAccountIdLocked() != cleanAccountId) return false
            val contacts = allForAccountLocked(cleanAccountId)
            val retained = contacts.filterNot { it.id == cleanContactId }
            if (retained.size == contacts.size) return false
            writeContactsLocked(cleanAccountId, retained)
        }
        return true
    }

    fun lookup(rawNumber: String): CallerInfo? {
        val digits = normalize(rawNumber).filter(Char::isDigit)
        // Short suffixes disclose a stored caller too easily. Incoming caller
        // IDs contain the full number, so require a meaningful lookup length.
        if (digits.length !in MIN_PHONE_DIGITS..MAX_PHONE_DIGITS) return null

        return synchronized(lock) {
            val activeAccountId = activeAccountIdLocked() ?: return@synchronized null
            allForAccountLocked(activeAccountId).firstOrNull { caller ->
                val callerDigits = normalize(caller.phone).filter(Char::isDigit)
                callerDigits.length >= MIN_PHONE_DIGITS && (
                    callerDigits == digits ||
                        callerDigits.endsWith(digits.takeLast(10)) ||
                        digits.endsWith(callerDigits.takeLast(10))
                    )
            }
        }
    }

    fun countryGuess(raw: String): String {
        val phone = normalize(raw)
        return when {
            phone.startsWith("+92") || Regex("^0?3\\d{9}$").matches(phone.replace("+", "")) -> "Pakistan"
            phone.startsWith("+91") -> "India"
            phone.startsWith("+971") -> "UAE"
            phone.startsWith("+966") -> "Saudi Arabia"
            phone.startsWith("+1") -> "USA/Canada"
            phone.startsWith("+44") -> "UK"
            else -> "Unknown region"
        }
    }

    private fun cleanAccountId(value: String): String? {
        val accountId = value.trim()
        return accountId.takeIf {
            it.length in 1..MAX_ACCOUNT_ID_CHARS &&
                it.none { character -> Character.isISOControl(character) }
        }
    }

    private fun cleanContactId(value: String): String? {
        val contactId = value.trim()
        return contactId.takeIf {
            it.length in 1..MAX_CONTACT_ID_CHARS &&
                it.all { character -> character.isLetterOrDigit() || character == '-' || character == '_' }
        }
    }

    private fun activeAccountIdLocked(): String? =
        prefs.getString(ACTIVE_ACCOUNT_KEY, null)?.let(::cleanAccountId)

    private fun allForAccountLocked(accountId: String): List<CallerInfo> = try {
        val entries = JSONArray(prefs.getString(entriesKey(accountId), "[]") ?: "[]")
        buildList {
            for (index in 0 until entries.length()) {
                val entry = entries.optJSONObject(index) ?: continue
                val id = cleanContactId(entry.optString("id")) ?: continue
                val name = entry.optString("name").trim()
                val phone = normalize(entry.optString("phone"))
                val address = entry.optString("address").trim()
                if (name.isEmpty() || name.length > MAX_NAME_CHARS ||
                    address.length > MAX_ADDRESS_CHARS || !isValidPhone(phone)
                ) continue
                add(
                    CallerInfo(
                        id = id,
                        name = name,
                        phone = phone,
                        address = address,
                        source = entry.optString("source", "Phonebook")
                    )
                )
            }
        }
    } catch (_: Exception) {
        emptyList()
    }

    private fun writeContactsLocked(accountId: String, contacts: List<CallerInfo>) {
        val entries = JSONArray()
        contacts.forEach { contact ->
            entries.put(JSONObject().apply {
                put("id", contact.id)
                put("name", contact.name)
                put("phone", contact.phone)
                put("address", contact.address)
                put("source", contact.source)
            })
        }
        prefs.edit().putString(entriesKey(accountId), entries.toString()).apply()
    }

    private fun entriesKey(accountId: String): String = ENTRIES_KEY_PREFIX +
        Base64.encodeToString(
            accountId.toByteArray(Charsets.UTF_8),
            Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP
        )
}
