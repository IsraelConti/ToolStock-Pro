# Suscripción de MaintenPro — modelo freemium (pendiente de activar en Play Console)

## Modalidades acordadas

- **Gratis permanente:** máximo de 15 equipos nuevos registrados, anuncios discretos, sin limitar operaciones ni mantenimientos sobre los equipos existentes.
- **Pro:** equipos ilimitados y sin anuncios por **4,99 €/mes** en España.
- **Prueba Pro:** **7 días gratuitos** para nuevas cuentas elegibles. Al terminar, Google Play inicia el cobro mensual si la persona no cancela.
- **Cancelación o fin de Pro:** vuelve a la modalidad gratuita sin borrar equipos ni históricos. Si hay más de 15 equipos, se conservan y pueden consultarse; solo se impide registrar más equipos hasta recuperar Pro o estar por debajo del límite.

## IDs de Play Billing

- ID del producto: `maintenpro_premium_monthly`
- Tipo: suscripción con renovación automática.
- ID del plan base: `mensual-499`
- Periodo del plan base: mensual (`P1M`).
- Precio en España: 4,99 €/mes.
- ID propuesto de oferta nueva: `prueba-7-dias`.
- Duración de la prueba: 7 días (`P7D`).
- Elegibilidad propuesta: nuevos clientes, según reglas de Google Play Console.

**Estado real:** este documento define el modelo solicitado. No acredita que la oferta de 7 días esté creada o activada en Play Console. La app actual obtiene el precio y las ofertas elegibles desde Google Play; el código debe verificar la duración exacta de la oferta antes de anunciar «7 días».

## Configuración pendiente en Play Console

1. Confirmar que la suscripción `maintenpro_premium_monthly` y su plan base `mensual-499` corresponden a la aplicación correcta.
2. Mantener precio de 4,99 €/mes y renovar mensualmente (`P1M`).
3. Crear o modificar una oferta elegible con fase gratuita `P7D`; no modificar los derechos de clientes activos sin revisar su impacto.
4. Activar la oferta para España y comprobar su elegibilidad con una cuenta de prueba nueva.
5. Verificar que el flujo de compra muestra 7 días gratis y el precio final de 4,99 €/mes, que la restauración funciona y que cancelar no elimina los datos.

No anunciar que los 7 días están activos hasta completar esta comprobación.
