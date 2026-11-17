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
