# Revisión GitHub 750c00ed

La comparación se limita a las entradas que se abrieron. No es un diff completo del árbol.

## ZIP abierto

- Ruta: `C:\Users\dific\Desktop\comic\MaintenPro_Codigo_Fuente_PC_Android_2026-10-20\MaintenPro_actualizado_2026-10-21_bundle_local.zip`
- Tamaño: 10740665 bytes. El mismo archivo se subió a Drive MaintenPro y el tamaño coincidió. No se volvió a descargar para esta comprobación.
- El ZIP se abrió. Contiene `windows/desktop.js` (28849 bytes), `windows/build.mjs` (12544), `windows/desktop-session.mjs` (5913), `windows/pkce.mjs`, los archivos bat, `windows/dist/` y `server/index.js` (1200).
- `android/app/build.gradle.kts` dentro del ZIP tiene `versionName` "1.2.7" y `versionCode` 10.
- El README del ZIP describe un servicio de sincronización local que mantiene el acceso cerrado hasta que se confirma una compra, y también indica la versión 1.2.7.

## Rama de GitHub verificada por el usuario

- Repositorio: IsraelConti/ToolStock-Pro
- Rama: `codex/maintenpro-full-review-20261013`
- Commit: `750c00eda31765c4a24a6e7e6573b3274668e73f`
- El usuario verificó que `windows/` contiene solo `windows/README.md` (no hay `desktop.js` ni `build.mjs`).
- El README de la raíz dice que los datos permanecen en local, que los dispositivos no se sincronizan y que el candidato es 1.2.7 / código 10.

## Continuidad y estado local

- Las notas de continuidad de Drive registran 1.2.8 / código 11, no enviado. La producción 1.2.7 debe permanecer intacta.
- El espacio de trabajo no tiene `.git`. Cursor Changes muestra Initialize Repository. No hay git diff.
- Este informe no estaba antes en disco y no se subió a Drive.
- Floot MaintenPro Cloud Sync `932e217f-d8a7-47fb-9d77-cb68a9754e9d` no se leyó (cuota hasta 2026-10-21 13:00 UTC). La credencial de Play no se conectó.

## Sincronización en vivo

La sincronización en vivo no está terminada. Falta para una ejecución real:

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `SYNC_API_BASE`
- `GOOGLE_WEB_CLIENT_ID`
- El plan de Railway no está seleccionado.
- El producto de Play `maintenpro_premium_monthly` no está creado; pendiente de precio, moneda, países, periodo y prueba.
- Falta la cadena de herramientas local de Android (Java 11, sin Gradle, `ANDROID_HOME` vacío).
- Un `workflow_dispatch` en la rama actual construiría el árbol de GitHub, no este ZIP, y no se disparó.
