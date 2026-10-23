# ToolStock Pro: Repuestos

Aplicación Android de inventario industrial local. Paquete existente `com.toolstock.pro`; actualización **1.5.0 (11)**, Android 10 o posterior, target SDK 36. La versión publicada 1.4.4 (10) permanece intacta hasta completar la revisión.

- Crear, editar y eliminar repuestos conservando el historial.
- Entradas, consumos, préstamos, devoluciones y ajustes al stock contado.
- Fabricante, OEM, criticidad, plazo de entrega, compatibilidad y ubicación.
- Importar Excel/CSV, exportar Excel y generar etiquetas QR.
- Copia JSON completa, restauración manual y sincronización privada móvil-PC por cuenta de Google Drive.
- Análisis local de riesgo, reposición, consumo e inmovilizado.
- Tres contactos de equipo. No hay cuentas compartidas ni permisos por empleado.
- Formatos regionales, monedas, impuestos y tema. Interfaz en español.
- Correo del propietario opcional; no es una contraseña ni valida una cuenta de Google.

## Demostración y revisión

Pulsar **Probar demostración completa** en la primera pantalla. No requiere cuenta, contraseña, pago ni prueba gratuita. Los registros de la demo están separados de los datos reales y no activan una suscripción real. Salir con **Salir de la demostración**. Los botones de compra en demo no realizan compras.

En el inventario real, guardar cambios requiere una suscripción de Google Play. Precio y condiciones proceden de Google Play; no se cambian precios ni ofertas desde el código. Producto: `toolstock_pro_premium_monthly`.

La demo no valida el proceso real de compra. Este debe comprobarse con un paquete instalado desde una pista de Google Play y una cuenta de prueba autorizada.

## Copias y privacidad

Exportar copia JSON desde Configuración y elegir el destino. Restaurar copia JSON para recuperar o transferir los datos. La sincronización automática usa exclusivamente el espacio privado `appDataFolder` de la cuenta de Google del cliente; no existe un servidor central de inventarios. Los datos de empleados son contactos informativos; su función no restringe el acceso.

Un JSON local dañado se conserva y bloquea nuevas escrituras hasta restaurar una copia válida. Hay exportación de datos para recuperación. Stock e historial se guardan con un diario de recuperación de transacciones.

## Construcción

Java **JDK** 17, Android SDK 36, build-tools 35.0.0, Gradle 8.13.

```sh
npm ci
npm run build
mkdir -p android/app/src/main/assets
cp dist/* android/app/src/main/assets/
gradle -p android --no-daemon assembleDebug assembleRelease bundleRelease lint
```

Pruebas web (sin conectarse a servicios reales ni hacer compras):

```sh
npx playwright install chromium
npm test
```

Las pruebas recorren las pantallas, altas, edición, eliminación, movimientos, informes, copias, restauración, controles de suscripción simulados y fallos de almacenamiento. No sustituyen las pruebas de Billing desde Google Play.

SheetJS 0.20.3 se descarga de su CDN oficial y su integridad está fijada en package-lock.json.

El APK debug sirve para desarrollo y concede acceso de prueba: no valida la compra de producción. El AAB release debe firmarse con la clave de subida verificada para `com.toolstock.pro`. No almacenar claves, tokens o contraseñas en GitHub o en ZIP públicos.

## Publicación

Consultar `audit/` y `play-store/toolstock-industrial/`. La existencia de compilaciones no significa que se hayan superado pruebas de dispositivo o Billing. No enviar ni publicar hasta completar los controles y recibir autorización expresa.
