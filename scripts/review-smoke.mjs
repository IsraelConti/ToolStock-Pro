import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("src/index.html", "utf8");
const app = readFileSync("src/app.js", "utf8");
const native = readFileSync("android/app/src/main/java/com/maintenpro/app/MainActivity.kt", "utf8");
const gradle = readFileSync("android/app/build.gradle.kts", "utf8");
const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const subscription = readFileSync("play-store/SUSCRIPCION.md", "utf8");

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML contiene IDs duplicados");

const idRefs = [...app.matchAll(/\$\("#([^"]+)"\)/g)].map((match) => match[1]);
const dynamicIds = new Set(["assistantCreateOrder", "assistantCreatePlan"]);
const missingIds = [...new Set(idRefs)].filter((id) => !ids.includes(id) && !dynamicIds.has(id));
assert.deepEqual(missingIds, [], "JavaScript referencia controles que no existen en el HTML");

const screens = new Set([...html.matchAll(/data-screen="([^"]+)"/g)].map((match) => match[1]));
const destinations = [...html.matchAll(/data-go="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual([...new Set(destinations.filter((name) => !screens.has(name)))], [], "Hay botones de navegación sin pantalla");

for (const match of html.matchAll(/<form[^>]*\bid="([^"]+)"/g)) {
  assert.ok(app.includes(`$("#${match[1]}").onsubmit=`), `El formulario ${match[1]} no tiene manejador`);
}

const bridgeMethods = [...new Set([...app.matchAll(/android\(\)\??\.([A-Za-z]\w*)/g)].map((match) => match[1]))];
const missingBridgeMethods = bridgeMethods.filter((name) => !new RegExp(`@JavascriptInterface\\s+fun\\s+${name}\\b`).test(native));
assert.deepEqual(missingBridgeMethods, [], "Falta implementar un método Android usado por la interfaz");

assert.ok(html.includes('id="dismissPaywall"') && app.includes('$("#dismissPaywall").onclick='), "Falta la salida visible del paywall");
assert.ok(html.includes('id="qrModal"') && app.includes('$("#qrModal").classList.remove("hidden")'), "El QR no tiene pantalla visible");
assert.ok(app.includes("data-complete-plan") && app.includes("function completePlan"), "Falta el cierre recurrente de preventivos");
assert.ok(app.includes('native.saveFile(') && native.includes("@JavascriptInterface fun saveFile"), "La exportación Android no llega al selector de guardado");
assert.ok(!/\bwindow\.open\s*\(/.test(app), "El QR no debe depender de ventanas emergentes");
assert.ok(gradle.includes("minSdk = 24"), "La versión nueva debe conservar Android 7/API 24 como mínimo");
assert.ok(manifest.includes('android:name="android.hardware.camera" android:required="false"'), "La cámara debe ser opcional para no excluir dispositivos sin cámara");
assert.ok(gradle.includes("versionCode = 11") && gradle.includes('versionName = "1.2.7"'), "Versión Android inesperada");
assert.ok(native.includes('PRODUCT_MONTHLY = "maintenpro_premium_monthly"') && subscription.includes("maintenpro_premium_monthly"), "El ID de suscripción no coincide");

console.log(`MaintenPro review smoke OK: ${ids.length} IDs, ${screens.size} pantallas y ${bridgeMethods.length} métodos Android.`);

assert.match(html, /alicateguideSearch/);
assert.match(html, /alicateguideResults/);
assert.match(html, /Sr. Alicate/);
assert.match(html, /mobile-alicate-help/);
assert.match(app, /const alicateGuide=/);
assert.match(app, /renderAlicateGuide/);
assert.ok(app.includes(String.raw`replace(/[\u0300-\u036f]/g,''`) && app.includes(String.raw`split(/\s+/)`), "La búsqueda de la guía debe normalizar acentos y separar palabras correctamente");
