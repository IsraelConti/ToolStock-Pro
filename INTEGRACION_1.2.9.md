# MaintenPro 1.2.9 (12): candidato de integración

## Cambios implementados

- Pantalla Móvil y PC en Android y ordenador. Cuenta Google común y botón de descarga de PC.
- Sincronización de equipos, órdenes, preventivos y técnicos en la carpeta privada de la aplicación del Drive de cada cliente.
- Unión por registro, conservación de bajas y recuperación explícita de ediciones simultáneas. Cambios sin Internet se guardan localmente para el siguiente intento.
- OAuth nativo Android y PKCE en PC. El navegador no recibe tokens de Google. Sesión Windows cifrada por DPAPI.
- Instalación por usuario con motor Node incluido y accesos directos. Dirección local estable para conservar los datos entre aperturas.
- Sr. Alicate con guía local consultable, acceso en las pantallas y corrección de la consulta sobre cómo crear una orden. Sin dependencia de un modelo externo.
- Impresión de documentos preparados (orden, ficha, informe, QR) mediante el diálogo de impresión; tres temas de escritorio e imágenes conservadas.

## Pruebas

El resultado exacto se actualiza en el informe de entrega. Las simulaciones no sustituyen las pruebas reales con Google Play, dos dispositivos, la cuenta del cliente y una impresora física.

## Configuración pendiente de producción

`config/release.json` contiene los valores públicos. Las entradas vacías mantienen la conexión cerrada y el verificador bloquea la publicación. La clave privada de Google Play solo puede estar en el servicio de licencias, nunca en los paquetes, informes ni Drive de distribución.

La app publicada 1.2.7 permanece activa. Este candidato no se ha enviado a revisión. Se exige configuración real de Google OAuth, Drive API, producto de Play, servicio de licencias y descarga HTTPS, y después la prueba completa Android–PC–Android antes de subir el AAB firmado.

## Migración sin pérdida de datos

La vista previa anterior usaba file://. Exportar su copia JSON antes de actualizar e importarla en la nueva instalación, cuyo almacén usa http://127.0.0.1:41791/. El instalador conserva archivos previos y no borra almacenamiento de Chrome. No conectar una cuenta distinta sobre datos de otro cliente; exportar y borrar solo ese dispositivo antes de cambiar de propietario.
