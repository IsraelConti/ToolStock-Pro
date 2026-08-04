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
- 3 días gratuitos para clientes nuevos elegibles y después 4,99 € al mes mediante Google Play Billing 9.1.0 (`maintenpro_premium_monthly`).
- Configuración inicial con correo del propietario y carpetas de Drive.
- Centro de ayuda y política de privacidad.

## Compilación

La acción `Build Android` de la rama `maintenpro` genera:

- `MaintenPro-APK`: APK instalable para pruebas.
- `MaintenPro-AAB-unsigned`: paquete que deberá firmarse para Google Play.

La APK debug permite revisar la aplicación sin compra y no consume la oferta comercial. La variante release consulta Google Play: ofrece 3 días gratis a las cuentas elegibles y el plan mensual normal a las demás.

La versión 1.2.1 compila con Android 16 (API 36), preparada para los requisitos de Google Play del 31 de agosto de 2026.
