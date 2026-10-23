# ToolStock PC 1.5.0

Este runtime abre la aplicación web empaquetada en una ventana de Chrome en modo aplicación y mantiene el servicio limitado a `127.0.0.1`. La versión 1.5.0 añade la vinculación visible de cuenta, el estado OAuth y la guía local Lupa. No cambia la aplicación Android publicada hasta que se publique la actualización.

## Desarrollo local

1. Instala Node.js 20 o posterior.
2. Ejecuta `npm ci`.
3. Ejecuta `npm run pc:serve`.
4. Comprueba `http://127.0.0.1:4173/health`.

También puedes iniciar el programa haciendo doble clic en `windows\\start-toolstock.cmd`. Para crear un acceso directo sin permisos de administrador:

```powershell
powershell -ExecutionPolicy Bypass -File .\\windows\\install-user.ps1
```

Para sincronizar con la cuenta del cliente se necesita un OAuth Client ID de tipo aplicación de escritorio configurado como variable de entorno:

```powershell
$env:TOOLSTOCK_GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
$env:TOOLSTOCK_GOOGLE_CLIENT_SECRET="..."
npm run pc:serve
```

El secreto y los tokens viven solo en memoria del proceso. No se escriben en el repositorio, en Drive ni en los datos del inventario. El flujo solicita únicamente `drive.appdata`; el archivo de sincronización queda en el espacio privado de la cuenta de Google. El estado de `/oauth/status` no devuelve tokens.

## Comprobación de instalación

- La ventana se abre con Chrome mediante `--app`.
- La interfaz es la misma que en Android y conserva tema, idioma, moneda y preferencias.
- Las etiquetas QR usan el diálogo de impresión del sistema del ordenador.
- La sincronización no se anuncia como activa hasta completar el inicio de sesión de Google.
- El botón de desvinculación cierra los tokens en memoria del PC sin borrar el archivo privado de Drive.

## Firma y publicación Android

El AAB de producción debe tener `versionCode` superior al publicado y firmarse con la clave de subida aceptada por Google Play. Nunca guardes el `.p12`, las contraseñas ni tokens en GitHub. Con la clave privada disponible solo en un equipo seguro:

```powershell
$env:TOOLSTOCK_KEY_ALIAS = "..."
$env:TOOLSTOCK_STORE_PASSWORD = "..."
$env:TOOLSTOCK_KEY_PASSWORD = "..."
powershell -ExecutionPolicy Bypass -File .\\windows\\sign-release.ps1 `
  -AabPath .\\android\\app\\build\\outputs\\bundle\\release\\app-release.aab `
  -KeystorePath C:\\ruta\\ToolStock-upload-key.p12 `
  -OutputPath .\\release\\ToolStock-Pro-Play-signed.aab
```

Antes de firmar o subir hay que confirmar en Play Console que el restablecimiento de la clave de subida ya está aprobado. La compra/restauración real y la prueba con una impresora instalada deben hacerse con una compilación procedente de una pista autorizada.
