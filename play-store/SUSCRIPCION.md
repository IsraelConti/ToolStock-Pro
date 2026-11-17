# MaintenPro — modelo freemium (13 de noviembre de 2026)

## Android

1. **7 días iniciales de uso completo** desde la primera apertura. Equipos ilimitados, **sin anuncios**, sin tarjeta y sin cargo o renovación automática. No es una oferta de prueba de Google Play Billing.
2. **Desde el día 8**, sin pagar, acceso gratuito permanente **con anuncios** y hasta **15 equipos activos**. Las órdenes de trabajo, operaciones, preventivos, averías y el histórico pueden seguir utilizándose sobre esos equipos; los datos ya registrados se conservan, incluso si superan 15.
3. **Premium opcional**: 4,99 € al mes en España (producto maintenpro_premium_monthly, plan mensual-499), con equipos ilimitados y sin anuncios. El precio definitivo se muestra en Google Play.
4. Al cancelar Premium y terminar el periodo pagado, volver a gratis sin borrar equipos, informes ni histórico.
5. El acceso del PC requiere Premium. Se conserva la sincronización y la verificación de licencia preexistentes. No se habilita acceso gratuito a Windows.

## Google Play y seguridad de cobro

- Reutilizar la suscripción y plan existentes. No crear un segundo producto.
- Seleccionar únicamente el plan mensual de pago (sin una fase gratuita que provoque un cargo automático). Los siete días gratis son de uso local en Android.
- Probar compra, restauración y caducidad con cuentas/pagos de prueba antes del envío, y comprobar Android–PC–Android. No permitir códigos de revisión en la versión de usuario.
- Las versiones publicadas y los datos locales/Drive de sus usuarios se conservan.

## AdMob

- Primeros siete días y usuarios Premium: **nunca** mostrar anuncios.
- Gratis desde el día 8: banner discreto debajo de la interfaz, con SDK Google Mobile Ads y consentimiento UMP cuando corresponda.
- La variante debug usa identificadores de anuncios de prueba. El build release se bloquea si faltan los identificadores reales MAINTENPRO_ADMOB_APP_ID y MAINTENPRO_ADMOB_BANNER_UNIT_ID en GitHub Actions. Nunca publicar identificadores de prueba.
- Registrar AdMob y configurar anuncios reales, revisar consentimiento y privacidad/seguridad de datos y actualizar «Contiene anuncios» en Play Console antes de publicar. No cambiar la declaración de la versión antigua mientras todavía no tiene anuncios.

## Publicación

Base fuente: MaintenPro 1.2.9.1 (13), commit original 17c4009f992b272981b1d104dc6e030a3a95914e.
Nueva versión propuesta: **1.2.9.2 (14)**, rama feature/maintenpro-v13-freemium-7d.
No publicar sin verificación de CI, AAB firmado, anuncios reales y pruebas de compras y sincronización.
