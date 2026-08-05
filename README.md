# ToolStock Pro — Repuestos Industriales

Aplicación Android profesional para controlar repuestos, consumibles y materiales de mantenimiento industrial.

## Funciones principales

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
- 3 días gratuitos para clientes nuevos elegibles y después 4,99 € al mes mediante Google Play Billing.

## Android

- Paquete: `com.toolstock.pro`
- Versión: 1.3.0
- Código de versión: 4
- Android mínimo: 10 (API 29)
- Objetivo: Android 16 (API 36)
- Suscripción: `toolstock_pro_premium_monthly`
- IA: local, sin enviar el inventario a servicios externos.

## Construcción

La acción **Build Android** genera en la rama `toolstock-industrial`:

- `ToolStock-Pro-Industrial-APK`: APK de prueba abierta para instalar directamente.
- `ToolStock-Pro-Industrial-AAB-unsigned`: AAB release que debe firmarse con la clave permanente antes de Google Play.

## Publicación

La carpeta `play-store/toolstock-industrial` contiene la ficha, configuración de suscripción, seguridad de datos, política de privacidad y guía de subida. La cuenta de Google Play debe estar verificada antes de crear la aplicación.
