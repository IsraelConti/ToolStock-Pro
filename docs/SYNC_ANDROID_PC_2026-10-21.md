# Auditoría Android ↔ PC — 21 de octubre de 2026

> Registro histórico de la arquitectura inicial. Fue sustituida por la sincronización en el Drive de cada cliente y el servicio de licencias Floot. Los bloqueos de firma, despliegue y configuración aquí descritos ya no representan el estado actual. Consultar `ESTADO_2026-10-22.md` y el README antes de continuar.

El ZIP `MaintenPro_PC_Guia_Local_2026-10-20.zip` instala la app en el perfil del usuario y abre Chrome con `file:///`. No es un MSI ni un EXE firmado. Esa instalación no llama al backend. Floot Cloud Sync `932e217f-d8a7-47fb-9d77-cb68a9754e9d` no está publicado. Esta nota describe el código de este repositorio, no un servicio en producción.

## Contrato que sí está en el código

| Ruta | Auth | Uso real |
| --- | --- | --- |
| `GET /v1/health` | Ninguna | El servidor responde `{ok:true}`. Ningún cliente la llama. |
| `POST /v1/session` | ID token de Google y token de compra en el cuerpo | Solo Android. Si Play confirma `maintenpro_premium_monthly`, guarda el token en `account_play` y no lo devuelve. |
| `GET /v1/entitlement` | `Authorization: Bearer` y la compra ya guardada o enviada en `x-play-purchase-token` | Implementado. Android y PC no lo consultan. |
| `POST /v1/sync` | El mismo Bearer y la compra | Android llama al servicio. El PC solo reenvía si arranca `windows/desktop-session.mjs` con `GOOGLE_CLIENT_ID` y `SYNC_API_BASE` https. |

Entidades: `equipment`, `orders`, `plans`, `team` y ajustes compartidos. El identificador admite de 1 a 80 caracteres `A-Za-z0-9_-`. La revisión de un registro es `deletedAt`, si no `updatedAt`, si no `createdAt`. El cursor de la cuenta es un entero. Gana la marca más nueva. Si empatan, se queda la copia ya guardada. `driveName` no sale del dispositivo.

Sin compra válida la respuesta es 401 y no se escribe nada. El verificador de Play usa `purchases.subscriptionsv2` del paquete `com.icapps.maintenpro`. Valen `SUBSCRIPTION_STATE_ACTIVE` y `SUBSCRIPTION_STATE_IN_GRACE_PERIOD` del producto `maintenpro_premium_monthly`.

## Fallos verificados en este árbol

