# Guía rápida de subida a Google Play

## Antes de crear la aplicación

Termina las verificaciones pendientes de la cuenta de desarrollador. Google Play no permite crear ni publicar aplicaciones nuevas mientras la identidad o el dispositivo estén pendientes de aprobación.

## Crear y probar Moments Planner

1. Pulsa **Crear aplicación** en Google Play Console.
2. Nombre: **Moments Planner: Eventos**.
3. Idioma predeterminado: **Español (España)**.
4. Selecciona **Aplicación**, **Gratis** y acepta las declaraciones.
5. Abre **Pruebas > Prueba interna > Crear versión**.
6. Si Google pregunta por la firma, elige **Usar la firma de aplicaciones de Google Play** y conserva también la clave privada entregada como copia de seguridad.
7. Sube `Moments-Planner-1.1.0-PLAY-STORE-FIRMADO.aab`.
8. Completa la ficha con `FICHA_GOOGLE_PLAY_ES.md` y los recursos gráficos incluidos.
9. Configura la suscripción siguiendo `SUSCRIPCION_3_DIAS.md`.
10. Completa **Contenido de la aplicación**: acceso sin inicio de sesión, anuncios (No), clasificación de contenido, audiencia, seguridad de los datos y política de privacidad.
11. Añade tu cuenta de Gmail como tester, guarda y publica la prueba interna.
12. Abre el enlace de prueba desde el móvil, instala desde Google Play y comprueba compra, restauración, exportaciones y copia de seguridad.

## Publicación posterior

En una cuenta personal nueva, Google puede exigir una prueba cerrada con el número y duración de testers que muestre la propia consola antes de solicitar acceso a producción. Sigue exactamente el requisito que aparezca en **Panel > Producción**; no se puede completar hasta que Google haya aprobado la cuenta y se cumpla esa prueba.

No subas el APK a producción. El archivo correcto para Play Store es el AAB firmado. El APK incluido sirve solo para comprobar la aplicación directamente en un móvil Android.

