# MaintenPro PC 1.2.9

Candidato de integración con Android, pendiente de completar la configuración pública de OAuth y licencias y de las pruebas reales de compra y dos dispositivos. No se ha enviado a Google Play.

## Instalación

Extraer el ZIP completo y ejecutar `Instalar_MaintenPro_PC.bat`. Instalación por usuario en Windows 10/11 x64 con Google Chrome, accesos de Escritorio e Inicio y runtime oficial incluido. No requiere instalar Node.js ni permisos de administrador.

La interfaz abre en `http://127.0.0.1:41791/` y conserva sus datos en Chrome. Las actualizaciones deben mantener esa dirección. La vista previa antigua usaba `file://`: exportar su copia JSON e importarla en la nueva versión antes de conectar Google. Sus datos anteriores no se borran.

## Cuenta y datos

Conectar la misma cuenta en Móvil y PC, con la compra activa vinculada desde Android. Los equipos, órdenes, técnicos y preventivos se unen en el `appDataFolder` de esa cuenta en Google Drive. Los cambios sin Internet se conservan en el dispositivo y se reintentan al recuperar la conexión. Las bajas y las modificaciones simultáneas se conservan; la pantalla permite recuperar el cambio alternativo.

Google autoriza el acceso. No se pide contraseña de Google. Tokens solo en el proceso nativo; renovación persistente cifrada mediante Windows DPAPI. El servicio de licencias verifica identidad y compra; no recibe registros de mantenimiento.

Sr. Alicate incluye ayuda local consultable. Documentos prepara órdenes, fichas, informes y etiquetas y utiliza el diálogo de impresión del sistema. La impresora se selecciona en ese diálogo.

## Desarrollo

`python scripts/prepare-windows-runtime.py` verifica el runtime oficial. `node windows/build.mjs` genera la distribución. `node windows/package-installer.mjs` empaqueta y `node windows/installer-smoke.mjs` comprueba sus entradas y el ejecutable. Los valores públicos se completan en `config/release.json`; `npm run release:check` bloquea la publicación mientras falten.
