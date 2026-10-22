# MaintenPro 1.2.9 · Android y Windows

Actualización de la aplicación existente `com.icapps.maintenpro`. El programa de Windows utiliza la misma suscripción de Google Play y la misma cuenta Google conectada en el móvil. Sr. Alicate es una guía local incluida, sin proveedor de IA externo.

## Datos y sincronización

Los registros operativos permanecen en el dispositivo y en el espacio privado `appDataFolder` de cada cliente en su Google Drive. Los clientes Android y Windows deben pertenecer al mismo proyecto Google Cloud y usar la misma cuenta. Cada dispositivo guarda su instantánea y los cambios se unen por registro con relojes vectoriales, bajas y conflictos recuperables. Los fallos de red dejan los cambios pendientes; una escritura local fallida conserva el estado anterior y avisa al usuario.

Floot solo sirve las licencias: `/v1/session`, `/v1/entitlement` y `/v1/health`, bajo `/_api`. Guarda la identidad Google y el recibo de compra cifrado. No recibe equipos, órdenes, fotografías ni informes de los clientes actuales. Los archivos antiguos de `server/` y las rutas `/sync/*` de Floot son prototipos y no forman parte de la conexión Drive actual.

## Configuración

`config/release.json` contiene versión, clientes OAuth y direcciones públicas. El proyecto Google es `encoded-victory-512321-v3`. El servicio de licencias está publicado en `https://maintenpro-icapps.floot.app/_api`. El producto es `maintenpro_premium_monthly`; el plan `mensual-499` está activado, con precio final de España de 4,99 EUR al mes.

La clave privada de la cuenta de servicio de Play se conecta únicamente al recurso seguro `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` de Floot. No debe ir al repositorio, a los paquetes ni a una copia de código. El identificador y secreto de un cliente OAuth de escritorio son parámetros del programa instalado, no credenciales de la cuenta de servicio.

## Construir y comprobar

- `npm ci`
- `npm test`: contratos, suscripciones simuladas, unión de cambios, aislamiento y broker nativo.
- `npm run build`: recursos web y Android.
- `python scripts/prepare-windows-runtime.py`: runtime oficial de Node para Windows, con SHA-256 verificado.
- `npm run build:windows`: paquete de Windows y comprobaciones del instalador.
- `npm run test:ui`: recorrido de las 15 pantallas, guía, equipos, órdenes, temas y documentos mediante Playwright; requiere Chromium disponible en `MAINTENPRO_TEST_CHROME`.
- `npm run release:check`: bloquea la publicación si falta una configuración pública esencial. Superarlo no sustituye las pruebas reales de compra y sincronización.

Android necesita Java 17, Gradle 8.13, SDK 36 y build-tools 36.0.0. La firma de subida existente de MaintenPro se conserva en los secretos del repositorio, sin extraer sus valores. La rama de MaintenPro está separada del `main` de ToolStock.

## Windows

El paquete incluye su propio runtime oficial de Node y abre Chrome en modo aplicación. Se instala en el perfil del usuario, crea accesos directos y conserva una copia de la instalación anterior. El broker local usa `127.0.0.1:41791`, sesión privada, comprobaciones de origen y CSRF, y OAuth PKCE. El token de renovación se cifra para el usuario de Windows mediante DPAPI y no se entrega al JavaScript.

Los documentos se preparan como una orden, ficha o informe antes de abrir el diálogo de impresión del ordenador. La selección de una impresora física debe comprobarse en Windows; una prueba automática del menú no demuestra una impresión física.

## Estado antes de entregar

Las pruebas automáticas y el empaquetado de PC han pasado. La compilación Android se comprobó en una revisión anterior de esta integración; los últimos cambios nativos necesitan una compilación nueva. Siguen pendientes la conexión segura de la clave de Play, la prueba real de compra/restauración, el recorrido móvil-PC-móvil y el AAB firmado de esta actualización. No se ha enviado la 1.2.9 a revisión. La versión ya publicada de Google Play permanece disponible.

Código y entregables se respaldan en la carpeta MaintenPro del Drive del propietario. Los archivos de avance no deben presentarse como una versión final.
