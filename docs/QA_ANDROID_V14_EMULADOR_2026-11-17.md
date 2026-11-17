# QA verificable de MaintenPro v14 · Android 15 · 17/11/2026

## Resultado: REALIZADO Y VERIFICADO (instalación + smoke nativo)

- **Aplicación:** MaintenPro Android, `com.icapps.maintenpro`, versionName `1.2.9.2`, versionCode `14`.
- **Ejecución reproducible:** https://github.com/IsraelConti/ToolStock-Pro/actions/runs/44185927664
- **Resultado GitHub Actions:** `success` en todos los pasos del job `qa-android-35`.
- **Origen del APK instalado:** artefacto **MaintenPro-Uptodown-APK-signed** del build exitoso 44178118807, generado junto al AAB firmado aceptado por Play Console. No se recompiló ni cambió la versión de la app durante QA.
- **Entorno Android real emulado:** Android 15 / API 35, dispositivo `sdk_gphone64_x86_64`, CPU x86_64, aceleración KVM.
- **Instalación:** `adb install -r` → `Success`.
- **Paquete:** `dumpsys package` → `versionCode=14 minSdk=24 targetSdk=36`, `versionName=1.2.9.2`.
- **Permiso publicitario:** `com.google.android.gms.permission.AD_ID` presente en paquete instalado firmado.
- **Primer inicio:** `am start -W` → `Status: ok`, `LaunchState: COLD`, `MainActivity` iniciada (2310 ms reportados por Android, NO tiempo total para mostrar UI).
- **Segundo inicio tras `am force-stop`:** `Status: ok`, `MainActivity` iniciada (1706 ms reportados por Android).
- **Proceso de app vivo** tras ambos arranques; sin `FATAL EXCEPTION` de MaintenPro en logs capturados.
- **Captura revisada visualmente:** aparece la pantalla inicial de MaintenPro, texto `Prueba gratuita sin anuncios: 7 día(s) restante(s), equipos ilimitados`, navegación inferior Inicio/Equipos/Avería/Órdenes/Agenda, acceso Ayuda y botón +. No se ve banner en primer inicio ni en segundo inicio. Las capturas coinciden.
- **Evidencia:** artefacto de run `MaintenPro-v14-emulator-qa-evidence` (ID 14375121263), con capturas PNG, `ui-first.xml`, `ui-second.xml`, `logcat`, `package.txt`, resultados de arranque y resumen.

## Comprobaciones pendientes (NO declarar superadas)
- Alta/edición de equipos, averías, órdenes y agenda mediante acciones táctiles, persistencia de registros y QR.
- Paso controlado al día 8, banner real AdMob, consentimiento UMP EEE, límite de 15 equipos y bloqueo del 16.º, sin bloquear operaciones previas.
- Compra, cancelación, restauración y cobro en test de Google Play con tester autorizado (emulador de este workflow no inició sesión en Play).
- Sincronización Drive y versión PC con cuenta real; batería de pruebas manuales multisesión.
- Aprobación de AdMob / verificación app-ads.txt y declaraciones publicadas.
- No promocionar a producción hasta superar lo anterior.

## Código de pruebas reutilizable
- `.github/workflows/maintenpro-emulator-qa.yml`
- `qa/android-emulator-smoke.sh`

## Estado Play Console
- Código 14: disponible en **prueba interna**, un tester propietario habilitado.
- Producción aún en MaintenPro 1.2.9.1 / código 13.

**NOTA:** Este informe no afirma que los 7 días, el límite ni las compras hayan sido probados de extremo a extremo. Las dos capturas verifican el texto/UI y ausencia visible de banners durante el primer inicio, no la lógica de monetización después de siete días.


## Segundo pase: QA funcional instrumentada — RESULTADO PASS

