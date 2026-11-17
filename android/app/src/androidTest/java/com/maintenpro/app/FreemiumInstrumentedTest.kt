package com.icapps.maintenpro

import android.content.Context
import android.graphics.Bitmap
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Integration test of the actual MaintenPro WebView and Android trial timer.
 * Google Billing PURCHASE/Drive auth/AdMob live ad delivery are NOT emulated here.
 */
@RunWith(AndroidJUnit4::class)
class FreemiumInstrumentedTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val target = instrumentation.targetContext
    private val day = 86_400_000L

    private fun eval(scenario: ActivityScenario<MainActivity>, script: String): String {
        val latch = CountDownLatch(1)
        var result = ""
        scenario.onActivity { activity ->
            val field = MainActivity::class.java.getDeclaredField("webView")
            field.isAccessible = true
            (field.get(activity) as WebView).evaluateJavascript(script) {
                result = it ?: ""
                latch.countDown()
            }
        }
        assertTrue("WebView JS timeout for: ${script.take(90)}", latch.await(20, TimeUnit.SECONDS))
        return result
    }

    private fun eventually(scenario: ActivityScenario<MainActivity>, description: String, expected: (String) -> Boolean, js: String): String {
        var value = ""
        repeat(70) {
            value = eval(scenario, js)
            if (expected(value)) return value
            Thread.sleep(250)
        }
        fail("Timeout: $description, received=$value")
        return value
    }

    private fun count(scenario: ActivityScenario<MainActivity>, type: String): Int {
        val raw = eval(scenario, "(JSON.parse(localStorage.getItem('maintenpro.state.v3') || '{}').$type || []).filter(x=>!x.deletedAt).length")
        return raw.toIntOrNull() ?: 0
    }

    private fun createEquipment(scenario: ActivityScenario<MainActivity>, number: Int) {
        val prev = count(scenario, "equipment")
        val code = "QA-${number.toString().padStart(3, '0')}"
        eval(scenario, """
          (() => { 
            window.MaintenProNavigate('equipmentForm');
            const f=document.getElementById('equipmentForm');
            f.elements.namedItem('name').value='Equipo integración $number';
            f.elements.namedItem('code').value='$code';
            f.requestSubmit();
            return 'submitted';
          })()
        """.trimIndent())
        eventually(scenario,"Alta del equipo $number", { it == (prev + 1).toString() },
            "(JSON.parse(localStorage.getItem('maintenpro.state.v3')||'{}').equipment||[]).filter(x=>!x.deletedAt).length")
    }

    private fun capture(label: String) {
        val screenshot: Bitmap? = instrumentation.uiAutomation.takeScreenshot()
        if (screenshot != null) {
            val dir = File(target.getExternalFilesDir(null), "qa-evidence")
            dir.mkdirs()
            FileOutputStream(File(dir, "$label.png")).use { screenshot.compress(Bitmap.CompressFormat.PNG, 100, it) }
            screenshot.recycle()
        }
    }

    @Test
    fun day7ToDay8FreeLimitOrdersAndPremiumUi() {
        val prefs = target.getSharedPreferences("maintenpro", Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        prefs.edit().clear().putLong("trial_start_millis", now)
            .putLong("trial_last_seen_millis", now).commit()

        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            eventually(scenario, "Trial visible al abrir", { it.contains("Prueba gratuita") },
                "document.getElementById('freeTierStatus')?.textContent || ''")
            capture("01-trial-sin-anuncios")
            assertEquals(8, eval(scenario, "(function(){return document.getElementById('freeTierStatus').textContent.includes('7 día(s)')?8:0})()").toIntOrNull() ?: 0)

            for(i in 1..15) createEquipment(scenario,i)
            assertEquals(15,count(scenario,"equipment"))
            capture("02-15-equipos-guardados")
            println("QA_TRIAL_15_EQUIPOS_OK")
        }

        // The emulator never charges a customer. This forces the *local* trial clock only.
        val shifted = System.currentTimeMillis() - 9L * day
        prefs.edit().putLong("trial_start_millis", shifted)
            .putLong("trial_last_seen_millis", System.currentTimeMillis()).commit()

        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            eventually(scenario, "Modo gratuito día 8", { it.contains("Gratis permanente") },
                "document.getElementById('freeTierStatus')?.textContent || ''")
            assertEquals(15, count(scenario,"equipment"))
            val notice = eval(scenario, "document.getElementById('freeTierStatus').textContent")
            assertTrue("Debe mostrar 15/15 en plan gratis: $notice",notice.contains("15/15"))
            capture("03-dia8-15-de-15-con-anuncios")
            println("QA_DAY8_15_15_OK")

            eval(scenario, """
              (() => {
                window.MaintenProNavigate('equipmentForm');
                const f=document.getElementById('equipmentForm');
                f.elements.namedItem('name').value='Equipo rechazado número 16';
                f.elements.namedItem('code').value='QA-016';
                f.requestSubmit();return 'submitted';
              })()
            """.trimIndent())
            Thread.sleep(900)
            assertEquals("El equipo 16 NO debe guardarse en Gratis",15,count(scenario,"equipment"))
            assertEquals("false",eval(scenario,"document.getElementById('paywall').classList.contains('hidden')"))
            capture("04-equipo16-bloqueado")
            println("QA_LIMIT_16_BLOCKED_OK")

            val id = eval(scenario,"(JSON.parse(localStorage.getItem('maintenpro.state.v3')).equipment||[])[0].id").trim('"')
            eval(scenario, """
              (()=> {
                window.MaintenProNavigate('workForm');
                const f=document.getElementById('workForm');
                f.elements.namedItem('equipmentId').value='$id';
                f.elements.namedItem('description').value='Avería QA en modo Gratis';
                f.requestSubmit();return 'submitted';
              })()
            """.trimIndent())
            eventually(scenario,"Orden correctiva gratuita", { it=="1" },
                "(JSON.parse(localStorage.getItem('maintenpro.state.v3')||'{}').orders||[]).filter(x=>!x.deletedAt).length")
            capture("05-averia-creada-modo-gratis")
            println("QA_FREE_WORK_ORDER_OK")
            // Only tests UI handler: DOES NOT verify actual Google Play Billing.
            eval(scenario, "window.onMaintenProSubscription(true,'4,99 €','Prueba simulada de vista Pro');")
            eventually(scenario,"Vista Premium de prueba",{it.contains("Pro activa")},
              "document.getElementById('freeTierStatus')?.textContent || ''")
            createEquipment(scenario,16)
            assertEquals(16,count(scenario,"equipment"))
            eval(scenario,"window.onMaintenProSubscription(false,'','Simulación de caducidad');")
            eventually(scenario,"Volver gratis tras vista Premium",{it.contains("16/15")},
              "document.getElementById('freeTierStatus')?.textContent || ''")
            assertEquals("Los 16 equipos se conservan tras volver gratis",16,count(scenario,"equipment"))
            capture("06-premium-ui-y-datos-conservados")
            println("QA_PREMIUM_UI_SIMULATION_AND_DATA_RETENTION_OK")
        }
    }
}
