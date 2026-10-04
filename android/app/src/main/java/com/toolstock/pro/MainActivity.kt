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
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.barcode.common.Barcode

class MainActivity : AppCompatActivity(), PurchasesUpdatedListener {
    companion object {
        private const val PRODUCT_MONTHLY = "toolstock_pro_premium_monthly"
    }

    private lateinit var webView: WebView
    private lateinit var billingClient: BillingClient
    private var monthlyProduct: ProductDetails? = null
    private var connecting = false
    private val acknowledging = mutableSetOf<String>()
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
            js("window.onToolStockPurchaseError(" + quote("No se pudo conservar el permiso de la carpeta.") + ")")
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
                    if (BuildConfig.DEBUG) {
                        js("window.onToolStockOffer?.('4,99 €',true)")
                        subscriptionResult(true, "4,99 €", "Modo de prueba")
                    } else connectBilling()
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

        billingClient = BillingClient.newBuilder(this)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build()

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

    private fun connectBilling() {
        if (BuildConfig.DEBUG) return subscriptionResult(true, "4,99 €", "Modo de prueba")
        if (billingClient.isReady) {
            loadProduct()
            querySubscription()
            return
        }
        if (connecting) return
        connecting = true
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                connecting = false
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    loadProduct()
                    querySubscription()
                } else subscriptionResult(false, "", "Google Play no está disponible")
            }
            override fun onBillingServiceDisconnected() { connecting = false }
        })
    }

    private fun loadProduct() {
        val product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT_MONTHLY)
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        billingClient.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(listOf(product)).build()
        ) { result, productResult ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                monthlyProduct = productResult.productDetailsList.firstOrNull()
                val offer = preferredOffer(monthlyProduct)
                if (monthlyProduct == null || offer == null) {
                    js("window.onToolStockPurchaseError?.(" + quote("La suscripción mensual no está disponible para esta cuenta. Inténtalo más tarde.") + ")")
                } else {
                    val price = offer.pricingPhases.pricingPhaseList
                        .lastOrNull { it.priceAmountMicros > 0L }?.formattedPrice ?: "4,99 €"
                    val conditions = offer.pricingPhases.pricingPhaseList.joinToString("; después, ") { phase ->
                        if (phase.priceAmountMicros == 0L) "Prueba gratuita durante " + phase.billingPeriod
                        else phase.formattedPrice + " por " + phase.billingPeriod
                    }
                    js("window.onToolStockOffer?.(" + quote(price) + "," + hasTrial(offer) + "," + quote(conditions) + ")")
                }
            } else {
                monthlyProduct = null
                js("window.onToolStockPurchaseError?.(" + quote("No se pudo consultar la suscripción.") + ")")
            }
        }
    }

    private fun querySubscription() {
        if (BuildConfig.DEBUG) return subscriptionResult(true, "4,99 €", "Modo de prueba")
        billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        ) { result, purchases ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                js("window.onToolStockPurchaseError?.(" + quote("No se pudo comprobar la compra. Revisa tu conexión y pulsa Restaurar.") + ")")
                return@queryPurchasesAsync
            }
            val relevant = purchases.filter { it.products.contains(PRODUCT_MONTHLY) }
            val active = relevant.any { it.purchaseState == Purchase.PurchaseState.PURCHASED }
            val pending = relevant.any { it.purchaseState == Purchase.PurchaseState.PENDING }
            subscriptionResult(active, "", when {
                active -> "Suscripción activa"
                pending -> "Pago pendiente: Google Play todavía no ha confirmado la compra"
                else -> "Sin suscripción activa"
            })
            relevant.forEach(::acknowledge)
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            purchases.forEach(::acknowledge)
            querySubscription()
        } else if (result.responseCode != BillingClient.BillingResponseCode.USER_CANCELED) {
            js("window.onToolStockPurchaseError?.(" + quote(result.debugMessage) + ")")
        }
    }

    private fun acknowledge(purchase: Purchase) {
        if (!purchase.products.contains(PRODUCT_MONTHLY) ||
            purchase.purchaseState != Purchase.PurchaseState.PURCHASED ||
            purchase.isAcknowledged || !acknowledging.add(purchase.purchaseToken)) return
        billingClient.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
        ) { result ->
            acknowledging.remove(purchase.purchaseToken)
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                js("window.onToolStockPurchaseError?.(" + quote("No se pudo confirmar la compra. Pulsa Restaurar para reintentar.") + ")")
            }
        }
    }

    private fun launchSubscription() {
        val product = monthlyProduct
        val offer = preferredOffer(product)
        if (product == null || offer == null) {
            loadProduct()
            js("window.onToolStockPurchaseError?.(" + quote("Espera un momento y vuelve a pulsar Suscribirme.") + ")")
            return
        }
        val details = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(product).setOfferToken(offer.offerToken).build()
        val result = billingClient.launchBillingFlow(
            this, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(details)).build()
        )
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            js("window.onToolStockPurchaseError?.(" + quote("No se pudo abrir el pago: " + result.debugMessage) + ")")
        }
    }

    private fun hasTrial(offer: ProductDetails.SubscriptionOfferDetails): Boolean =
        offer.pricingPhases.pricingPhaseList.any {
            it.priceAmountMicros == 0L
        }

    private fun preferredOffer(product: ProductDetails?): ProductDetails.SubscriptionOfferDetails? {
        val offers = product?.subscriptionOfferDetails.orEmpty().filter { offer ->
            offer.pricingPhases.pricingPhaseList.lastOrNull()?.let {
                it.billingPeriod == "P1M" && it.recurrenceMode == ProductDetails.RecurrenceMode.INFINITE_RECURRING
            } == true
        }
        return offers.firstOrNull(::hasTrial)
            ?: offers.firstOrNull { o -> o.pricingPhases.pricingPhaseList.none { it.priceAmountMicros == 0L } }
            ?: offers.firstOrNull()
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

    private fun subscriptionResult(active: Boolean, price: String, message: String) =
        js("window.onToolStockSubscription?.(" + active + "," + quote(price) + "," + quote(message) + ")")

    private fun js(code: String) = runOnUiThread { webView.evaluateJavascript(code, null) }

    private fun quote(value: String): String =
        org.json.JSONObject.quote(value)

    inner class AndroidBridge {
        @JavascriptInterface fun appVersion(): String = BuildConfig.VERSION_NAME
        @JavascriptInterface fun chooseDriveFolder() = runOnUiThread { folderPicker.launch(null) }
        @JavascriptInterface fun scanCode() = runOnUiThread { this@MainActivity.scanCode() }
        @JavascriptInterface fun checkSubscription() = runOnUiThread { connectBilling() }
        @JavascriptInterface fun subscribeMonthly() = runOnUiThread {
            if (billingClient.isReady) launchSubscription() else connectBilling()
        }
        @JavascriptInterface fun restorePurchases() = runOnUiThread {
            if (billingClient.isReady) querySubscription() else connectBilling()
        }
        @JavascriptInterface fun manageSubscription() = runOnUiThread {
            val url = "https://play.google.com/store/account/subscriptions?sku=" +
                PRODUCT_MONTHLY + "&package=" + packageName
            try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {
                js("window.onToolStockPurchaseError?.(" + quote("No se pudo abrir Google Play.") + ")")
            }
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

    override fun onResume() {
        super.onResume()
        if (::billingClient.isInitialized && !BuildConfig.DEBUG) connectBilling()
    }

    override fun onDestroy() {
        if (::billingClient.isInitialized) billingClient.endConnection()
        super.onDestroy()
    }
}
