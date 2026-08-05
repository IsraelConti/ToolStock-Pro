package com.momentsplanner.events

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

class MainActivity : AppCompatActivity(), PurchasesUpdatedListener {
    companion object {
        private const val PRODUCT_MONTHLY = "moments_planner_premium_monthly"
    }

    private lateinit var webView: WebView
    private lateinit var billingClient: BillingClient
    private var monthlyProduct: ProductDetails? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

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
                    if (BuildConfig.DEBUG) {
                        js("window.onMomentsOffer('4,99 €',true)")
                        subscriptionResult(true, "4,99 €", "Modo de prueba")
                    } else {
                        connectBilling()
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
            addJavascriptInterface(AndroidBridge(), "MomentsAndroid")
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
            if (monthlyProduct == null) loadProduct()
            querySubscription()
            return
        }
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    loadProduct()
                    querySubscription()
                } else {
                    subscriptionResult(false, "", "Google Play no está disponible")
                }
            }

            override fun onBillingServiceDisconnected() = Unit
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
                val offer = preferredMonthlyOffer(monthlyProduct)
                if (monthlyProduct == null || offer == null) {
                    js("window.onMomentsPurchaseError(" + quote("Activa en Play Console el plan mensual de 4,99 € y su oferta de prueba gratuita de 3 días.") + ")")
                } else {
                    val price = offer.pricingPhases.pricingPhaseList
                        .lastOrNull { it.priceAmountMicros > 0L }?.formattedPrice ?: "4,99 €"
                    val hasTrial = hasThreeDayTrial(offer)
                    js("window.onMomentsOffer(" + quote(price) + "," + hasTrial + ")")
                }
            } else {
                monthlyProduct = null
                js("window.onMomentsPurchaseError(" + quote("No se pudo consultar la suscripción en Google Play.") + ")")
            }
        }
    }

    private fun querySubscription() {
        if (BuildConfig.DEBUG) return subscriptionResult(true, "4,99 €", "Modo de prueba")
        billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        ) { result, purchases ->
            val active = result.responseCode == BillingClient.BillingResponseCode.OK &&
                purchases.any {
                    it.products.contains(PRODUCT_MONTHLY) &&
                        it.purchaseState == Purchase.PurchaseState.PURCHASED
                }
            subscriptionResult(active, "", if (active) "Suscripción activa" else "Suscripción mensual necesaria")
            purchases.filter { !it.isAcknowledged }.forEach(::acknowledge)
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            purchases.forEach(::acknowledge)
            querySubscription()
        } else if (result.responseCode != BillingClient.BillingResponseCode.USER_CANCELED) {
            js("window.onMomentsPurchaseError(" + quote(result.debugMessage) + ")")
        }
    }

    private fun acknowledge(purchase: Purchase) {
        if (purchase.isAcknowledged) return
        billingClient.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
        ) { querySubscription() }
    }

    private fun launchSubscription() {
        val product = monthlyProduct
        if (product == null) {
            loadProduct()
            js("window.onMomentsPurchaseError(" + quote("Espera un momento y vuelve a pulsar Suscribirme.") + ")")
            return
        }
        val offer = preferredMonthlyOffer(product)
        if (offer == null) {
            js("window.onMomentsPurchaseError(" + quote("El plan mensual y la oferta de prueba no están disponibles en Google Play.") + ")")
            return
        }
        val details = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(product)
            .setOfferToken(offer.offerToken)
            .build()
        val result = billingClient.launchBillingFlow(
            this,
            BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(details)).build()
        )
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            js("window.onMomentsPurchaseError(" + quote("No se pudo abrir el pago de Google Play: " + result.debugMessage) + ")")
        }
    }

    private fun hasThreeDayTrial(offer: ProductDetails.SubscriptionOfferDetails): Boolean =
        offer.pricingPhases.pricingPhaseList.any { phase ->
            phase.priceAmountMicros == 0L && phase.billingPeriod == "P3D"
        }

    private fun preferredMonthlyOffer(product: ProductDetails?): ProductDetails.SubscriptionOfferDetails? {
        val offers = product?.subscriptionOfferDetails.orEmpty()
        return offers.firstOrNull(::hasThreeDayTrial)
            ?: offers.firstOrNull { offer ->
                val phases = offer.pricingPhases.pricingPhaseList
                phases.isNotEmpty() && phases.none { phase -> phase.priceAmountMicros == 0L }
            }
            ?: offers.firstOrNull()
    }

    private fun subscriptionResult(active: Boolean, price: String, message: String) =
        js("window.onMomentsSubscription(" + active + "," + quote(price) + "," + quote(message) + ")")

    private fun js(code: String) = runOnUiThread { webView.evaluateJavascript(code, null) }

    private fun quote(value: String) =
        "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

    inner class AndroidBridge {
        @JavascriptInterface
        fun appVersion(): String = "1.1.0"

        @JavascriptInterface
        fun checkSubscription() = runOnUiThread { connectBilling() }

        @JavascriptInterface
        fun subscribeMonthly() = runOnUiThread {
            if (billingClient.isReady) launchSubscription() else connectBilling()
        }

        @JavascriptInterface
        fun restorePurchases() = runOnUiThread {
            if (billingClient.isReady) querySubscription() else connectBilling()
        }

        @JavascriptInterface
        fun manageSubscription() = runOnUiThread {
            val url = "https://play.google.com/store/account/subscriptions?sku=" +
                PRODUCT_MONTHLY + "&package=" + packageName
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
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
