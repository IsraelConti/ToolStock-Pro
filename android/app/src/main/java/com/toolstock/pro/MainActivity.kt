package com.toolstock.pro

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.DocumentsContract
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.barcode.common.Barcode

class MainActivity : AppCompatActivity() {
    companion object {
        private const val CLOSED_TESTING_ACCESS = true
    }

    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSaveBytes: ByteArray? = null
    private var pendingSaveName = ""

    private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        uri ?: return@registerForActivityResult
        try {
            contentResolver.takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            getSharedPreferences("toolstock", MODE_PRIVATE).edit()
                .putString("drive_tree_uri", uri.toString()).apply()
            val safeName = DocumentsContract.getTreeDocumentId(uri)
                .substringAfterLast(':').ifBlank { "Google Drive" }
            js("window.onToolStockDriveFolderSelected(" + quote(safeName) + ")")
        } catch (_: Exception) {
            js("window.onToolStockPurchaseError?.(" + quote("No se pudo conservar el permiso de la carpeta.") + ")")
        }
    }

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uris = if (result.resultCode == Activity.RESULT_OK) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        } else null
        fileCallback?.onReceiveValue(uris)
        fileCallback = null
    }

    private val saveFilePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val name = pendingSaveName
        val bytes = pendingSaveBytes
        val success = if (result.resultCode == Activity.RESULT_OK && result.data?.data != null && bytes != null) {
            try {
                contentResolver.openOutputStream(result.data!!.data!!)?.use { it.write(bytes) }
                true
            } catch (_: Exception) { false }
        } else false
        pendingSaveBytes = null
        pendingSaveName = ""
        js("window.onToolStockFileSaved?.(" + success + "," + quote(name) + ")")
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (CLOSED_TESTING_ACCESS) {
                        js("window.onToolStockSubscription?.(true,'','Acceso de prueba cerrada: no se realizará ningún cobro')")
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    callback: ValueCallback<Array<Uri>>?,
                    params: FileChooserParams?
                ): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    val intent = params?.createIntent() ?: return false
                    return try {
                        filePicker.launch(intent)
                        true
                    } catch (_: Exception) {
                        fileCallback = null
                        false
                    }
                }
            }
            addJavascriptInterface(AndroidBridge(), "ToolStockAndroid")
            loadUrl("file:///android_asset/index.html")
        }
        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "(function(){var b=document.getElementById('backBtn');if(b&&!b.classList.contains('hidden')){b.click();return 'handled'}return 'exit'})()"
                ) { result ->
                    if (result.contains("exit")) {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }

    private fun grantClosedTestingAccess(message: String = "Acceso de prueba cerrada: no se realizará ningún cobro") {
        js("window.onToolStockSubscription?.(true,''," + quote(message) + ")")
    }

    private fun scanCode() {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_QR_CODE, Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
                Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39, Barcode.FORMAT_UPC_A,
                Barcode.FORMAT_UPC_E, Barcode.FORMAT_DATA_MATRIX
            ).enableAutoZoom().build()
        GmsBarcodeScanning.getClient(this, options).startScan()
            .addOnSuccessListener { barcode ->
                js("window.onToolStockCodeScanned?.(" + quote(barcode.rawValue.orEmpty()) + ")")
            }
            .addOnFailureListener {
                js("window.onToolStockPurchaseError?.(" + quote("No se pudo abrir el escáner.") + ")")
            }
    }

    private fun js(code: String) = runOnUiThread { webView.evaluateJavascript(code, null) }

    private fun quote(value: String): String =
        "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

    inner class AndroidBridge {
        @JavascriptInterface fun appVersion(): String = "1.3.3-test"
        @JavascriptInterface fun chooseDriveFolder() = runOnUiThread { folderPicker.launch(null) }
        @JavascriptInterface fun scanCode() = runOnUiThread { this@MainActivity.scanCode() }
        @JavascriptInterface fun checkSubscription() = runOnUiThread { grantClosedTestingAccess() }
        @JavascriptInterface fun subscribeMonthly() = runOnUiThread {
            grantClosedTestingAccess("Durante la prueba cerrada no necesitas suscribirte ni pagar")
        }
        @JavascriptInterface fun restorePurchases() = runOnUiThread { grantClosedTestingAccess() }
        @JavascriptInterface fun manageSubscription() = runOnUiThread {
            grantClosedTestingAccess("Prueba cerrada activa: no hay ningún cobro que gestionar")
        }

        @JavascriptInterface
        fun saveBase64File(fileName: String, mimeType: String, base64: String) {
            val bytes = try { Base64.decode(base64, Base64.DEFAULT) } catch (_: Exception) {
                js("window.onToolStockFileSaved?.(false," + quote(fileName) + ")")
                return
            }
            runOnUiThread {
                if (pendingSaveBytes != null) return@runOnUiThread
                pendingSaveBytes = bytes
                pendingSaveName = fileName
                val safeName = fileName.take(120).replace(Regex("[\\\\/:*?\"<>|]"), "_")
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType.ifBlank { "application/octet-stream" }
                    putExtra(Intent.EXTRA_TITLE, safeName)
                }
                try { saveFilePicker.launch(intent) } catch (_: Exception) {
                    pendingSaveBytes = null
                    pendingSaveName = ""
                    js("window.onToolStockFileSaved?.(false," + quote(fileName) + ")")
                }
            }
        }
    }
}