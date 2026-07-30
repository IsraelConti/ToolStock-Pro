package com.foodstock.pro

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.DocumentsContract
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import java.time.LocalDate
import java.time.ZoneId

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        uri ?: return@registerForActivityResult
        contentResolver.takePersistableUriPermission(
            uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )
        getSharedPreferences("foodstock", MODE_PRIVATE).edit().putString("drive_tree_uri", uri.toString()).apply()
        val safeName = DocumentsContract.getTreeDocumentId(uri).substringAfterLast(':').ifBlank { "Google Drive" }
        webView.evaluateJavascript("window.onFoodStockDriveFolderSelected(${quote(safeName)})", null)
    }

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uris = if (result.resultCode == Activity.RESULT_OK) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        } else null
        fileCallback?.onReceiveValue(uris)
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            webViewClient = WebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    callback: ValueCallback<Array<Uri>>?,
                    params: FileChooserParams?
                ): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    val intent = params?.createIntent()
                    if (intent == null) {
                        fileCallback = null
                        return false
                    }
                    return try {
                        filePicker.launch(intent)
                        true
                    } catch (_: Exception) {
                        fileCallback = null
                        false
                    }
                }
            }
            addJavascriptInterface(AndroidBridge(), "FoodStockAndroid")
            loadUrl("file:///android_asset/index.html")
        }
        setContentView(webView)
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            ActivityCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 104)
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "(function(){var b=document.getElementById('backBtn');if(b&&!b.classList.contains('hidden')){b.click();return 'handled'}return 'exit'})()"
                ) { result -> if (result.contains("exit")) { isEnabled = false; onBackPressedDispatcher.onBackPressed() } }
            }
        })
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun chooseDriveFolder() {
            runOnUiThread { folderPicker.launch(null) }
        }

        @JavascriptInterface
        fun scheduleExpiryAlarm(id: String, productName: String, lot: String, expiryDate: String, daysBefore: Int) {
            runOnUiThread {
                try {
                    val expiry = LocalDate.parse(expiryDate)
                    var alarmAt = expiry.minusDays(daysBefore.toLong())
                        .atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    if (alarmAt <= System.currentTimeMillis()) alarmAt = System.currentTimeMillis() + 5000
                    val intent = Intent(this@MainActivity, ExpiryAlarmReceiver::class.java).apply {
                        putExtra("product_name", productName)
                        putExtra("lot", lot)
                        putExtra("expiry_date", expiryDate)
                    }
                    val requestCode = id.hashCode()
                    val pending = PendingIntent.getBroadcast(
                        this@MainActivity, requestCode, intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarmAt, pending)
                } catch (_: Exception) {
                }
            }
        }
    }

    private fun quote(value: String): String =
        "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
}