- CI: https://github.com/IsraelConti/ToolStock-Pro/actions/runs/44188261523
- Job: `qa-freemium-android35`, GitHub Actions `conclusion=success`, instrumentación `OK (1 test)`, 18 segundos de prueba.
- Evidencia completa (seis capturas PNG y registros): artifact `MaintenPro-v14-functional-evidence`, ID `14374294675`.
- Compilación: paquete Android debug y APK de instrumentación AndroidJUnitRunner compilados sin errores en la rama de desarrollo. Corresponde a la lógica Android v14 con el **fix en código** del paywall incluido.
- Primeros 7 días sin anuncios: UI y estado `Prueba gratuita` comprobados.
- Alta de 15 equipos persistidos en `maintenpro.state.v3`: PASS.
- Inicio forzado de día 8 modificando solamente las preferencias del reloj local en el emulador: PASS (pantalla `Gratis permanente: 15/15 equipos`).
- Intento equipo 16 en modo Gratis: el contador continúa en 15, se muestra paywall Premium: PASS.
- Avería correctiva creada en modo Gratis y almacenada: PASS.
- Llamada de prueba a la interfaz web `window.onMaintenProSubscription(true)`: habilita alta del 16.º equipo; al volver a modo Gratis los 16 datos siguen almacenados: PASS. **No es una compra verdadera, ni valida pagos o licencias externas**.
- **Bug real encontrado** en primer pase 44187244696: la consulta de compras podía ocultar el paywall del equipo 16. Se corrigió `upgradePromptVisible` en `src/app.js`, commit `66cd2990c9a1a5a840e2fc0f61f429f02b08e9d3`, y se volvió a ejecutar el mismo test completo con éxito.
- Última doble instalación/reinicio del APK firmado ORIGINAL de v14 también volvió a pasar (job `qa-android-35`).

### Bloqueos de comercialización que siguen siendo reales

1. **AdMob**: se publicó `https://israelconti.github.io/app-ads.txt` y aparece el sitio correcto en Google Play. Se solicitó manualmente de nuevo «Buscar actualizaciones», pero AdMob respondió que todavía **no puede verificar la aplicación**. Depende del rastreo/revisión de Google; no afirmar anuncios reales ni ingresos.
2. **Billing**: falta compra/restauración/cancelación de prueba en Google Play con un dispositivo y cuenta habilitada. La instrumentación solo simula la UI Premium.
3. **Drive**: pruebas automáticas de contratos y sincronización en Node pasan, pero falta autenticación real en Google Drive y prueba de ida/vuelta con la instalación Windows.
4. **Play**: la versión **14 de pruebas internas** es el AAB subido ANTES de corregir el paywall. La corrección está verificada en GitHub y aún NO está en esa AAB interna: generar nueva versión código 15 o superior tras QA final y antes de distribuirla, sin reutilizar 14.
5. **Ads**: día 8 deja habilitado el estado «con anuncios», pero no se pudo verificar visualización e ingresos del banner de producción mientras AdMob rechaza el app-ads.
6. **Producción**: código 13 permanece publicado, y **no se ha enviado a producción** la monetización nueva.


## Tercer pase: versión 15 publicada en pruebas internas — 17/11/2026

**Esta sección actualiza el punto 4 del apartado anterior**, que ya no está pendiente.

- Fuente corregida: `src/app.js` con aviso Premium del equipo 16 persistente.
- Versión: **MaintenPro 1.2.9.3, versionCode 15**, mismo package `com.icapps.maintenpro`.
- GitHub Actions `44189262558`: `conclusion=success`, compilación, tests automáticos, generación de AAB y APK firmados; artefacto AAB `MaintenPro-AAB-signed` (ID `14374779705`).
- Archivo `MaintenPro-Play-signed.aab` extraído desde GitHub y cargado mediante Visor1 en Google Play Console. Play lo reconoció como `15 (1.2.9.3)` con min API 24 y target API 36.
- Canal **pruebas internas**: `Activo`, última versión `MaintenPro 1.2.9.3 - Freemium corregido`, estado oficial **Disponible para testers internos**.
- URL: https://play.google.com/console/u/0/developers/7335200555192928739/app/4974124882139009226/tracks/internal-testing
- Solo se mantiene la lista privada previa `MaintenPro prueba propietario`. No se amplió a testers externos.
- El aviso de Play Console `AD_ID` se ignoró **únicamente para esta entrega de pruebas**, ya que había un artefacto antiguo activo sin permiso; en v14 el permiso aparecía en el APK firmado instalado. **Antes de producción** comprobar también el manifest fusionado del AAB 15 y las declaraciones de Play.
- **Producción permanece en código 13 / 1.2.9.1**, no se promocionó el código 15 a usuarios públicos.

**Todavía pendiente y no atribuible a este pase automatizado:** verificación app-ads.txt en AdMob, banner real/consentimiento UMP de usuarios UE, prueba auténtica de compra/restauración/cancelación Google Play, y sincronización real de Google Drive entre Android y Windows.

### Nota técnica
El test funcional que aprobó el cambio de paywall se ejecutó con una compilación de depuración de la fuente corregida; Play Console contiene un AAB firmado generado de esa misma rama después del incremento a código 15. No afirmar todavía que el código 15 fue instalado desde Google Play por un usuario real y sometido a una compra de prueba.
