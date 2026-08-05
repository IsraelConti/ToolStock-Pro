# Configuración de la suscripción en Google Play Console

La aplicación ya está programada para consultar y comprar este producto:

- ID del producto: `moments_planner_premium_monthly`
- Nombre recomendado: Moments Planner Premium mensual
- ID del plan base: `mensual-499`
- Tipo: renovación automática
- Periodo de facturación: mensual
- Precio en España: 4,99 €
- ID de la oferta: `prueba-3-dias`
- Elegibilidad: captación de clientes nuevos; nunca han tenido una suscripción de esta aplicación
- Fase de la oferta: prueba gratuita de 3 días
- Después de la prueba: pasa automáticamente al plan base mensual

## Pasos

1. Sube primero el AAB firmado a una prueba interna y guarda el borrador de la versión.
2. En Google Play Console abre **Monetizar con Play > Productos > Suscripciones**.
3. Crea la suscripción con el ID exacto `moments_planner_premium_monthly`.
4. Añade el plan base `mensual-499`, con renovación automática mensual y precio de 4,99 € en España.
5. Activa el plan base y revisa los precios convertidos de los demás países.
6. Crea la oferta `prueba-3-dias` para nuevos clientes.
7. Añade una fase **Prueba gratuita**, duración **3 días**, y activa la oferta.
8. Añade las cuentas de prueba en **Configuración > Prueba de licencia** y publica la versión en prueba interna.
9. Instala la aplicación desde el enlace de prueba de Google Play; una APK instalada manualmente no puede probar correctamente la compra real.

Google Play determina si cada cuenta puede recibir la prueba. Si no es elegible, la aplicación muestra el plan mensual disponible. La pantalla de Google Play enseña siempre el precio y las condiciones finales antes de confirmar.

