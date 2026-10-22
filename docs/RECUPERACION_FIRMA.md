# Recuperación de la firma de MaintenPro

La carpeta privada MaintenPro de Drive conserva dos archivos necesarios para la recuperación:

- `MaintenPro_Recuperacion_Firma_PRIVADA_2026-10-22.pem`: clave privada de recuperación.
- `MaintenPro_Firma_Recuperacion_CIFRADA_2026-10-22.json`: almacén de firma y contraseñas, cifrados juntos.

El repositorio contiene solamente la clave pública de recuperación. La clave privada no se incluye en el código público ni en los instaladores.

Para comprobar el respaldo sin escribir ni mostrar sus contraseñas:

```sh
node scripts/signing-recovery.cjs verify CLAVE_PRIVADA.pem RESPALDO_CIFRADO.json
```

Para recuperar los archivos en una carpeta privada fuera del repositorio:

```sh
node scripts/signing-recovery.cjs recover CLAVE_PRIVADA.pem RESPALDO_CIFRADO.json CARPETA_PRIVADA
```

Se generan `maintenpro-upload.jks` y `signing-passwords.json`; el proceso no sobrescribe archivos existentes. Si el alias configurado está vacío o no coincide, usa `keytool -list` para localizar la entrada de clave privada, como hace la compilación de Android.

El respaldo se genera con los mismos secretos que utiliza la compilación firmada de Android. Su recuperación valida el contenido mediante el cifrado autenticado y la suma SHA-256 del almacén. No es una copia de la clave de firma administrada por Google Play; es la clave de subida que utiliza este proyecto para enviar sus actualizaciones.
