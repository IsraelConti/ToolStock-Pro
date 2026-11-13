# MaintenPro

Aplicación Android profesional para gestionar mantenimiento preventivo y
correctivo de máquinas, instalaciones y equipos.

## Funciones principales

- Fichas de equipos con fotografía, ubicación, horas de uso y código QR.
- Órdenes correctivas con prioridad, técnico y trazabilidad.
- Planes preventivos por fechas e intervalos de días.
- Calendario de mantenimientos y avisos próximos.
- Cierre con diagnóstico, solución, repuestos, horas y costes.
- Registro de equipos, órdenes y planes en el dispositivo.
- Informes Excel, copias JSON y personalización de empresa.
- Registro local del propietario y hasta tres contactos técnicos (sin cuentas ni permisos por usuario).
- Funcionamiento local sin conexión; no hay sincronización automática entre dispositivos.
- **Primeros 7 días desde la primera apertura:** equipo ilimitados, **con anuncios discretos**, sin pedir tarjeta ni generar cargos automáticos.
- **A partir del día 8, sin pagar:** modalidad gratuita permanente con anuncios y un máximo de 15 equipos nuevos; todos los equipos y mantenimientos existentes se conservan.
- **Pro pagada:** 4,99 € al mes mediante Google Play Billing 9.1.0 (`maintenpro_premium_monthly`), equipos ilimitados y **sin anuncios**. Es una suscripción opcional con renovación mensual.
- Configuración opcional de una carpeta de Drive y copias JSON manuales; los cambios operativos se guardan localmente.
- Centro de ayuda y política de privacidad.

## Compilación

La acción `Build Android` compila los paquetes Android y, cuando están configurados los secretos de firma, genera un AAB firmado para Google Play y un APK firmado para distribución directa.

La APK debug muestra anuncios de prueba de AdMob. La variante release requiere IDs reales ADMOB_APP_ID y ADMOB_BANNER_UNIT_ID, declaraciones de privacidad/consentimiento y validación de Play Console antes de publicarse. Los siete días gratis son de uso de la aplicación, NO una prueba de suscripción que cobre al terminar. Solo las personas que confirman expresamente una compra de Pro en Google Play pasan al plan de pago.

La versión en rama es 1.2.6 (versionCode 9) y utiliza Android API 36. No está publicada. La compilación y pruebas finales deben confirmarse en GitHub Actions.
