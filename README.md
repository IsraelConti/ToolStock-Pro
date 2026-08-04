# MaintenPro

Aplicación Android profesional para gestionar mantenimiento preventivo y
correctivo de máquinas, instalaciones y equipos.

## Funciones principales

- Fichas de equipos con fotografía, ubicación, horas de uso y código QR.
- Órdenes correctivas con prioridad, técnico y trazabilidad.
- Planes preventivos por fecha o intervalo de horas.
- Calendario de mantenimientos y avisos próximos.
- Cierre con diagnóstico, solución, repuestos, horas y costes.
- Historial completo por equipo y estado de cada orden.
- Informes Excel, copias JSON y personalización de empresa.
- Propietario y hasta tres técnicos.
- Funcionamiento local sin conexión.
- Suscripción mensual mediante Google Play Billing (`maintenpro_premium_monthly`).
- Configuración inicial con correo del propietario y carpetas de Drive.
- Centro de ayuda y política de privacidad.

## Compilación

La acción `Build Android` de la rama `maintenpro` genera:

- `MaintenPro-APK`: APK instalable para pruebas.
- `MaintenPro-AAB-unsigned`: paquete que deberá firmarse para Google Play.

La APK debug permite probar la aplicación sin compra. La variante release exige una suscripción activa de Google Play.
