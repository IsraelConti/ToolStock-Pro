package com.toolstock.pro

import android.content.pm.ActivityInfo
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONTokener
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@RunWith(AndroidJUnit4::class)
class ToolStockSmokeTest {
    private lateinit var scenario: ActivityScenario<MainActivity>

    private fun js(code: String): Any? {
        val result = AtomicReference<String>()
        val done = CountDownLatch(1)
        scenario.onActivity { activity ->
            val content = activity.findViewById<ViewGroup>(android.R.id.content)
            val web = content.getChildAt(0) as WebView
            web.evaluateJavascript("(function(){ $code })()") { value ->
                result.set(value)
                done.countDown()
            }
        }
        assertTrue("WebView did not respond", done.await(20, TimeUnit.SECONDS))
        return JSONTokener(result.get() ?: "null").nextValue()
    }

    private fun waitFor(condition: String) {
        val end = System.currentTimeMillis() + 30000
        while (System.currentTimeMillis() < end) {
            if (js("return !!($condition);") == true) return
            Thread.sleep(200)
        }
        fail("Condition not reached in installed WebView: $condition")
    }

    @Before fun startClean() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
        waitFor("document.getElementById('startDemo')")
        js("window.__testReload=true; localStorage.clear(); location.href='file:///android_asset/index.html'; return true;")
        waitFor("document.getElementById('startDemo') && !window.__testReload")
    }

    @After fun finish() { scenario.close() }

    @Test fun ownerEmailIsOptional() {
        js("document.getElementById('continueAsGuest').click(); return true;")
        assertEquals(false, js("return document.body.classList.contains('owner-registration-required');"))
    }

    @Test fun demoCreatesEditsAndRestoresStockWithoutPayment() {
        js("document.getElementById('startDemo').click(); return true;")
        waitFor("document.getElementById('exitDemo')")
        js("""
            document.querySelector('.bottom-nav [data-go="productForm"]').click();
            var f=document.getElementById('productForm');
            f.elements.name.value='Android test part'; f.elements.reference.value='ANDROID-01';
            f.elements.stock.value='10'; f.elements.manufacturer.value='Test';
            f.querySelector('button[type=submit]').click(); return true;
        """.trimIndent())
        assertEquals(10, js("return JSON.parse(localStorage.getItem('demo.toolstock.products.v1')).find(function(p){return p.reference==='ANDROID-01'}).stock;"))
        js("""
            var p=JSON.parse(localStorage.getItem('demo.toolstock.products.v1')).find(function(p){return p.reference==='ANDROID-01'});
            document.querySelector('.bottom-nav [data-go="movements"]').click();
            var f=document.getElementById('movementForm'); f.elements.productId.value=p.id;
            f.elements.type.value='entry'; f.elements.quantity.value='3';
            f.elements.responsible.value='Android test';f.elements.destination.value='Demo workshop';
            f.querySelector('button[type=submit]').click(); return true;
        """.trimIndent())
        assertEquals(13, js("return JSON.parse(localStorage.getItem('demo.toolstock.products.v1')).find(function(p){return p.reference==='ANDROID-01'}).stock;"))
        assertEquals(1, js("return JSON.parse(localStorage.getItem('demo.toolstock.movements.v1')).length;"))
        assertEquals(true, js("return localStorage.getItem('toolstock.products.v1')===null;"))
        js("window.onToolStockSubscription(false,'','No subscription'); return true;")
        assertEquals(false, js("return document.body.classList.contains('subscription-locked');"))
        js("window.__testReload=true; location.reload();return true;")
        waitFor("document.getElementById('exitDemo') && !window.__testReload")
        assertEquals(13, js("return JSON.parse(localStorage.getItem('demo.toolstock.products.v1')).find(function(p){return p.reference==='ANDROID-01'}).stock;"))
    }

    @Test fun nativeBackAndRotationKeepTheFormUsable() {
        js("document.getElementById('startDemo').click();return true;")
        waitFor("document.getElementById('exitDemo')")
        js("""document.querySelector('.bottom-nav [data-go="productForm"]').click();document.querySelector('#productForm [name=name]').value='Unsaved Android field';return true;""")
        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
        Thread.sleep(1000)
        assertEquals("Unsaved Android field", js("return document.querySelector('#productForm [name=name]').value;"))
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
        waitFor("document.querySelector('.screen.active').getAttribute('data-screen')==='home'")
        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
    }

    @Test fun nativeExportOpensTheFilePickerAndHandlesCancellation() {
        js("document.getElementById('startDemo').click();return true;")
        waitFor("document.getElementById('exitDemo')")
        js("""document.querySelector('[data-go="import"]').click();document.getElementById('downloadTemplate').click();return true;""")
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val end = System.currentTimeMillis() + 20000
        while (System.currentTimeMillis() < end && device.currentPackageName == "com.toolstock.pro") Thread.sleep(200)
        assertTrue("Android document picker did not open", device.currentPackageName?.contains("documentsui") == true)
        // The first Back can dismiss the filename keyboard; cancel the picker itself.
        repeat(3) {
            if (device.currentPackageName?.contains("documentsui") == true) {
                device.pressBack()
                device.waitForIdle(1000)
                Thread.sleep(400)
            }
        }
        assertEquals("Picker did not return to ToolStock", "com.toolstock.pro", device.currentPackageName)
        waitFor("document.getElementById('toast').textContent.indexOf('No se guardó')>=0")
        assertEquals(true, js("return !!document.getElementById('exitDemo');"))
    }
}
