# Seguridad de los datos — borrador

Versión 1.3.1, paquete `com.toolstock.pro`.

## Declaración recomendada

- Historial de compras: se consulta mediante Google Play Billing para activar Premium.
- Cifrado en tránsito: sí, gestionado por Google Play.
- Publicidad: no.
- Analítica o seguimiento: no.
- Cuenta propia en servidor: no.
- Ubicación, contactos y micrófono: no.
- Cámara: la app no solicita permiso; Google Code Scanner muestra su interfaz mediante Google Play Services y procesa el código localmente.
- Archivos: el usuario selecciona explícitamente importaciones, exportaciones o una carpeta con el selector de Android.

## Datos locales

Productos, referencias, fabricantes, ubicaciones, equipos, proveedores, precios, empleados y movimientos se guardan localmente. ToolStock IA funciona en el dispositivo. Estos datos no se transmiten al desarrollador.

## Exportaciones

Excel, CSV, JSON y QR pueden contener información empresarial. El usuario elige el destino y es responsable de proteger los archivos y compartirlos solo con personas autorizadas.

Revisar esta declaración si en el futuro se añaden servidor, cuentas en nube, publicidad, analítica o nuevos SDK.
