# MaintenPro 1.2.9.2 · Estado del freemium · 17-11-2026

## Ficha técnica
- Android: `com.icapps.maintenpro` 1.2.9.2 (`versionCode=14`), objetivo API 36, mínimo API 24.
- Base preservada: MaintenPro 1.2.9.1 (13), Git commit `17c4009f992b272981b1d104dc6e030a3a95914e`.
- Repositorio: IsraelConti/ToolStock-Pro; rama: feature/maintenpro-v13-freemium-7d. No modificar main de ToolStock.
- Windows: mantiene licencia Premium existente; sincronización con Google Drive conservada en código.
- Suscripción existente: `maintenpro_premium_monthly`, plan base `mensual-499`, 4,99 €/mes España. No crear otro producto.

## Condiciones aprobadas
1. 7 días completos desde la primera apertura Android: equipos ilimitados, sin anuncios, sin tarjeta y sin activación automática de suscripción.
2. Día 8 en adelante: gratis para siempre con anuncios y hasta 15 equipos activos; operaciones, averías, preventivos e históricos sobre ellos se conservan.
3. Premium opcional: sin publicidad, ilimitado, incluye versión PC. No borrar datos si se cancela.

## REALIZADO Y VERIFICADO
- AdMob registrado y aplicación MaintenPro de Google Play asociada. App ID `ca-app-pub-2591134184963379~6094043049`; unidad de banner `ca-app-pub-2591134184963379/6612917799` (`MaintenPro_Banner_Gratis_Dia8`).
- Archivo `app-ads.txt` correcto en `https://israelconti.github.io/app-ads.txt` en repo IsraelConti/IsraelConti.github.io.
- Sitio web del desarrollador `https://israelconti.github.io` publicado en Play Console (cambio confirmado).
- Política pública `https://israelconti.github.io/privacidad.html` actualizada con publicidad/consentimiento y verificada accesible.
- Cuenta de pagos AdMob configurada en su panel, pendiente la validación editorial publicitaria.
- GitHub Actions build 44178118807, commit 08a1c70ff981e313aaaa88ae00759d345d0c575d: npm test y Android unit tests, APK debug, release AAB+APK firmados, todos éxito.
- AAB firmado (`MaintenPro-Play-signed.aab`) aceptado por Play Console como versión 14, 1.2.9.2.
- Declaración «Contiene anuncios» y declaración ID de publicidad («Sí; publicidad/marketing») guardadas en Play Console, pendientes de revisión/publicación coordinada.
- Prueba interna ACTIVADA en Google Play el 17-11-2026, con versión 14 «Disponible para testers internos»; SOLO lista preexistente «MaintenPro prueba propietario» (1 tester). URL: `https://play.google.com/console/u/0/developers/7335200555192928739/app/4974124882139009226/tracks/internal-testing`.
- Producción permanece en MaintenPro 1.2.9.1 código 13, sin cambios de artefacto.

## PENDIENTE / RIESGOS
1. Verificación app-ads.txt por Google AdMob: «No hemos podido verificar» / «Debe revisarse» tras publicar archivo y añadir web a ficha. Es probable que Google deba rastrear los cambios; no anunciar aprobación.
2. Validar UMP real para usuarios EEE y todas las declaraciones de Seguridad de los datos de Play Console antes de la versión de producción.
3. Ejecutar test nativo Android real o emulador del día 1, transición al día 8, límite equipo n.º 15/16, mantenimiento ilimitado, ads tras día 8, sin ads durante trial o con Pro, cobros y restauración Google Play de pruebas, sincronización Android-PC-Android. CI NO acredita estas pruebas.
4. AD_ID: Play Console advirtió «un artefacto activo no incluye com.google.android.gms.permission.AD_ID» después de activar la declaración ID publicidad. La excepción «Publicar sin permiso» SOLO se aplicó al lanzamiento de pruebas internas de código 14 para salvar un manifiesto de algún artefacto antiguo activo. Revisar qué artefacto carece del permiso, verificar permiso efectivamente fusionado en el manifest de código 14 y declarar explícito en siguiente AAB si es necesario ANTES de producción. No desactivar ID publicidad globalmente.
5. Nunca promocionar automáticamente versión 14 de pruebas a producción sin aprobar checks anteriores.
6. Las declaraciones guardadas en Play Console deben coordinarse con la publicación posterior, sin afirmar que están aprobadas.

## Próxima acción
- Reintentar verificación del archivo en AdMob y comprobar si figura aprobada.
- Ejecutar QA desde la lista de un tester «MaintenPro prueba propietario» mediante el enlace de prueba interna.
- Documentar resultado del AD_ID en bundle 14 y verificar compras reales de prueba.
- Si tests y AdMob conformes, lanzar NUEVO AAB firmado y revisar en producción.
