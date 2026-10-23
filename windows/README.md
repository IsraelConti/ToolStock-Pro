# ToolStock PC

Este runtime abre la aplicación web empaquetada en una ventana de Chrome en modo aplicación y mantiene el servicio limitado a `127.0.0.1`. No cambia la aplicación Android publicada.

## Desarrollo local

1. Instala Node.js 20 o posterior.
2. Ejecuta `npm ci`.
3. Ejecuta `npm run pc:serve`.
4. Comprueba `http://127.0.0.1:4173/health`.

Para sincronizar con la cuenta del cliente se necesita un OAuth Client ID de tipo aplicación de escritorio configurado como variable de entorno:

```powershell
$env:TOOLSTOCK_GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
$env:TOOLSTOCK_GOOGLE_CLIENT_SECRET="..."
npm run pc:serve
```

El secreto y los tokens viven solo en memoria del proceso. No se escriben en el repositorio, en Drive ni en los datos del inventario. El flujo solicita únicamente `drive.appdata`; el archivo de sincronización queda en el espacio privado de la cuenta de Google.

## Comprobación de instalación

- La ventana se abre con Chrome mediante `--app`.
- La interfaz es la misma que en Android y conserva tema, idioma, moneda y preferencias.
- Las etiquetas QR usan el diálogo de impresión del sistema del ordenador.
- La sincronización no se anuncia como activa hasta completar el inicio de sesión de Google.
- Para empaquetar un instalador firmado aún hay que elegir el canal de distribución (MSIX, instalador WinGet o paquete corporativo) y firmarlo con un certificado propio.
