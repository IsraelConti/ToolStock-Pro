# ToolStock Pro — Taller

Proyecto comercial Android/PWA para gestión de inventario de talleres.

## Incluido en esta entrega de construcción

- Panel e inventario local.
- Alta de productos con todos los campos etiquetados.
- Importación masiva Excel/CSV, vista previa y actualización de duplicados.
- Plantilla Excel descargable.
- Informes Excel de inventario y stock bajo.
- QR reales y hojas imprimibles.
- Configuración de idioma, moneda, impuestos, empresa, tema y permisos básicos.
- Navegación de retorno visible, botón cancelar y compatibilidad con Atrás de Android.
- Base de variantes para futuras ediciones.

## Construir recursos web

```bash
npm install
npm run build
```

Copiar el contenido de `dist/` en:

```text
android/app/src/main/assets/
```

Abrir la carpeta `android` con Android Studio, sincronizar Gradle y generar el APK/AAB.

## Trabajo pendiente antes de publicar

- Integración completa con Android Storage Access Framework para Drive.
- Cámara y lector QR/código de barras nativos.
- Usuarios invitados y sincronización/conflictos.
- Firma comercial, iconos definitivos, política de privacidad y pruebas en dispositivos.
- Traducción completa de todos los textos (los idiomas ya están configurados).

## Compilación automática

Cada cambio en `main` ejecuta `.github/workflows/android.yml`.

La ejecución genera:

- `ToolStock-Pro-APK`: APK de depuración instalable para pruebas.
- `ToolStock-Pro-AAB-unsigned`: paquete de publicación aún sin firma comercial.

El AAB definitivo de Google Play deberá firmarse con una clave permanente
guardada como secreto del repositorio.


[Ver compilaciones Android](https://github.com/IsraelConti/ToolStock-Pro/actions/workflows/android.yml)
