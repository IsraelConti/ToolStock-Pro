package com.icapps.maintenpro

import android.accounts.Account
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import androidx.activity.result.IntentSenderRequest
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.common.api.Scope
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID
import java.util.concurrent.Executors

/** Tokens stay native. The WebView can only call these four bounded Drive operations. */
class GoogleDriveConnection(
    private val context: Context,
    private val purchaseToken: () -> String?,
    private val onResolution: (IntentSenderRequest) -> Unit,
    private val onChanged: () -> Unit
) {
    companion object {
        private const val SCOPE = "https://www.googleapis.com/auth/drive.appdata"
        private const val SCHEMA = "maintenpro.drive.v1"
        private const val MAX = 20 * 1024 * 1024
    }
    val executor = Executors.newSingleThreadExecutor()
    private val prefs = context.getSharedPreferences("maintenpro_drive", Context.MODE_PRIVATE)
    @Volatile private var accessToken = ""
    @Volatile private var accountId = ""
    @Volatile private var email = ""
    @Volatile private var entitled = false
    @Volatile private var checkedAt = 0L
    @Volatile private var authorizedAt = 0L
    @Volatile private var renewing = false
    @Volatile private var authorizing = false
    @Volatile private var closed = false
    @Volatile private var epoch = 0L
    private var resolutionEpoch = -1L
    private val main = Handler(Looper.getMainLooper())
    private val scopes = listOf(Scope(SCOPE), Scope("openid"), Scope("https://www.googleapis.com/auth/userinfo.email"))
    private val configured get() = BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank() && BuildConfig.SYNC_API_BASE.startsWith("https://")

    fun connect(interactive: Boolean = true) {
        if (closed || authorizing || (!interactive && renewing)) return
        if (!configured) { onChanged(); return }
        val lastEmail = prefs.getString("email", "").orEmpty()
        if (!interactive && lastEmail.isBlank()) return
        val attempt = ++epoch
        authorizing = true
        val builder = AuthorizationRequest.builder().setRequestedScopes(scopes)
        if (!interactive && lastEmail.isNotBlank()) builder.setAccount(Account(lastEmail, "com.google"))
        Identity.getAuthorizationClient(context).authorize(builder.build())
            .addOnSuccessListener { result ->
                if (closed || attempt != epoch) return@addOnSuccessListener
                if (result.hasResolution()) {
                    if (interactive && result.pendingIntent != null) {
                        resolutionEpoch = attempt
                        onResolution(IntentSenderRequest.Builder(result.pendingIntent!!.intentSender).build())
                    } else { authorizing = false; accessToken = ""; onChanged() }
                } else accept(result, attempt)
            }
            .addOnFailureListener {
                if (!closed && attempt == epoch) { authorizing = false; accessToken = ""; entitled = false; onChanged() }
            }
    }
    fun authorizationResult(intent: Intent?) {
        val attempt = resolutionEpoch
        resolutionEpoch = -1L
        if (closed || attempt != epoch) return
        try { accept(Identity.getAuthorizationClient(context).getAuthorizationResultFromIntent(intent), attempt) }
        catch (_: Exception) { authorizing = false; accessToken = ""; entitled = false; onChanged() }
    }
    private fun accept(result: AuthorizationResult, attempt: Long) {
        renewing = false
        val token = result.accessToken.orEmpty()
        executor.execute {
            try {
                if (closed || attempt != epoch) return@execute
                if (token.isBlank()) error("authorization-required")
                accessToken = token
                val profile = http("https://www.googleapis.com/oauth2/v3/userinfo", "GET", token)
                if (closed || attempt != epoch) return@execute
                if (profile.optString("sub").isBlank() || !profile.optBoolean("email_verified")) error("authorization-required")
                accountId = profile.getString("sub")
                email = profile.optString("email")
                authorizedAt = System.currentTimeMillis()
                prefs.edit().putString("email", email).apply()
                refreshEntitlement()
            } catch (_: Exception) { if (!closed && attempt == epoch) { accessToken = ""; entitled = false } }
            finally { if (attempt == epoch) authorizing = false }
            if (!closed && attempt == epoch) onChanged()
        }
    }
    fun refreshPurchase() {
        if (closed || executor.isShutdown) return
        executor.execute { refreshEntitlement(); onChanged() }
    }
    private fun refreshEntitlement() {
        entitled = false
        if (!configured || accessToken.isBlank() || purchaseToken().isNullOrBlank()) return
        try {
            val body = JSONObject().put("idToken", accessToken).put("purchaseToken", purchaseToken())
            val reply = http(BuildConfig.SYNC_API_BASE.trimEnd('/') + "/v1/session", "POST", accessToken, body.toString())
            val entitlement = reply.optJSONObject("entitlement")
            entitled = entitlement?.optBoolean("serverValidated") == true && entitlement.optBoolean("active") && entitlement.optString("productId") == "maintenpro_premium_monthly"
            checkedAt = System.currentTimeMillis()
        } catch (_: Exception) { entitled = false }
    }
    fun status(): JSONObject = JSONObject()
        .put("configured", configured).put("connected", accessToken.isNotBlank() && System.currentTimeMillis() - authorizedAt < 3_300_000)
        .put("accountId", accountId).put("email", email).put("entitled", entitled && System.currentTimeMillis() - checkedAt < 300_000)

    fun disconnect() {
        ++epoch; resolutionEpoch = -1L; authorizing = false; renewing = false
        val oldEmail = email
        accessToken = ""; accountId = ""; email = ""; entitled = false
        prefs.edit().remove("email").apply()
        if (oldEmail.isNotBlank()) {
            val request = RevokeAccessRequest.builder().setAccount(Account(oldEmail, "com.google")).setScopes(scopes).build()
            Identity.getAuthorizationClient(context).revokeAccess(request).addOnCompleteListener { onChanged() }
        } else onChanged()
    }

    fun close() {
        closed = true; ++epoch; authorizing = false; accessToken = ""; entitled = false
        executor.shutdownNow()
    }

    fun request(payload: JSONObject): JSONObject {
        val op = payload.optString("op")
        if (op == "status") {
            if (accessToken.isNotBlank() && System.currentTimeMillis() - authorizedAt >= 3_000_000) renewToken(accessToken)
            return status()
        }
        if (!configured) error("configuration-missing")
        if (accessToken.isBlank() || System.currentTimeMillis() - authorizedAt >= 3_300_000) error("authorization-required")
        if (System.currentTimeMillis() - checkedAt >= 300_000) refreshEntitlement()
        if (!entitled) error("purchase-required")
        val base = "https://www.googleapis.com/drive/v3/files"
        fun enc(value: String) = URLEncoder.encode(value, "UTF-8")
        fun fileId(): String = payload.optString("fileId").also { if (!it.matches(Regex("[A-Za-z0-9_-]{1,200}"))) error("invalid-file") }
        if (op == "list") {
            val files = JSONArray()
            var page = ""
            val seen = mutableSetOf<String>()
            do {
                val query = "trashed = false and appProperties has { key='schema' and value='$SCHEMA' }"
                val url = "$base?spaces=appDataFolder&pageSize=100&q=${enc(query)}&fields=${enc("nextPageToken,files(id,appProperties)")}" + if (page.isEmpty()) "" else "&pageToken=${enc(page)}"
                val result = http(url, "GET", accessToken)
                val rows = result.getJSONArray("files")
                for (i in 0 until rows.length()) {
                    val row = rows.getJSONObject(i)
                    files.put(JSONObject().put("id", row.getString("id")).put("deviceId", row.getJSONObject("appProperties").getString("deviceId")))
                }
                page = result.optString("nextPageToken")
                if (files.length() > 1000 || (page.isNotEmpty() && !seen.add(page))) error("too-many-devices")
            } while (page.isNotEmpty())
            return JSONObject().put("files", files)
        }
        if (op == "read") return http("$base/${fileId()}?alt=media", "GET", accessToken)
        if (op != "write") error("invalid-operation")
        val document = payload.getJSONObject("document")
        val device = payload.getString("deviceId")
        if (!device.matches(Regex("[A-Za-z0-9_-]{1,80}")) || document.optString("schema") != SCHEMA || document.optString("accountId") != accountId || document.optString("deviceId") != device) error("invalid-document")
        val data = document.toString()
        if (data.toByteArray().size > MAX) error("payload-too-large")
        val upload = "https://www.googleapis.com/upload/drive/v3/files"
        if (payload.optString("fileId").isNotEmpty()) {
            val id = fileId()
            val metadata = http("$base/$id?fields=${enc("id,appProperties")}", "GET", accessToken).getJSONObject("appProperties")
            if (metadata.optString("schema") != SCHEMA || metadata.optString("deviceId") != device) error("wrong-device-file")
            return http("$upload/$id?uploadType=media&fields=id", "PATCH", accessToken, data)
        }
        val boundary = "maintenpro_" + UUID.randomUUID().toString().replace("-", "")
        val metadata = JSONObject().put("name", "MaintenPro_$device.json").put("mimeType", "application/json")
            .put("parents", JSONArray().put("appDataFolder")).put("appProperties", JSONObject().put("schema", SCHEMA).put("deviceId", device))
        val multipart = "--$boundary\r\nContent-Type: application/json; charset=utf-8\r\n\r\n$metadata\r\n--$boundary\r\nContent-Type: application/json; charset=utf-8\r\n\r\n$data\r\n--$boundary--\r\n"
        return http("$upload?uploadType=multipart&fields=id", "POST", accessToken, multipart, "multipart/related; boundary=$boundary")
    }

    private fun renewToken(oldToken: String) {
        if (closed || renewing || authorizing || oldToken.isBlank()) return
        renewing = true
        main.post {
            Identity.getAuthorizationClient(context).clearToken(ClearTokenRequest.builder().setToken(oldToken).build())
                .addOnCompleteListener {
                    renewing = false
                    if (!closed && prefs.getString("email", "").orEmpty().isNotBlank()) connect(false)
                }
        }
    }

    private fun http(url: String, method: String, token: String, body: String? = null, contentType: String = "application/json; charset=utf-8"): JSONObject {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15000; connection.readTimeout = 25000
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Accept", "application/json")
            if (body != null) { connection.doOutput = true; connection.setRequestProperty("Content-Type", contentType); connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            if (status == 401 && url.startsWith("https://www.googleapis.com/")) {
                renewToken(token)
                error("authorization-required")
            }
            if (status == 401 || status == 403) error("authorization-required")
            if (status == 429) error("quota-exceeded")
            if (status !in 200..299) error("drive-unreachable")
            if (connection.contentLength > MAX) error("payload-too-large")
            val bytes = connection.inputStream.use { it.readBytesBounded(MAX) }
            return JSONObject(String(bytes, Charsets.UTF_8).ifEmpty { "{}" })
        } finally { connection.disconnect() }
    }
    private fun java.io.InputStream.readBytesBounded(max: Int): ByteArray {
        val output = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (true) { val count = read(buffer); if (count < 0) break; if (output.size() + count > max) error("payload-too-large"); output.write(buffer, 0, count) }
        return output.toByteArray()
    }
}
