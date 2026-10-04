# Actualización de la aplicación existente

Actualizar exclusivamente la ficha con paquete `com.toolstock.pro`. No crear otra aplicación.

1. Versión 1.4.2, código 8. Verificar que el código no haya sido usado ya en Play Console.
2. Comprobar el certificado de la clave de subida en Integridad de la aplicación antes de subir el AAB firmado.
3. Nombre visible e instalado: ToolStock Pro: Repuestos. Comparar el icono de la ficha con el icono instalado.
4. Suscripción existente: `toolstock_pro_premium_monthly`. Confirmar plan mensual y oferta activa; el programa muestra las condiciones que devuelve Google Play.
5. Instalar desde una pista de Google Play con una cuenta de prueba de licencia. Comprobar compra, cancelación del diálogo, compra pendiente, restauración y gestión de suscripción.
6. Sin suscripción, comprobar la vista de consulta y el bloqueo de escrituras; los datos deben conservarse.
7. Revisar registro del propietario, altas, movimientos, importación y exportación, escáner y navegación.
8. Reenviar la actualización únicamente después de comprobar la ficha y la compra con Google Play.

La APK debug da acceso de desarrollo y no sirve para validar compras reales. El AAB sin firma no sirve para enviar una versión a Play Console.

La firma automática usa secretos TOOLSTOCK_KEYSTORE_B64, TOOLSTOCK_STORE_PASSWORD, TOOLSTOCK_KEY_PASSWORD y TOOLSTOCK_KEY_ALIAS. Nunca guardar la clave privada ni las contraseñas en el repositorio o en los artefactos públicos.
