# Borrador para Seguridad de los datos

Este documento corresponde a Moments Planner 1.1.0 (`com.momentsplanner.events`). Comprueba de nuevo las respuestas si en el futuro incorporas publicidad, analítica, cuentas en la nube, un servidor o nuevos SDK.

## Respuestas recomendadas

- ¿La aplicación recoge o comparte tipos obligatorios de datos de usuario? **Sí**, por la integración de Google Play Billing y su tratamiento del historial de compras para activar la suscripción.
- ¿Los datos se cifran durante la transferencia? **Sí**, la comunicación de facturación la gestiona Google Play.
- ¿Los usuarios pueden solicitar que se eliminen sus datos? **No aplica a una cuenta propia**, porque Moments Planner no crea cuentas ni conserva datos personales en un servidor del desarrollador. Los proyectos locales se eliminan desde la aplicación o al borrar sus datos/desinstalarla. Las compras se administran mediante Google Play.

## Tipo que debe revisarse/declararse

### Información financiera > Historial de compras

- Recogido: **Sí**, exclusivamente para comprobar y habilitar la suscripción mediante Google Play Billing.
- Compartido: **No con terceros por el desarrollador**.
- Tratamiento: necesario para la funcionalidad de la aplicación y prevención del fraude/seguridad.
- Temporal: se consulta desde Google Play; Moments Planner no guarda números de tarjeta ni datos bancarios.

## Datos que permanecen localmente

Proyectos, nombres y teléfonos de invitados, correos de clientes, alergias o necesidades especiales, proveedores, presupuestos, notas y planes logísticos se guardan únicamente en el almacenamiento local del dispositivo. No se transmiten al desarrollador ni a un servicio externo de IA. El tratamiento realizado exclusivamente en el dispositivo no se declara como recogida fuera del dispositivo.

Cuando el usuario exporta una copia, un Excel, una invitación o un calendario, elige conscientemente el archivo y su destino. Debe proteger esos documentos porque pueden contener datos personales.

## SDK y permisos incluidos

- Google Play Billing Library 9.1.0.
- Sin publicidad, analítica ni seguimiento.
- Sin permisos de ubicación, cámara, micrófono, contactos o notificaciones.
- Acceso a archivos únicamente cuando el usuario selecciona una copia para restaurarla o descarga una exportación.

