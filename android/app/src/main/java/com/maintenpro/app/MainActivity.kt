package com.icapps.maintenpro

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.documentfile.provider.DocumentFile
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener

class MainActivity : AppCompatActivity(), PurchasesUpdatedListener {
    companion object {
        private const val PRODUCT_MONTHLY = "maintenpro_premium_monthly"
        private const val PREFS = "maintenpro"
        private const val CLOSED_TESTING_ACCESS = true
        private val DRIVE_FOLDERS = listOf(
            "Datos", "Equipos", "Fotografias", "Documentos", "Codigos_QR",
            "Informes", "Copias_de_seguridad"
        )
    }

    private lateinit var webView: WebView
    private lateinit var billingClient: BillingClient
    private var monthlyProduct: ProductDetails? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri == null) {
            js("window.onMaintenProDriveError('No se seleccionó ninguna carpeta')")
            return@registerForActivityResult
        }
        try {
            contentResolver.takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            val root = DocumentFile.fromTreeUri(this, uri) ?: error("Carpeta no válida")
            val appFolder = root.findFile("MaintenPro") ?: root.createDirectory("MaintenPro")
                ?: error("No se pudo crear MaintenPro")
            DRIVE_FOLDERS.forEach { name ->
                if (appFolder.findFile(name) == null) appFolder.createDirectory(name)
            }
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("drive_tree_uri", uri.toString()).apply()
            js("window.onMaintenProDriveReady('MaintenPro')")
        } catch (_: Exception) {
            js("window.onMaintenProDriveError('No se pudieron crear las carpetas. Comprueba el permiso de Drive.')")
        }
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
            settings.allowContentAccess = true
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (CLOSED_TESTING_ACCESS || BuildConfig.DEBUG) {
                        js("window.onMaintenProSubscription(true,'','Acceso de prueba cerrada: no se realizará ningún cobro')")
                    } else {
                        connectBilling()
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?
                ): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    val intent = params?.createIntent() ?: return false
                    return try { filePicker.launch(intent); true } catch (_: Exception) { fileCallback = null; false }
                }
            }
            addJavascriptInterface(AndroidBridge(), "MaintenProAndroid")
            loadUrl("file:///android_asset/index.html")
        }
        setContentView(webView)
        billingClient = BillingClient.newBuilder(this)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "(function(){if(window.onAndroidBack&&window.onAndroidBack()){return 'handled'}return 'exit'})()"
                ) { result -> if (result.contains("exit")) { isEnabled = false; onBackPressedDispatcher.onBackPressed() } }
            }
        })
    }

    private fun connectBilling() {
        if (CLOSED_TESTING_ACCESS || BuildConfig.DEBUG) {
            return subscriptionResult(true, "", "Acceso de prueba cerrada: no se realizará ningún cobro")
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        if (CLOSED_TESTING_ACCESS) return
    }

    private fun acknowledge(purchase: Purchase) {
        if (CLOSED_TESTING_ACCESS || purchase.isAcknowledged) return
        billingClient.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
        ) { connectBilling() }
    }

    private fun launchSubscription() {
        if (CLOSED_TESTING_ACCESS) {
            subscriptionResult(true, "", "Acceso de prueba cerrada: no necesitas suscribirte")
            return
        }
        val product = monthlyProduct ?: return
        val offer = product.subscriptionOfferDetails?.firstOrNull() ?: return
        val details = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(product)
            .setOfferToken(offer.offerToken)
            .build()
        billingClient.launchBillingFlow(
            this, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(details)).build()
        )
    }

    private fun subscriptionResult(active: Boolean, price: String, message: String) =
        js("window.onMaintenProSubscription($active,${quote(price)},${quote(message)})")

    private fun js(code: String) = runOnUiThread { webView.evaluateJavascript(code, null) }
    private fun quote(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

    inner class AndroidBridge {
        @JavascriptInterface fun checkSubscription() = runOnUiThread { connectBilling() }
        @JavascriptInterface fun subscribeMonthly() = runOnUiThread { launchSubscription() }
        @JavascriptInterface fun restorePurchases() = runOnUiThread { connectBilling() }
        @JavascriptInterface fun chooseDriveFolder() = runOnUiThread { folderPicker.launch(null) }

        @JavascriptInterface fun manageSubscription() = runOnUiThread {
            if (CLOSED_TESTING_ACCESS) {
                subscriptionResult(true, "", "Acceso de prueba cerrada activo")
                return@runOnUiThread
            }
            val url = "https://play.google.com/store/account/subscriptions?sku=$PRODUCT_MONTHLY&package=$packageName"
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }

        @JavascriptInterface fun saveBackup(fileName: String, content: String): Boolean {
            return try {
                val uriText = getSharedPreferences(PREFS, MODE_PRIVATE).getString("drive_tree_uri", null) ?: return false
                val root = DocumentFile.fromTreeUri(this@MainActivity, Uri.parse(uriText)) ?: return false
                val app = root.findFile("MaintenPro") ?: return false
                val backups = app.findFile("Copias_de_seguridad") ?: app.createDirectory("Copias_de_seguridad") ?: return false
                backups.findFile(fileName)?.delete()
                val file = backups.createFile("application/json", fileName) ?: return false
                contentResolver.openOutputStream(file.uri)?.use { it.write(content.toByteArray()) } ?: return false
                true
            } catch (_: Exception) { false }
        }
    }

    override fun onResume() {
        super.onResume()
        if (::billingClient.isInitialized && !CLOSED_TESTING_ACCESS && !BuildConfig.DEBUG) connectBilling()
    }

    override fun onDestroy() {
        if (::billingClient.isInitialized) billingClient.endConnection()
        super.onDestroy()
    }
}