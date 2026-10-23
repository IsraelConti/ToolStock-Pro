# ToolStock Pro — estado inicial de la integración PC + móvil + Lupa

Fecha de comprobación: 2026-10-23 (UTC)

## Alcance y protección de producción

- Repositorio: `IsraelConti/ToolStock-Pro`
- Paquete Android existente: `com.toolstock.pro`
- Rama base inspeccionada: `main`
- Commit base: `40d6b74fe65278142154f21b2748e3983376f1a3`
- Rama de trabajo aislada: `codex/toolstock-pc-drive-lupa-20261023`
- La rama `main`, la ficha publicada y la producción de Google Play no se han modificado.

## Comprobación de Google Play Console

- Aplicación: ToolStock Pro: Repuestos.
- Canal de producción: activo.
- Última versión de producción: 1.4.4.
- Porcentaje de lanzamiento: 100 %.
- Países o regiones: 178.
- Descargas visibles en el canal: 2.
- Cambios no publicados: ninguno.
- Prueba interna: versión 10 (1.4.4), publicada el 12 de octubre de 2026.
- Prueba cerrada alpha: ToolStock Pro 1.4.0.
- Producto de suscripción existente: `toolstock_pro_premium_monthly`.

## Estado real del repositorio

- Android: compile/target SDK 36, minSdk 29, Billing 9.1.0, ML Kit para escáner y WebView con puente Kotlin.
- Versión del código actual: 1.4.4, versionCode 10.
- Funciones actuales: repuestos, movimientos, fabricante/OEM, QR, importación Excel/CSV, exportación Excel, copia/restauración JSON, análisis local, contactos, idioma/moneda/tema y control de suscripción.
- La demo está separada de los datos reales y no valida una compra real de Google Play.
- La copia y restauración actual son manuales y locales.
- El README declara expresamente que todavía no hay sincronización automática.
- No existe carpeta `windows/` ni un runtime de escritorio en la rama base.
- No existe todavía un agente local de ayuda llamado Lupa ni una base de conocimiento específica de ToolStock.

## Pendientes confirmados para esta actualización

1. Añadir el cliente de escritorio Windows con el mismo producto y sesión del cliente móvil.
2. Implementar el broker de sincronización por cliente usando Google Drive `appDataFolder`, con cifrado/validación y sin guardar datos operativos del cliente en un servidor central.
3. Enlazar la licencia de Google Play con Floot y el cliente PC sin cambiar el producto publicado.
4. Añadir Lupa como guía local de funcionamiento, disponible en las pantallas relevantes, sin API externa ni coste por consulta.
5. Añadir selección real de impresora y generación de documentos desde PC.
6. Mantener importación/exportación y recuperación compatibles con el formato actual.
7. Preparar pruebas web, Android y Windows; validar compra/restauración en una pista de Play con cuenta autorizada.
8. Generar AAB firmado con el versionCode siguiente, guardar artefactos y documentación en Drive/ToolStock y solo después preparar la revisión.

## Criterio de salida

No se debe abrir producción ni enviar una revisión hasta que el cliente móvil actual siga funcionando, el cliente PC instale y arranque, la sincronización bidireccional se haya probado con dos dispositivos, la compra/restauración esté probada desde Google Play y el checklist de regresión quede verde.
