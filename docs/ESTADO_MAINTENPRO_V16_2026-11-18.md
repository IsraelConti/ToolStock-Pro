# MaintenPro — reparación y verificación de prueba Drive y facturación — 18/11/2026

## Estado real
- **Android**: 1.2.9.4, versionCode **16**, package `com.icapps.maintenpro`.
- **Fuente**: rama `feature/maintenpro-v13-freemium-7d`, repositorio `IsraelConti/ToolStock-Pro`.
- **CI firmado**: https://github.com/IsraelConti/ToolStock-Pro/actions/runs/44244101280, resultado **success**, `testDebugUnitTest`, `assembleDebug`, `assembleRelease`, `bundleRelease` y AAB/ APK firmados.
- **QA Android 15**: https://github.com/IsraelConti/ToolStock-Pro/actions/runs/44244589143, **success** en ambos jobs: instalación y dos arranques con APK firmado y batería instrumentada de 7d/15 equipos/16.º bloqueado/averías/conservación de datos. Esta instrumentación usa simulación de estado Premium: no prueba checkout real.
- **Google Play Console**: versión 16 AAB firmado aceptado y **disponible para testers internos** (18/11/2026 06:34, canal activo). La versión 15 queda inactiva. **Producción sigue en 1.2.9.1 código 13** (23/10/2026), intacta.
- **URL consola**: https://play.google.com/console/u/0/developers/7335200555192928739/app/4974124882139009226/tracks/internal-testing
- **Tester autorizado**: lista `MaintenPro prueba propietario` marcada como tester con licencia para Google Play; respuesta `RESPOND_NORMALLY`.

## Backend Drive — reparación realizada y publicada
- Floot original `MaintenPro Cloud Sync` / project ID `932e217f-d8a7-47fb-9d77-cb68a9754e9d`, publicado correctamente en https://maintenpro-icapps.floot.app (solo servidor web/licencias, NO app Android Floot).
- Tabla `maintenpro_trial_entitlements` por `google_sub` creada, con RLS, fechas del servidor e invariante vencimiento 7d. Reinstalar no reinicia fecha.
- `helpers/maintenProTrial.tsx` devuelve `trial` para identidad Google válida y no caducada; `helpers/googleDriveLicense.tsx` prioriza comprobación Premium auténtica cuando hay compra, y admite trial si no la hay; `endpoints/v1/session_POST.schema.ts` hace opcional el purchaseToken.
- `GoogleDriveConnection.kt` envía la petición Drive sin compra durante trial pero exige `serverValidated:true`, `accessType:trial|premium`, producto correcto, fecha real y token de Google; impide acceder tras caducar, incluso con caché. Compatible con minSdk24.
- Test SQL real de insert-on-conflict, caducidad y borrado de usuario de QA: PASS. Tests backend `helpers/maintenProTrial.spec.tsx` y `helpers/googlePlayEntitlement.spec.tsx`: PASS. Typecheck: limpio. API publicada: `GET /_api/v1/health` → 200 `configured:true`; accesos sin autenticación → 401.
- Test de verificador Billing (respuestas de Google API simuladas): activo, cancelado no vencido, caducado, cuenta distinta y compra 404: PASS. **Estos tests NO son una compra real de Google Play**.

## PENDIENTES imprescindibles
1. Instalar versión 16 desde Google Play con la cuenta habilitada `MaintenPro prueba propietario` en dispositivo Android Play firmado; realizar un checkout de **prueba** con opción de pago de prueba sin cargo real, verificar recibo, restauración, cancelación y status final del backend.
2. Conectar Google Drive realmente con identidad Google y verificar sincronización Android–Windows–Android durante trial, y denegación después de caducidad en servidor.
3. Verificar AdMob `app-ads.txt` y anuncios reales del día 8/consentimiento UMP; actualmente Google no había verificado la app.
4. Google Play advirtió `AD_ID` ausente en **un artefacto activo previo**, aunque el APK firmado v14 sí lo contenía. Se usó excepción del **canal interno** para continuar pruebas; antes de producción revisar artefactos activos y declaraciones Ads/Data Safety, confirmar permiso en AAB16.
5. No promocionar versión 16 a producción antes de superar pruebas reales.

## Conservación y seguridad
- Producto Premium existente `maintenpro_premium_monthly` y plan `mensual-499` siguen sin duplicarse ni cambiar precio 4,99 €/mes en España.
- Sin claves privadas, tokens de Google ni datos personales de usuarios en repositorios o mensajes. Los datos operativos se mantienen en Drive privado del comprador.
