# Auditoría MaintenPro PC — candidato

Fecha: 21 de octubre de 2026

## Resultado

La compilación web, las pruebas del proyecto y el empaquetado automatizado pasan en el entorno disponible. Este paquete es un candidato para instalar y probar; no es una versión validada en Windows ni una actualización publicada.

## Incluido y probado automáticamente

- Vista de escritorio, 13 pantallas, búsqueda, tres temas, imágenes y guía local Sr. Alicate. En PC se muestra un solo buscador de guía; se eliminan la guía móvil duplicada y el acceso flotante móvil.
- La búsqueda de ayuda reconoce preguntas naturales como «cómo se hace una orden» y devuelve los pasos concretos para abrir Avería, completar campos y crear la orden.
- Preparación de fichas, órdenes e informes y apertura del diálogo de impresión del navegador.
- Copia JSON para exportar e importar registros manualmente.
- Controles de sincronización automática deshabilitados y estado explícito de que la integración no está disponible.
- Pruebas del proyecto: revisiones de registros, contrato de sincronización, API, roundtrip y cola simulados, configuración y humo de revisión.
- Construcción y humo del paquete de instalación ZIP.

## Fuera de alcance o pendiente de validación real

- No hay sincronización automática PC↔Android ni conexión directa de MaintenPro PC a la carpeta Drive del usuario en este candidato. La transferencia disponible es manual mediante JSON.
- No se configuraron ni publicaron OAuth, servicio de sincronización, base de datos ni validación de compra.
- El empaquetado Windows se genera aquí, pero no se instaló ni ejecutó en un equipo Windows real. La impresión se verificó en código y en pruebas estáticas, no con una impresora física.
- La guía local es contenido de ayuda por reglas y búsqueda, no un modelo de IA generativa.
- No se creó ni se envió un AAB de Android.

## Pruebas realizadas

- `npm run build`
- `npm test`
- `npm run build:windows` (incluye humo del instalador)
- `git diff --check` no se ejecutó: este ZIP de Drive no contiene metadatos Git.

## Instrucciones de validación

Instalar el ZIP candidato en un Windows con Chrome, abrir varias pantallas, crear y cerrar una orden, exportar e importar una copia JSON, verificar los tres temas y probar Vista previa e imprimir con una impresora del equipo. No introducir credenciales de producción en este candidato.
