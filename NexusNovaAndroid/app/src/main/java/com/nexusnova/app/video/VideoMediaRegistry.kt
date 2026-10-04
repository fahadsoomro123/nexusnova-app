package com.nexusnova.app.video

import android.content.ContentResolver
import android.net.Uri
import java.util.concurrent.ConcurrentHashMap
import java.util.UUID

/**
 * In-memory registry that gives WebView-origin media a stable, opaque key.
 *
 * The key is intentionally not the content URI itself. Native export resolves
 * the key back to the original content URI without exposing Android provider
 * details to the JavaScript editor state.
 */
class VideoMediaRegistry(
    private val contentResolver: ContentResolver
) {
    data class Entry(
        val token: String,
        val uri: Uri,
        val mimeType: String?
    )

    private val entries = ConcurrentHashMap<String, Entry>()

    fun register(uri: Uri, mimeType: String?): Entry {
        val token = UUID.randomUUID().toString().replace("-", "")
        val entry = Entry(token, uri, mimeType)
        entries[token] = entry
        return entry
    }

    fun resolve(token: String): Entry? =
        entries[token.trim()]

    fun remove(token: String) {
        entries.remove(token.trim())
    }

    fun clear() {
        entries.clear()
    }

    fun validate(token: String): Uri? =
        resolve(token)?.uri?.takeIf { it.scheme == ContentResolver.SCHEME_CONTENT }

    fun size(): Int = entries.size
}
