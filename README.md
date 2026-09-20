# ToolStock Pro — Repuestos Industriales

Aplicación Android profesional para controlar repuestos, consumibles y materiales de mantenimiento industrial.

## Funciones principales

- Registro obligatorio del correo del propietario antes de acceder.
- Inventario de repuestos con referencia interna, código de barras, fabricante y referencia OEM.
- Clasificación de criticidad: crítica, alta, media o baja.
- Asociación por centro, almacén, estantería, línea, equipo y compatibilidad.
- Stock actual, mínimo, unidad, valor, proveedor y plazo de entrega.
- Entradas, consumos, préstamos, devoluciones y ajustes con trazabilidad.
- Registro de responsable, destino, equipo, orden de trabajo y observaciones.
- ToolStock IA local para riesgos de parada, reposición, consumo, exceso y auditoría.
- Escáner Android local para QR, EAN, UPC, Code 128, Code 39 y Data Matrix.
- QR imprimibles, importación Excel/CSV e informes Excel.
- Carpeta privada elegida por el usuario mediante Android Storage Access Framework.
- Propietario y hasta tres empleados: encargado, operario o consulta.
- Idiomas, monedas, impuestos, tema y navegación Atrás.
- Centro de información, ayuda, privacidad y limitaciones.
- Compra única en Google Play, sin suscripción ni pagos dentro de la app.

## Android

- Paquete: `com.toolstock.pro.paid`
- Versión: 1.0.0
- Código de versión: 1
- Android mínimo: 10 (API 29)
- Objetivo: Android 16 (API 36)
- Monetización: compra de la aplicación en Google Play.
- IA: local, sin enviar el inventario a servicios externos.

## Construcción

La acción **Build Android** genera en la rama `toolstock-paid`:

- `ToolStock-Pro-APK`: APK de prueba abierta para instalar directamente.
- `ToolStock-Pro-AAB-unsigned`: AAB release que debe firmarse con la clave permanente antes de Google Play.

## Publicación

La carpeta `play-store/toolstock-paid` contiene la ficha y la declaración de privacidad propuestas para la nueva aplicación de pago. La clave de firma permanente y el precio de venta deben configurarse antes de presentar la aplicación.
