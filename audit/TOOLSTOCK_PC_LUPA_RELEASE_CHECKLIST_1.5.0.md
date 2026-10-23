# ToolStock Pro 1.5.0 — checklist de actualización

## Cerrado en código

- [x] Runtime PC en Chrome app-mode limitado a loopback.
- [x] OAuth de Google Drive en PC con tokens solo en memoria.
- [x] Puente Android Google Sign-In con alcance privado `drive.appdata`.
- [x] Sincronización por cuenta de cliente, con fusión por identificador y fecha.
- [x] Estado visible de cuenta, sincronización y desvinculación local.
- [x] Guía local Lupa sin llamadas a una IA externa.
- [x] Diálogo de impresión de Windows y servicio de impresión Android.
- [x] Lanzador portable y acceso directo por usuario sin administrador.
- [x] Script de firma reproducible sin secretos en el repositorio.
- [x] `versionName 1.5.0`, `versionCode 11`.
- [x] Regresión de fusión Drive y rechazo de autorización ausente.

## Validación automática

- [x] Build web.
- [x] Playwright web regression en CI.
- [x] Smoke Android y bundle release en CI.
- [x] Sintaxis del runtime PC en CI.

## Validación externa obligatoria antes de publicar

- [ ] Autorizar la misma cuenta en un móvil Android y un PC Windows y crear un registro en cada dispositivo.
- [ ] Confirmar que ambos dispositivos ven el registro del otro y que no se mezclan dos cuentas distintas.
- [ ] Instalar desde una pista autorizada de Google Play y probar compra, restauración, estado pendiente y cancelación.
- [ ] Generar una etiqueta QR y seleccionar una impresora Windows física.
- [ ] Confirmar en Play Console que el restablecimiento de la clave de subida está aprobado.
- [ ] Firmar el AAB 1.5.0 con la clave aprobada, verificar la firma y subirlo a la ficha existente.
- [ ] Revisar la ficha y enviar la actualización a revisión.

La rama de trabajo y la versión publicada permanecen separadas hasta completar estas comprobaciones.
