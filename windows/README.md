# MaintenPro Windows

Módulo de escritorio de MaintenPro, añadido de forma independiente para no alterar la aplicación Android candidata a producción.

## Objetivo

- Mantener la identidad y modelo funcional de MaintenPro.
- Interfaz optimizada para Windows: menú lateral, dashboard, tablas, búsqueda y filtros.
- Reutilizar el modelo de datos actual (`equipment`, `orders`, `plans`, `team`, `settings`).
- Preparar el cliente para sincronización futura Android ↔ Google Apps Script ↔ Drive ↔ Windows.
- Mantener funcionamiento local/offline.
- Preparar distribución instalable y portable sin Python/Java para el usuario final.

## Estado

Fase 1 iniciada: adaptación de escritorio sin modificar `android/` ni el package ID `com.icapps.maintenpro`.

## Modelo actual confirmado

La aplicación actual guarda localmente:

- `maintenpro.equipment`
- `maintenpro.orders`
- `maintenpro.plans`
- `maintenpro.team`
- `maintenpro.settings`

La versión Windows mantendrá compatibilidad conceptual con estas entidades. La siguiente capa añadirá metadatos de sincronización (`id`, `updatedAt`, `version`, `deviceId`, `deletedAt`) sin romper los registros existentes.

## Primer hito funcional

1. Dashboard de escritorio.
2. Gestión de equipos.
3. Órdenes correctivas.
4. Preventivos y calendario.
5. Equipo técnico.
6. Informes/importación/exportación.
7. Persistencia local.
8. Preparación del adaptador de sincronización.
