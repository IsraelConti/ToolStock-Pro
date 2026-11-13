# MaintenPro — versión gratuita, prueba de uso y suscripción Pro

## Modelo aprobado (13 de noviembre de 2026)

1. **Primeros 7 días desde la primera apertura:** acceso funcional completo, equipos ilimitados, **con anuncios discretos**. Esta es una prueba local de la app, **NO** una prueba de la suscripción Google Play; no se solicita pago y **no se cobra automáticamente** al vencer.
2. **Después del séptimo día, sin suscripción:** versión **gratuita permanente**, hasta **15 equipos nuevos**, **con anuncios**. Se mantienen todos los equipos ya creados, sus averías, preventivos, fotos e históricos, incluidos los que superen 15. No se pueden crear nuevos equipos cuando ya hay 15 o más, pero se puede seguir trabajando sobre los existentes.
3. **Suscripción Pro pagada:** **4,99 € al mes** en España, sin anuncios y sin límite de equipos.
4. **Al cancelar Pro:** se conserva todo. Tras finalizar el periodo de pago, vuelve a la modalidad gratuita (si todavía está en los primeros 7 días de uso, prevalece la prueba inicial).
5. **Aviso obligatorio:** mostrar los días restantes durante la prueba y avisar antes de caducar de que desde el día 8 habrá máximo de 15 nuevos equipos, con anuncios; **sin cargos** si no contrata Pro.

## Google Play Billing

- ID del producto de suscripción: `maintenpro_premium_monthly`.
- Plan base mensual: `mensual-499` (P1M, 4,99 €/mes).
- Se debe seleccionar el plan **de pago directamente**, sin ofertas promocionales de 3 o 7 días que provoquen renovación automática. La prueba de 7 días no utiliza Google Play Billing.
- Antes del cobro, Google Play debe indicar el precio, los impuestos aplicables y las condiciones de renovación. Nunca iniciar compras sin una acción explícita.
- Verificar las suscripciones activas, su restauración y la transición a modo gratuito al expirar.
- Las suscripciones antiguas que incluyan una oferta gratuita de Google Play requieren comprobar la fase real en el backend si se pretende que sigan viendo anuncios durante ese periodo.

## Publicidad y privacidad

- Los anuncios aparecen en FREE y TRIAL, pero **jamás** en PAID.
- Integrar Google Mobile Ads con identificadores **de prueba solo en depuración**. Para generar la versión de producción deben configurarse los IDs reales de la cuenta AdMob y actualizar las declaraciones de Play Console.
- Añadir declaración de uso de anuncios, consentimiento aplicable y política de privacidad adecuada antes de publicar.
- Las pruebas no deben borrar datos locales ni obligar a contratar Pro.
