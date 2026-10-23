package com.icapps.maintenpro

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.os.Bundle
import android.widget.FrameLayout
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import org.json.JSONObject
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.documentfile.provider.DocumentFile
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams

class MainActivity : AppCompatActivity(), PurchasesUpdatedListener {
    companion object {
        private const val PRODUCT_MONTHLY = "maintenpro_premium_monthly"
        private const val PREFS = "maintenpro"
        private val DRIVE_FOLDERS = listOf(
            "Datos", "Equipos", "Fotografias", "Codigos_QR",
            "Informes", "Copias_de_seguridad"
        )
    }

    private lateinit var webView: WebView
    private lateinit var billingClient: BillingClient
    private var monthlyProduct: ProductDetails? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingFileName = ""
    private var pendingFileBytes: ByteArray? = null
    private var playPurchaseToken: String? = null
    private lateinit var driveConnection: GoogleDriveConnection
    private val driveAuthorization = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
        if (::driveConnection.isInitialized) driveConnection.authorizationResult(result.data)
    }

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

    private val saveFilePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val name = pendingFileName
        val bytes = pendingFileBytes
        pendingFileName = ""
        pendingFileBytes = null
        val uri = if (result.resultCode == Activity.RESULT_OK) result.data?.data else null
        if (uri == null || bytes == null) {
            js("window.onMaintenProFileSaveError('Guardado cancelado')")
            return@registerForActivityResult
        }
        try {
            contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("No se pudo abrir el archivo")
            js("window.onMaintenProFileSaved(${quote(name)})")
        } catch (_: Exception) {
            js("window.onMaintenProFileSaveError('No se pudo escribir el archivo')")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        driveConnection = GoogleDriveConnection(this, { playPurchaseToken }, { driveAuthorization.launch(it) }, {
            js("window.onMaintenProDriveSessionChanged&&window.onMaintenProDriveSessionChanged()")
        })
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return true
                    return uri.scheme != "file" || uri.path?.startsWith("/android_asset/") != true
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    connectBilling()
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?
                ): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    val intent = params?.createIntent() ?: run { fileCallback = null; return false }
                    return try { filePicker.launch(intent); true } catch (_: Exception) { fileCallback = null; false }
                }
            }
            addJavascriptInterface(AndroidBridge(), "MaintenProAndroid")
            loadUrl("file:///android_asset/index.html")
        }
        // Keep every WebView control outside system bars and display cutouts,
        // including Android 15/16 where edge-to-edge is enforced.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val content = FrameLayout(this).apply {
            setBackgroundColor(0xFF0B1823.toInt())
            addView(webView, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
            ))
        }
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            insets
        }
        setContentView(content)
        WindowCompat.getInsetsController(window, content).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        ViewCompat.requestApplyInsets(content)
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
        if (!::billingClient.isInitialized) return
        if (billingClient.isReady) {
            loadBillingState()
            return
        }
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    loadBillingState()
                } else {
                    offerResult("")
                    subscriptionResult(false, "", "Suscripción necesaria para usar todas las funciones")
                }
            }

            override fun onBillingServiceDisconnected() {
                offerResult("")
                subscriptionResult(false, "", "No se pudo conectar con Google Play. Puedes revisar la app en modo limitado.")
            }
        })
    }

    private fun loadBillingState() {
        queryProduct()
        queryPurchases()
    }

    private fun queryProduct() {
        val product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT_MONTHLY)
            .setProductType(ProductType.SUBS)
            .build()
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(listOf(product))
            .build()

        billingClient.queryProductDetailsAsync(params) { _, productDetailsResult ->
            val details = productDetailsResult.productDetailsList.firstOrNull()
            monthlyProduct = details
            offerResult(displayPrice(details), hasFreeTrial(details))
        }
    }

    private fun queryPurchases() {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(ProductType.SUBS)
            .build()

        billingClient.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                playPurchaseToken = null
                subscriptionResult(false, displayPrice(monthlyProduct), "Suscripción necesaria para usar todas las funciones")
                return@queryPurchasesAsync
            }
            purchases.forEach { purchase ->
                if (purchase.products.contains(PRODUCT_MONTHLY) && purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                    acknowledge(purchase)
                }
            }
            playPurchaseToken = purchases.firstOrNull { purchase ->
                purchase.products.contains(PRODUCT_MONTHLY) && purchase.purchaseState == Purchase.PurchaseState.PURCHASED
            }?.purchaseToken
            val active = purchases.any { purchase ->
                purchase.products.contains(PRODUCT_MONTHLY) && purchase.purchaseState == Purchase.PurchaseState.PURCHASED
            }
            subscriptionResult(active, displayPrice(monthlyProduct), if (active) "Suscripción mensual activa" else "Suscripción necesaria para usar todas las funciones")
            driveConnection.refreshPurchase()
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                purchases.orEmpty().forEach { purchase ->
                    if (purchase.products.contains(PRODUCT_MONTHLY) && purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        acknowledge(purchase)
                    }
                }
                queryPurchases()
            }
            BillingClient.BillingResponseCode.USER_CANCELED ->
                subscriptionResult(false, displayPrice(monthlyProduct), "Compra cancelada. Puedes revisar la app en modo limitado.")
            else ->
                js("window.onMaintenProPurchaseError('No se pudo completar la compra en Google Play')")
        }
    }

    private fun acknowledge(purchase: Purchase) {
        if (purchase.isAcknowledged) return
        billingClient.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
        ) { queryPurchases() }
    }

    private fun launchSubscription() {
        connectBilling()
        val product = monthlyProduct ?: run {
            js("window.onMaintenProPurchaseError('Google Play todavía está cargando la suscripción. Inténtalo de nuevo.')")
            return
        }
        val offer = selectedOffer(product) ?: run {
                js("window.onMaintenProPurchaseError('No se encontró el plan mensual en Google Play')")
                return
            }
        val details = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(product)
            .setOfferToken(offer.offerToken)
            .build()
        billingClient.launchBillingFlow(
            this, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(details)).build()
        )
    }

    private fun selectedOffer(product: ProductDetails?) =
        product?.subscriptionOfferDetails?.firstOrNull { offer ->
            offer.pricingPhases.pricingPhaseList.any { it.priceAmountMicros == 0L }
        } ?: product?.subscriptionOfferDetails?.firstOrNull()

    private fun hasFreeTrial(product: ProductDetails?): Boolean =
        selectedOffer(product)?.pricingPhases?.pricingPhaseList?.any { it.priceAmountMicros == 0L } == true

    private fun displayPrice(product: ProductDetails?): String {
        val phases = selectedOffer(product)?.pricingPhases?.pricingPhaseList.orEmpty()
        return phases.lastOrNull { it.priceAmountMicros > 0L }?.formattedPrice
            ?: phases.lastOrNull()?.formattedPrice
            ?: ""
    }

    private fun offerResult(price: String, hasTrial: Boolean = false) =
        js("window.onMaintenProOffer(${quote(price)},$hasTrial)")

    private fun subscriptionResult(active: Boolean, price: String, message: String) =
        js("window.onMaintenProSubscription($active,${quote(price)},${quote(message)})")

    private fun js(code: String) = runOnUiThread {
        if (::webView.isInitialized && !isFinishing && !isDestroyed) webView.evaluateJavascript(code, null)
    }
    private fun quote(value: String): String {
        val builder = StringBuilder()
        builder.append(34.toChar())
        value.forEach { char ->
            when (char) {
                92.toChar() -> builder.append("\\\\")
                34.toChar() -> builder.append("\\\"")
                else -> builder.append(char)
            }
        }
        builder.append(34.toChar())
        return builder.toString()
    }

    inner class AndroidBridge {
        @JavascriptInterface fun connectSyncDrive() = runOnUiThread { driveConnection.connect() }
        @JavascriptInterface fun disconnectSyncDrive() = runOnUiThread { driveConnection.disconnect() }
        @JavascriptInterface fun requestSyncDrive(id: String, raw: String) {
            if (!id.matches(Regex("[A-Za-z0-9_-]{1,80}")) || raw.toByteArray().size > 21 * 1024 * 1024) return
            driveConnection.executor.execute {
                val reply = try { JSONObject().put("ok", true).put("result", driveConnection.request(JSONObject(raw))) }
                catch (error: Exception) {
                    val allowed = setOf("configuration-missing", "authorization-required", "purchase-required", "invalid-file", "too-many-devices", "invalid-operation", "invalid-document", "payload-too-large", "wrong-device-file", "quota-exceeded")
                    JSONObject().put("ok", false).put("error", if (error.message in allowed) error.message else "drive-unreachable")
                }
                js("window.onMaintenProDriveResponse&&window.onMaintenProDriveResponse(${JSONObject.quote(id)},$reply)")
            }
        }
        @JavascriptInterface fun openPrivacyPage(page: String) = runOnUiThread {
            val route = when (page) {
                "privacy" -> "/privacidad.html"
                "deletion" -> "/eliminar-datos.html"
                else -> return@runOnUiThread
            }
            try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.PUBLIC_SITE_URL + route))) }
            catch (_: Exception) { js("window.onMaintenProDriveError('No se pudo abrir el navegador.')") }
        }
        @JavascriptInterface fun openPcDownload() = runOnUiThread {
            val url = BuildConfig.PC_DOWNLOAD_URL
            if (url.startsWith("https://")) startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            else js("window.onMaintenProDriveError('La descarga para PC todavía no está publicada por el editor.')")
        }
        @JavascriptInterface fun checkSubscription() = runOnUiThread { connectBilling() }
        @JavascriptInterface fun subscribeMonthly() = runOnUiThread { launchSubscription() }
        @JavascriptInterface fun restorePurchases() = runOnUiThread { queryPurchases() }
        @JavascriptInterface fun chooseDriveFolder() = runOnUiThread { folderPicker.launch(null) }

        @JavascriptInterface fun saveFile(fileName: String, mimeType: String, encoded: String): Boolean {
            if (pendingFileBytes != null || encoded.length > 32_000_000) return false
            return try {
                val bytes = Base64.decode(encoded, Base64.DEFAULT)
                val safeName = fileName.substringAfterLast('/').substringAfterLast('\\').take(120).ifBlank { "MaintenPro_export" }
                pendingFileName = safeName
                pendingFileBytes = bytes
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType.ifBlank { "application/octet-stream" }
                    putExtra(Intent.EXTRA_TITLE, safeName)
                }
                runOnUiThread { saveFilePicker.launch(intent) }
                true
            } catch (_: Exception) {
                pendingFileName = ""
                pendingFileBytes = null
                false
            }
        }

        @JavascriptInterface fun manageSubscription() = runOnUiThread {
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
        if (::billingClient.isInitialized) connectBilling()
        if (::driveConnection.isInitialized) driveConnection.connect(false)
    }

    override fun onDestroy() {
        if (::billingClient.isInitialized) billingClient.endConnection()
        if (::driveConnection.isInitialized) driveConnection.close()
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("MaintenProAndroid")
            webView.destroy()
        }
        super.onDestroy()
    }
}
