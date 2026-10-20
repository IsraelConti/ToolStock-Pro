package com.icapps.maintenpro

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.nio.ByteBuffer
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
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
                    offerResult("El precio y la moneda se mostrarán en Google Play")
                    subscriptionResult(false, "El precio y la moneda se mostrarán en Google Play", "Suscripción necesaria para usar todas las funciones")
                }
            }

            override fun onBillingServiceDisconnected() {
                subscriptionResult(false, "El precio y la moneda se mostrarán en Google Play", "No se pudo conectar con Google Play. Puedes revisar la app en modo limitado.")
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
                subscriptionResult(false, displayPrice(monthlyProduct), "Suscripción necesaria para usar todas las funciones")
                return@queryPurchasesAsync
            }
            purchases.forEach { purchase ->
                if (purchase.products.contains(PRODUCT_MONTHLY) && purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                    acknowledge(purchase)
                }
            }
            val active = purchases.any { purchase ->
                purchase.products.contains(PRODUCT_MONTHLY) && purchase.purchaseState == Purchase.PurchaseState.PURCHASED
            }
            subscriptionResult(active, displayPrice(monthlyProduct), if (active) "Suscripción mensual activa" else "Suscripción necesaria para usar todas las funciones")
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
            ?: "El precio y la moneda se mostrarán en Google Play"
    }

    private fun offerResult(price: String, hasTrial: Boolean = false) =
        js("window.onMaintenProOffer(${quote(price)},$hasTrial)")

    private fun subscriptionResult(active: Boolean, price: String, message: String) =
        js("window.onMaintenProSubscription($active,${quote(price)},${quote(message)})")

    private fun js(code: String) = runOnUiThread { webView.evaluateJavascript(code, null) }
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

    private fun syncTokenKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val alias = "MaintenProSyncTokenKey"
        val existing = store.getKey(alias, null) as? SecretKey
        if (existing != null) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build())
        return generator.generateKey()
    }

    private fun readSyncToken(): String {
        val encoded = getSharedPreferences(PREFS, MODE_PRIVATE).getString("sync_token_enc", null) ?: return ""
        return try {
            val bytes = Base64.decode(encoded, Base64.NO_WRAP)
            if (bytes.size < 13) return ""
            val buffer = ByteBuffer.wrap(bytes)
            val iv = ByteArray(12).also(buffer::get)
            val ciphertext = ByteArray(buffer.remaining()).also(buffer::get)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, syncTokenKey(), GCMParameterSpec(128, iv))
            String(cipher.doFinal(ciphertext), Charsets.UTF_8)
        } catch (_: Exception) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove("sync_token_enc").apply()
            ""
        }
    }

    private fun writeSyncToken(value: String): Boolean {
        if (value.length > 4096) return false
        return try {
            if (value.isBlank()) {
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove("sync_token_enc").apply()
                return true
            }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, syncTokenKey())
            val bytes = ByteBuffer.allocate(12 + cipher.getOutputSize(value.toByteArray(Charsets.UTF_8).size))
                .put(cipher.iv)
                .put(cipher.doFinal(value.toByteArray(Charsets.UTF_8)))
                .array()
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString("sync_token_enc", Base64.encodeToString(bytes, Base64.NO_WRAP))
                .commit()
        } catch (_: Exception) {
            false
        }
    }

    private fun emitSubscriptionPurchaseToken() {
        if (!::billingClient.isInitialized || !billingClient.isReady) {
            js("window.onMaintenProPurchaseToken(\"\")")
            return
        }
        val params = QueryPurchasesParams.newBuilder().setProductType(ProductType.SUBS).build()
        billingClient.queryPurchasesAsync(params) { result, purchases ->
            val token = if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                purchases.firstOrNull {
                    it.products.contains(PRODUCT_MONTHLY) &&
                        it.purchaseState == Purchase.PurchaseState.PURCHASED
                }?.purchaseToken.orEmpty()
            } else ""
            js("window.onMaintenProPurchaseToken(${quote(token)})")
        }
    }

    inner class AndroidBridge {
        @JavascriptInterface fun getSyncToken(): String = readSyncToken()
        @JavascriptInterface fun setSyncToken(token: String): Boolean = writeSyncToken(token)
        @JavascriptInterface fun clearSyncToken(): Boolean = writeSyncToken("")
        @JavascriptInterface fun requestSubscriptionPurchaseToken() = runOnUiThread { emitSubscriptionPurchaseToken() }
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
    }

    override fun onDestroy() {
        if (::billingClient.isInitialized) billingClient.endConnection()
        super.onDestroy()
    }
}