1. El acceso directo del ZIP no inicia `desktop-session.mjs`. Sin ese proceso no hay PKCE, no hay ID token y la página responde que falta la sesión. No se envía el archivo local.
2. `deviceId` es obligatorio en `POST /v1/sync`. Si falta o no cumple el formato, la respuesta es 400 `invalid-device` y no se escribe nada. El servidor lo devuelve en la respuesta. Sigue sin haber un cursor distinto por dispositivo.
3. No hay una cola en el servidor ni un reintento automático. El estado local completo es lo que se vuelve a enviar. Si el intento no sale, `pending` queda en verdadero y la pantalla dice que los datos siguen solo en el dispositivo. Un 200 lo pone en falso. Ese aviso no abre el acceso.
4. Si el cliente envía una copia más antigua, el servidor conserva la guardada, la devuelve y añade `conflicts` con la colección y el id. No hay pregunta al usuario ni respuesta 409.
5. `GET /v1/entitlement` no tiene llamador en Android ni en el PC.
6. El PC no puede registrar la compra. Depende de que Android haya llamado antes a `POST /v1/session` con la misma cuenta.
7. Una compra guardada en `localStorage` ya no abre el acceso al arrancar. El derecho solo entra tras una respuesta válida del servicio en esa ejecución. Antes, un JSON local con `serverValidated` bastaba para desbloquear el PC.
8. `server/index.js` sale con código 1 si faltan `DATABASE_URL`, `GOOGLE_CLIENT_ID` o `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, o si el formato no sirve. El mensaje nombra la variable y no imprime valores. Si PostgreSQL rechaza la conexión, el proceso dice que no se imprime la cadena. No arranca un almacén falso ni una sesión inventada.
9. `node scripts/config-check.mjs` en este equipo sale con código 1. Ausentes: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `SYNC_API_BASE`.
10. Android, en `MainActivity.syncWithService`, responde `client-session-missing` si `SYNC_API_BASE` no es https o faltan el ID token o el token de compra. La página avisa que no se enviaron datos.
11. El producto `maintenpro_premium_monthly` sigue sin existir en Play Console. Este código no lo crea.
12. Railway no tiene el proyecto `maintenpro`. Floot no está publicado. No hay llamada real a Google, Play o PostgreSQL.

## Compilación Android en este equipo

No se generó APK ni AAB. El bloqueo es de herramientas, no de una credencial de Play:

- Java presente: `C:\Program Files\Microsoft\jdk-11.0.12.7-hotspot\bin\java.exe`, OpenJDK 11.0.12.
- `gradle` no está en el PATH.
- `ANDROID_HOME` está vacío.
- `android\gradlew.bat` no existe.
- `android/build.gradle.kts` pide Android Gradle Plugin 8.13.2.

## Prueba que sí corre sin credenciales

`scripts/sync-queue.test.mjs` comprueba el aviso «Sin configurar», el aviso «Sin conexión», que un fallo conserva los registros locales, que el reintento vuelve a enviar esa copia y que un conflicto deja la versión del servicio. `scripts/sync-roundtrip.test.mjs` usa el API en memoria y verificadores de prueba. El móvil registra una compra sintética, el PC recibe el equipo, la orden creada en el PC vuelve al móvil y el nombre con la marca más nueva gana. La copia perdedora aparece en `conflicts`. La respuesta no contiene el token de compra. `npm test` incluye esas pruebas. No sustituyen un 200 contra un servicio desplegado.

## Configuración ausente para sincronización real

Ningún valor de estas variables está en el repositorio ni en este informe. Los nombres vacíos están en `.env.example`. `node scripts/config-check.mjs` en este equipo sale con código 1 y escribe solo los nombres ausentes.

Obligatorias para arrancar `server/index.js`:

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`

Obligatorias para comprobar la compra y para que los clientes apunten a un servicio:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, con los campos `client_email` y `private_key` dentro del JSON
- `SYNC_API_BASE`, y tiene que empezar por `https://`
- `GOOGLE_WEB_CLIENT_ID`, propiedad de Gradle del build Android. No es una variable del proceso del servidor y no está en el repositorio. Es el identificador público del mismo cliente OAuth.

Opcionales, con valor de código si no se definen:

- `PLAY_PACKAGE_NAME`: si falta, `com.icapps.maintenpro`
- `PORT`: si falta, `8787`

Fuera de esas variables, la sincronización real sigue bloqueada por esto:

- La suscripción `maintenpro_premium_monthly` no existe en Play Console. Este código no la crea.
- No hay proyecto Railway `maintenpro` ni PostgreSQL desplegado.
- Floot Cloud Sync `932e217f-d8a7-47fb-9d77-cb68a9754e9d` no está publicado.
- El ZIP de instalación abre `file:///` y no inicia la sesión de escritorio.
- En este equipo no hay Gradle, `ANDROID_HOME` está vacío y no existe `android\gradlew.bat`.

El ZIP de código `MaintenPro_Codigo_Fuente_2026-10-21.zip` ya está en Drive MaintenPro, ID `1xnLxAGGXn__wxkvsChBbgjzhk7dWyHYV`, 5.266.372 bytes. Los cambios de `deviceId`, `conflicts` y `pending` son posteriores a esa copia.
