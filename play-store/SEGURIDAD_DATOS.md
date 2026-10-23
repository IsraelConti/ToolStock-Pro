# Preparación de Seguridad de los datos · actualización 1.2.9

Pendiente de completar y guardar en Play Console. Este documento sustituye la nota antigua de copias manuales sin sincronización; no acredita el envío del cuestionario.

## Comportamiento comprobado en el código

- El inicio de sesión para la conexión móvil–PC utiliza Google OAuth. No se solicita la contraseña de Google dentro de MaintenPro.
- Equipos, órdenes, preventivos, fotografías, contactos técnicos y ajustes se guardan en el dispositivo y, si el cliente conecta Google, en el appDataFolder de su propio Drive.
- Floot conserva Google sub, correo y recibo de compra cifrado para verificar la licencia. No recibe los registros operativos de los clientes actuales.
- Todas las peticiones externas de los clientes actuales utilizan HTTPS. El HTTP del broker Windows es exclusivo de 127.0.0.1.
- Los identificadores aleatorios de dispositivo se envían dentro de las instantáneas de Drive; no son identificadores publicitarios.
- La guía Sr. Alicate, sus búsquedas y la orientación técnica se procesan localmente. No hay publicidad ni analítica añadida al proyecto.

## Mapa para revisar las respuestas

| Datos | Tratamiento y finalidad |
| --- | --- |
| Correo e ID de usuario Google | Identificación, gestión de cuenta y acceso al PC. El inicio de sesión de Google para sincronización es opcional para el uso local de Android. |
| Historial de compras y recibo | Verificación de suscripción mediante Google Play Billing y servicio de licencias. MaintenPro no recibe números de tarjeta ni cuentas bancarias. |
| Nombres, correos y contactos técnicos introducidos por el usuario | Registros locales; salen al Drive del cliente si activa la sincronización. No se consulta la agenda de contactos del sistema. |
| Fotografías | Archivos elegidos por el usuario; se incluyen en la copia de Drive al sincronizar. |
| Archivos, documentos y otros contenidos generados por el usuario | Instantáneas JSON, fichas, órdenes, notas, preventivos y ajustes. La agenda es interna; no se consulta el calendario personal del sistema. |
| IDs de dispositivo o de otro tipo | UUID del dispositivo de MaintenPro utilizado para separar instantáneas y unir cambios. |

Los datos de Drive no deben omitirse automáticamente por pertenecer al cliente: la aplicación los lee y escribe. Hay que revisar los tipos de datos del cuestionario, su recogida opcional u obligatoria y las exenciones de uso de proveedores y acciones iniciadas por el usuario. No marcar categorías de GPS, publicidad, grabación de audio o tarjetas bancarias a partir de suposiciones. Revisar también las declaraciones vigentes de los SDKs de Google utilizados.

## Seguridad y eliminación

Declarar el inicio de sesión OAuth y la posibilidad de solicitar eliminación de la vinculación de cuenta. Enlace público preparado: https://israelconti.github.io/eliminar-datos.html. Política: https://israelconti.github.io/privacidad.html.

La solicitud de eliminación de identidad y licencia es manual por el canal indicado en la página. El cliente puede borrar registros locales, retirar permisos de Google y eliminar los datos privados de MaintenPro desde la gestión de aplicaciones de Drive. Las copias exportadas se eliminan por separado. Borrar datos no cancela la suscripción de Google Play.

No declarar verificación independiente de seguridad ni cifrado de extremo a extremo: no se han realizado ni implementado. HTTPS y el cifrado del recibo en el servidor no equivalen a cifrado de extremo a extremo.

Referencia oficial para rellenar el formulario: https://support.google.com/googleplay/android-developer/answer/10787469?hl=es
