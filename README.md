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
- 3 días gratuitos para clientes nuevos elegibles y después 4,99 € al mes mediante Google Play Billing 9.1.0 (`maintenpro_premium_monthly`).
- Configuración opcional de una carpeta de Drive y copias JSON manuales; los cambios operativos se guardan localmente.
- Centro de ayuda y política de privacidad.

## Compilación

La acción `Build Android` compila los paquetes Android y, cuando están configurados los secretos de firma, genera un AAB firmado para Google Play y un APK firmado para distribución directa.

La APK debug permite revisar la aplicación sin compra y no consume la oferta comercial. La variante release consulta Google Play: ofrece 3 días gratis a las cuentas elegibles y el plan mensual normal a las demás.

La versión candidata siguiente es 1.2.7 (versionCode 10), compilada con Android 16 (API 36).
